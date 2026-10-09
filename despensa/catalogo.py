"""Catálogo de productos de la tienda y filtrado por alergias y exclusiones."""
import csv
import re
from dataclasses import dataclass
from pathlib import Path

from .perfil import Hogar
from .reglas import NECESIDADES
from .texto import formas, normalizar, palabras

CATALOGO_DEFAULT = Path(__file__).resolve().parent.parent / "data" / "catalogo_walmart.csv"
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
    alergenos: frozenset[str]
    etiquetas: frozenset[str]
    vida_util_dias: int
    congelable: bool


def _lista(campo: str) -> frozenset[str]:
    return frozenset(normalizar(x) for x in campo.split(";") if x.strip())


def cargar_catalogo(ruta: str | Path = CATALOGO_DEFAULT) -> list[Producto]:
    productos = []
    with open(ruta, encoding="utf-8", newline="") as f:
        for n, fila in enumerate(csv.DictReader(f), start=2):
            if fila["necesidad"] not in NECESIDADES:
                raise ValueError(f"Línea {n}: necesidad desconocida '{fila['necesidad']}'")
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
            )
            if p.contenido <= 0 or p.precio <= 0:
                raise ValueError(f"Línea {n}: contenido y precio deben ser mayores a 0 ({p.id})")
            if p.unidad != NECESIDADES[p.necesidad].unidad:
                raise ValueError(
                    f"Línea {n}: {p.id} usa '{p.unidad}' pero {p.necesidad} se mide en "
                    f"'{NECESIDADES[p.necesidad].unidad}'"
                )
            productos.append(p)
    ids = [p.id for p in productos]
    if len(ids) != len(set(ids)):
        raise ValueError("Hay ids de producto repetidos en el catálogo.")
    return productos


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
        alergenos = sorted(p.alergenos & alergias)
        if alergenos:
            excluidos.append((p, f"alergia: {', '.join(alergenos)}"))
            continue
        termino = next((t for t in terminos if coincide_exclusion(t, p)), None)
        if termino:
            excluidos.append((p, f"excluido: {termino}"))
            continue
        aptos.append(p)
    return aptos, excluidos
