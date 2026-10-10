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

from despensa.catalogo import cargar_catalogo, catalogo_de, estados_de
from despensa.consultas import alternativas, buscar, comparar_tiendas
from despensa.perfil import PerfilInvalido, hogar_desde_dict
from despensa.planificador import AjusteInvalido, Ajustes, planear
from despensa.reglas import (
    NECESIDADES,
    NIVEL_DEFAULT,
    NIVELES,
    NOMBRES_ALERGENOS,
    NOMBRES_DIETAS,
    NOMBRES_TAMANOS_PERRO,
    TIENDA_DEFAULT,
    TIENDAS,
)

RAIZ = Path(__file__).resolve().parent.parent
TIEMPO_LIMITE_SOLVER = 10

# Se cargan todas las tiendas al arrancar: valida los CSV y deja los catálogos en caché.
CATALOGO_IDS = {p.id for tienda in TIENDAS for p in cargar_catalogo(tienda)}
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
    tienda: str = Field(TIENDA_DEFAULT, max_length=30)
    estado: str | None = Field(None, max_length=40)
    nivel: str = Field(NIVEL_DEFAULT, max_length=20)


class AjustesIn(BaseModel):
    excluir_productos: list[str] = Field(default_factory=list, max_length=500)
    fijar: dict[str, Annotated[int, Field(ge=0, le=100)]] = Field(default_factory=dict, max_length=200)
    en_casa: dict[str, Annotated[float, Field(ge=0, le=1)]] = Field(default_factory=dict, max_length=60)

    def a_ajustes(self) -> Ajustes:
        return Ajustes(set(self.excluir_productos), dict(self.fijar), dict(self.en_casa))


class PlanIn(BaseModel):
    perfil: PerfilIn
    ajustes: AjustesIn = Field(default_factory=AjustesIn)


class BuscarIn(BaseModel):
    perfil: PerfilIn
    texto: str = Field(min_length=2, max_length=60)


class AlternativasIn(BaseModel):
    perfil: PerfilIn
    producto_id: str = Field(max_length=12)
    paquetes: int = Field(1, ge=1, le=100)


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


def _info_catalogo(tienda: str = TIENDA_DEFAULT, estado: str | None = None) -> dict:
    catalogo = cargar_catalogo(tienda)
    verificados = [p for p in catalogo if p.fuente_precio != "estimado"]
    fechas = sorted(p.fecha_precio for p in catalogo if p.fecha_precio)
    return {
        "clave": tienda,
        "tienda": TIENDAS[tienda],
        # Solo se reporta el estado si la tienda tiene precios propios ahí.
        "estado": estado if estado in estados_de(tienda) else None,
        "productos": len(catalogo),
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
        "tiendas": [
            {"clave": clave, "nombre": nombre, "productos": len(cargar_catalogo(clave)), "estados": estados_de(clave)}
            for clave, nombre in TIENDAS.items()
        ],
        "alergias": [{"clave": k, "nombre": v} for k, v in NOMBRES_ALERGENOS.items()],
        "dietas": [{"clave": k, "nombre": v} for k, v in NOMBRES_DIETAS.items()],
        "niveles": [{"clave": k, "nombre": v} for k, v in NIVELES.items()],
        # Categorías que el usuario puede marcar como "ya tengo en casa".
        "necesidades": [{"clave": n.clave, "nombre": n.nombre} for n in NECESIDADES.values() if n.clave != "extras"],
        "tamanos_perro": [{"clave": k, "nombre": v} for k, v in NOMBRES_TAMANOS_PERRO.items()],
        "periodo_dias": {"min": 1, "max": 62, "default": 30},
    }


@app.post("/api/plan")
def plan(entrada: PlanIn) -> dict:
    # Función síncrona a propósito: FastAPI la corre en un hilo y el solver no bloquea el servidor.
    try:
        hogar = hogar_desde_dict(entrada.perfil.model_dump())
        resultado = planear(hogar, catalogo_de(hogar), entrada.ajustes.a_ajustes(), tiempo_limite=TIEMPO_LIMITE_SOLVER)
    except (PerfilInvalido, AjusteInvalido) as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    return {**resultado.a_dict(), "catalogo": _info_catalogo(hogar.tienda, hogar.estado)}


def _hogar(perfil: PerfilIn):
    try:
        return hogar_desde_dict(perfil.model_dump())
    except PerfilInvalido as e:
        raise HTTPException(status_code=422, detail=str(e)) from e


@app.post("/api/buscar")
def buscar_productos(entrada: BuscarIn) -> dict:
    """Busca en el catálogo de la tienda del hogar; marca lo que no es compatible con sus restricciones."""
    return {"resultados": buscar(_hogar(entrada.perfil), entrada.texto)}


@app.post("/api/alternativas")
def alternativas_de(entrada: AlternativasIn) -> dict:
    return {"alternativas": alternativas(_hogar(entrada.perfil), entrada.producto_id, entrada.paquetes)}


@app.post("/api/comparar")
def comparar(entrada: PlanIn) -> dict:
    """Total de la misma despensa en cada tienda."""
    try:
        tiendas = comparar_tiendas(_hogar(entrada.perfil), entrada.ajustes.a_ajustes(), TIEMPO_LIMITE_SOLVER)
    except AjusteInvalido as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    return {"tiendas": tiendas}


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
