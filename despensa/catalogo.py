"""Catálogos de productos por tienda y filtrado por alergias y exclusiones."""
import csv
import re
from dataclasses import dataclass, replace
from functools import lru_cache
from pathlib import Path

from .perfil import Hogar
from .reglas import CADENAS_NACIONALES, ESTADOS, NECESIDADES, PRESENCIA_EXTRA, TIENDA_DEFAULT, TIENDAS
from .texto import formas, normalizar, palabras

DATOS = Path(__file__).resolve().parent.parent / "data"
# Productos que Profeco no levanta (mascotas, bolsas de basura...); se suman a todas las tiendas.
CATALOGO_MANUAL = DATOS / "catalogo_manual.csv"
# Productos que solo cuentan si el hogar los prepara (harina para tortillas).
ETIQUETA_HECHO_EN_CASA = "hecho en casa"


@dataclass(frozen=True)
class Producto:
    id: str
    nombre: str
    departamento: str
    necesidad: str
    contenido: float  # cuánto aporta un paquete, en la unidad de su necesidad
    unidad: str
    precio: float
    alergenos: frozenset[str]   # los contiene
    etiquetas: frozenset[str]
    vida_util_dias: int
    congelable: bool
    posibles: frozenset[str] = frozenset()  # puede contenerlos; no se puede descartar sin ver la etiqueta
    marca: str = ""
    tipo: str = ""               # tipo genérico ("Frijol", "Yoghurt"); agrupa alternativas
    nivel: str = "medio"         # economico | medio | premium, según precio por unidad dentro de su tipo
    fuente_precio: str = "estimado"  # "estimado" o de dónde viene (ej. "profeco_qqp")
    fecha_precio: str = ""           # AAAA-MM-DD


def _lista(campo: str) -> frozenset[str]:
    return frozenset(normalizar(x) for x in campo.split(";") if x.strip())


def _leer(ruta: Path) -> list[Producto]:
    productos = []
    with open(ruta, encoding="utf-8", newline="") as f:
        for n, fila in enumerate(csv.DictReader(f), start=2):
            if fila["necesidad"] not in NECESIDADES:
                raise ValueError(f"{ruta.name} línea {n}: necesidad desconocida '{fila['necesidad']}'")
            p = Producto(
                id=fila["id"],
                nombre=fila["nombre"],
                departamento=fila["departamento"],
                necesidad=fila["necesidad"],
                contenido=float(fila["contenido"]),
                unidad=fila["unidad"],
                precio=float(fila["precio"]),
                alergenos=_lista(fila["alergenos"]),
                etiquetas=_lista(fila["etiquetas"]),
                vida_util_dias=int(fila["vida_util_dias"]),
                congelable=fila["congelable"] == "1",
                posibles=_lista(fila.get("posibles") or ""),
                marca=fila.get("marca") or "",
                tipo=fila.get("tipo") or "",
                nivel=fila.get("nivel") or "medio",
                fuente_precio=fila.get("fuente_precio") or "estimado",
                fecha_precio=fila.get("fecha_precio") or "",
            )
            if p.contenido <= 0 or p.precio <= 0:
                raise ValueError(f"{ruta.name} línea {n}: contenido y precio deben ser mayores a 0 ({p.id})")
            if p.unidad != NECESIDADES[p.necesidad].unidad:
                raise ValueError(
                    f"{ruta.name} línea {n}: {p.id} usa '{p.unidad}' pero {p.necesidad} se mide en "
                    f"'{NECESIDADES[p.necesidad].unidad}'"
                )
            productos.append(p)
    return productos


@lru_cache(maxsize=None)
def _precios_por_estado(tienda: str) -> dict[str, dict[str, float]]:
    """estado -> id de producto -> precio (mediana de Profeco en ese estado)."""
    precios: dict[str, dict[str, float]] = {}
    ruta = DATOS / "precios_estado" / f"{tienda}.csv"
    if ruta.exists():
        with open(ruta, encoding="utf-8", newline="") as f:
            for fila in csv.DictReader(f):
                precios.setdefault(fila["estado"], {})[fila["id"]] = float(fila["precio"])
    return precios


def estados_de(tienda: str) -> list[str]:
    """Estados donde la tienda tiene precios propios."""
    return sorted(_precios_por_estado(tienda))


def presencia_de(tienda: str) -> list[str]:
    """Estados donde la cadena tiene sucursales."""
    if tienda in CADENAS_NACIONALES:
        return list(ESTADOS)
    return sorted(set(estados_de(tienda)) | PRESENCIA_EXTRA.get(tienda, set()))


def tiendas_en(estado: str | None) -> list[str]:
    """Cadenas con sucursales en el estado; sin estado (o si no se reconoce), todas."""
    if estado not in ESTADOS:
        return list(TIENDAS)
    return [t for t in TIENDAS if estado in presencia_de(t)]


@lru_cache(maxsize=None)
def _cargar(tienda: str, estado: str | None) -> tuple[Producto, ...]:
    if tienda not in TIENDAS:
        raise ValueError(f"Tienda desconocida: {tienda}")
    productos = _leer(DATOS / "catalogos" / f"{tienda}.csv") + _leer(CATALOGO_MANUAL)
    ids = [p.id for p in productos]
    if len(ids) != len(set(ids)):
        raise ValueError(f"Hay ids de producto repetidos en el catálogo de {tienda}.")
    if estado:
        locales = _precios_por_estado(tienda).get(estado, {})
        # Sin precio propio en el estado, se queda la mediana nacional.
        productos = [replace(p, precio=locales[p.id]) if p.id in locales else p for p in productos]
    return tuple(productos)


def cargar_catalogo(tienda: str = TIENDA_DEFAULT, estado: str | None = None) -> list[Producto]:
    return list(_cargar(tienda, estado or None))


def catalogo_de(hogar: Hogar) -> list[Producto]:
    """Catálogo de la tienda del hogar, con precios de su estado si los hay."""
    return cargar_catalogo(hogar.tienda, hogar.estado)


def coincide_exclusion(termino: str, producto: Producto) -> bool:
    """¿El término excluido ('brócoli', 'chiles', 'tomate verde') aplica a este producto?"""
    t = normalizar(termino)
    if t in producto.etiquetas:
        return True
    if " " in t:
        return re.search(rf"\b{re.escape(t)}\b", normalizar(producto.nombre)) is not None
    tokens = set(palabras(producto.nombre))
    for etiqueta in producto.etiquetas:
        tokens.update(palabras(etiqueta))
    formas_termino = formas(t)
    return any(formas_termino & formas(tok) for tok in tokens)


def filtrar(productos: list[Producto], hogar: Hogar) -> tuple[list[Producto], list[tuple[Producto, str]]]:
    """Separa productos aptos de excluidos, con el motivo de cada exclusión."""
    aptos, excluidos = [], []
    alergias = set(hogar.alergias)
    terminos = hogar.terminos_excluidos
    for p in productos:
        if ETIQUETA_HECHO_EN_CASA in p.etiquetas and not hogar.tortillas_caseras:
            continue  # no es una restricción del usuario, así que no se lista como excluido
        contiene = sorted(p.alergenos & alergias)
        if contiene:
            excluidos.append((p, f"alergia: {', '.join(contiene)}"))
            continue
        posible = sorted(p.posibles & alergias)
        if posible:
            excluidos.append((p, f"puede contener: {', '.join(posible)}"))
            continue
        termino = next((t for t in terminos if coincide_exclusion(t, p)), None)
        if termino:
            excluidos.append((p, f"excluido: {termino}"))
            continue
        aptos.append(p)
    return aptos, excluidos
