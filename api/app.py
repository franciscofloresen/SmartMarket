"""API HTTP del motor de despensa (FastAPI).

Desarrollo:  .venv/bin/uvicorn api.app:app --reload
Variables de entorno:
  CORS_ORIGINS   orígenes permitidos separados por coma (default: el dev server de Vite)
  REPORTES_PATH  archivo JSONL donde se guardan los reportes de testers
  REPORTES_TOKEN clave para descargar los reportes en GET /api/reportes (sin ella, el endpoint no existe)
  WEB_DIST       carpeta con la web app compilada para servirla en "/" (default: web/dist)
"""
import hmac
import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, Literal

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from despensa.catalogo import cargar_catalogo
from despensa.perfil import PerfilInvalido, hogar_desde_dict
from despensa.planificador import AjusteInvalido, Ajustes, planear
from despensa.reglas import NOMBRES_ALERGENOS, NOMBRES_DIETAS, NOMBRES_TAMANOS_PERRO

RAIZ = Path(__file__).resolve().parent.parent
TIENDA = "Walmart Supercenter"
TIEMPO_LIMITE_SOLVER = 10

CATALOGO = cargar_catalogo()
CATALOGO_IDS = {p.id for p in CATALOGO}
REPORTES_PATH = Path(os.environ.get("REPORTES_PATH", RAIZ / "data" / "reportes" / "reportes.jsonl"))
REPORTES_TOKEN = os.environ.get("REPORTES_TOKEN", "")
_reportes_lock = threading.Lock()


# --- Modelos de entrada ---

class MiembroIn(BaseModel):
    edad: int = Field(ge=0, le=120)
    sexo: Literal["F", "M"] | None = None
    nombre: str = Field("", max_length=40)


class MascotaIn(BaseModel):
    tipo: Literal["perro", "gato"]
    tamano: Literal["chico", "mediano", "grande", "gigante"] = "mediano"
    nombre: str = Field("", max_length=40)


class PerfilIn(BaseModel):
    nombre: str = Field("", max_length=60)
    presupuesto: float = Field(gt=0, le=1_000_000)
    periodo_dias: int = Field(30, ge=1, le=62)
    miembros: list[MiembroIn] = Field(min_length=1, max_length=20)
    mascotas: list[MascotaIn] = Field(default_factory=list, max_length=10)
    alergias: list[Annotated[str, Field(max_length=30)]] = Field(default_factory=list, max_length=10)
    excluir: list[Annotated[str, Field(max_length=40)]] = Field(default_factory=list, max_length=30)
    dieta: str | None = None
    tortillas_caseras: bool = False


class AjustesIn(BaseModel):
    excluir_productos: list[str] = Field(default_factory=list, max_length=200)
    fijar: dict[str, Annotated[int, Field(ge=0, le=100)]] = Field(default_factory=dict, max_length=200)


class PlanIn(BaseModel):
    perfil: PerfilIn
    ajustes: AjustesIn = Field(default_factory=AjustesIn)


class ReporteIn(BaseModel):
    tipo: Literal["precio", "producto", "comentario"]
    producto_id: str | None = Field(None, max_length=10)
    precio_reportado: float | None = Field(None, gt=0, le=100_000)
    sucursal: str = Field("", max_length=100)
    comentario: str = Field("", max_length=1000)


# --- App ---

app = FastAPI(title="SmartMarket API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.exception_handler(RequestValidationError)
def _error_validacion(_: Request, exc: RequestValidationError) -> JSONResponse:
    """Errores de validación como un mensaje legible, además del detalle por campo."""
    errores = [
        {"campo": ".".join(str(p) for p in e["loc"] if p != "body"), "mensaje": e["msg"]}
        for e in exc.errors()
    ]
    resumen = "; ".join(f"{e['campo']}: {e['mensaje']}" for e in errores)
    return JSONResponse(status_code=422, content={"detail": f"Datos inválidos: {resumen}", "errores": errores})


def _info_catalogo() -> dict:
    verificados = [p for p in CATALOGO if p.fuente_precio != "estimado"]
    fechas = sorted(p.fecha_precio for p in CATALOGO if p.fecha_precio)
    return {
        "tienda": TIENDA,
        "productos": len(CATALOGO),
        "precios_verificados": len(verificados),
        "fecha_precio_mas_antigua": fechas[0] if fechas else None,
        "fecha_precio_mas_reciente": fechas[-1] if fechas else None,
    }


@app.get("/api/salud")
def salud() -> dict:
    return {"ok": True}


@app.get("/api/opciones")
def opciones() -> dict:
    """Catálogos para construir los formularios de la app."""
    return {
        "catalogo": _info_catalogo(),
        "alergias": [{"clave": k, "nombre": v} for k, v in NOMBRES_ALERGENOS.items()],
        "dietas": [{"clave": k, "nombre": v} for k, v in NOMBRES_DIETAS.items()],
        "tamanos_perro": [{"clave": k, "nombre": v} for k, v in NOMBRES_TAMANOS_PERRO.items()],
        "periodo_dias": {"min": 1, "max": 62, "default": 30},
    }


@app.post("/api/plan")
def plan(entrada: PlanIn) -> dict:
    # Función síncrona a propósito: FastAPI la corre en un hilo y el solver no bloquea el servidor.
    try:
        hogar = hogar_desde_dict(entrada.perfil.model_dump())
        ajustes = Ajustes(
            excluir_productos=set(entrada.ajustes.excluir_productos),
            fijar=dict(entrada.ajustes.fijar),
        )
        resultado = planear(hogar, CATALOGO, ajustes, tiempo_limite=TIEMPO_LIMITE_SOLVER)
    except (PerfilInvalido, AjusteInvalido) as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    return {**resultado.a_dict(), "catalogo": _info_catalogo()}


@app.post("/api/reporte", status_code=201)
def reporte(entrada: ReporteIn) -> dict:
    if entrada.tipo in ("precio", "producto") and entrada.producto_id not in CATALOGO_IDS:
        raise HTTPException(status_code=422, detail="Indica un producto válido del catálogo.")
    if entrada.tipo == "precio" and entrada.precio_reportado is None:
        raise HTTPException(status_code=422, detail="Indica el precio que viste en la tienda.")
    if entrada.tipo == "comentario" and not entrada.comentario.strip():
        raise HTTPException(status_code=422, detail="El comentario está vacío.")

    registro = {"fecha": datetime.now(timezone.utc).isoformat(timespec="seconds"), **entrada.model_dump()}
    with _reportes_lock:
        REPORTES_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(REPORTES_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(registro, ensure_ascii=False) + "\n")
    return {"ok": True}


@app.get("/api/reportes", response_class=PlainTextResponse)
def reportes(authorization: Annotated[str, Header()] = "") -> str:
    """Descarga los reportes (JSONL). Requiere `Authorization: Bearer <REPORTES_TOKEN>`."""
    if not REPORTES_TOKEN:
        raise HTTPException(status_code=404)
    if not hmac.compare_digest(authorization.encode(), f"Bearer {REPORTES_TOKEN}".encode()):
        raise HTTPException(status_code=401, detail="Clave inválida.")
    with _reportes_lock:
        return REPORTES_PATH.read_text(encoding="utf-8") if REPORTES_PATH.exists() else ""


# La web app compilada se sirve desde la misma URL (se monta al final para no tapar /api).
_web_dist = Path(os.environ.get("WEB_DIST", RAIZ / "web" / "dist"))
if _web_dist.is_dir():
    app.mount("/", StaticFiles(directory=_web_dist, html=True), name="web")
