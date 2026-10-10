"""Genera los catálogos por tienda a partir de los datos abiertos de Profeco (QQP).

Descarga el ZIP anual desde https://datos.profeco.gob.mx/datos_abiertos/qqp.php y ejecuta:

    python herramientas/importar_qqp.py RUTA/QQP_2026.zip            # solo reporte
    python herramientas/importar_qqp.py RUTA/QQP_2026.zip --aplicar  # escribe data/catalogos y data/precios_estado

Usa el archivo más reciente del ZIP. Qué producto de Profeco se convierte en qué producto del
catálogo se define en herramientas/reglas_qqp.py. Los productos que Profeco no levanta
(mascotas, bolsas de basura...) viven en data/catalogo_manual.csv y no se tocan aquí.
"""
import argparse
import csv
import hashlib
import io
import re
import statistics
import sys
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from despensa.reglas import NECESIDADES  # noqa: E402
from herramientas.reglas_qqp import MASA_O_VOL, PESO, PIEZAS, REGLAS, UNIDAD, VOLUMEN, Regla  # noqa: E402

# cadena_comercial de Profeco -> clave de tienda
CADENAS = {
    "Wal-mart": "walmart",
    "Bodega Aurrera": "bodega_aurrera",
    "Hipermercado Soriana": "soriana",
    "Mega Soriana": "soriana",
    "Mercado Soriana": "soriana",
    "Soriana Super": "soriana",
    "Chedraui": "chedraui",
    "La Comer": "la_comer",
    "H.e.b.": "heb",
}
# Catálogos de Profeco que no son de supermercado; sus productos sin regla no se reportan.
CATALOGOS_AJENOS = {"Medicamentos", "Útiles Escolares", "Electrodomésticos", "Tenis", "Especial"}
# Registros nacionales mínimos para incluir un producto: 8 en cadenas grandes, hasta 4 en las
# que Profeco visita poco (La Comer, H-E-B), donde 8 dejaría fuera categorías enteras.
MIN_REGISTROS = (4, 8)
REGISTROS_POR_UNIDAD_DE_MINIMO = 8000
MIN_REGISTROS_ESTADO = 3   # para publicar un precio propio del estado
FUENTE = "profeco_qqp"
COLUMNAS = [
    "id", "nombre", "marca", "tipo", "departamento", "necesidad", "contenido", "unidad", "precio", "alergenos",
    "posibles", "etiquetas", "vida_util_dias", "congelable", "nivel", "fuente_precio", "fecha_precio", "registros",
]

_NUM = r"(\d+(?:\.\d+)?)"
_MAGNITUD = re.compile(_NUM + r"\s?(kg|gr|g|lt|l|ml)\b\.?", re.IGNORECASE)
_MULTIPLE = re.compile(r"(\d+)\s+(?:[\wÀ-ÿ]+\s+){0,2}de\s+" + _NUM + r"\s?(kg|gr|g|lt|l|ml)\b", re.IGNORECASE)
# De más a menos específico: en "24 Rollos. 200 Hojas" cuentan los rollos.
_CONTEOS = [
    re.compile(r"C/(\d+)", re.IGNORECASE),
    re.compile(r"(\d+)(?:\s?\+\s?(\d+))?(?:\s+o\s+\d+)?\s+(?:rollos?|piezas?|pzas?|pa[ñn]ales|toallitas|toallas|barras|sobres|unidades|cubos|tabletas)", re.IGNORECASE),
    re.compile(r"con\s+(\d+)", re.IGNORECASE),
    re.compile(r"(\d+)\s+hojas", re.IGNORECASE),
]


def _a_base(valor: str, unidad: str) -> tuple[float, str]:
    """Convierte a kg o L. '3.564 Gr' es un error de captura frecuente por 3.564 kg."""
    n, u = float(valor), unidad.lower()
    if u in ("gr", "g"):
        return (n if re.fullmatch(r"\d\.\d{3}", valor) else n / 1000), "kg"
    if u == "kg":
        return n, "kg"
    if u == "ml":
        return n / 1000, "L"
    return n, "L"


def magnitud(presentacion: str) -> tuple[float, str] | None:
    """Mayor peso/volumen declarado: cubre '12 Cubos de 10.5 Gr' y 'Bolsa 20+2 Piezas. 561 Gr.'."""
    candidatos = [_a_base(m.group(1), m.group(2)) for m in _MAGNITUD.finditer(presentacion)]
    for m in _MULTIPLE.finditer(presentacion):
        n, u = _a_base(m.group(2), m.group(3))
        candidatos.append((int(m.group(1)) * n, u))
    return max(candidatos, default=None)


def conteo(presentacion: str) -> float | None:
    for patron in _CONTEOS:
        m = patron.search(presentacion)
        if m:
            return float(m.group(1)) + float(m.group(2) or 0) if m.lastindex and m.lastindex > 1 else float(m.group(1))
    return None


def contenido(regla: Regla, presentacion: str) -> float | None:
    """Cuánto aporta un paquete, en la unidad de su necesidad. None si no se puede saber."""
    mag = magnitud(presentacion)
    base: float | None = None
    if regla.medida == UNIDAD:
        base = 1.0
    elif regla.medida == PESO:
        base = mag[0] if mag and mag[1] == "kg" else regla.pieza
    elif regla.medida == VOLUMEN:
        base = mag[0] if mag and mag[1] == "L" else None
    elif regla.medida == MASA_O_VOL:
        base = mag[0] if mag else None
    elif regla.medida == PIEZAS:
        base = conteo(presentacion)
        if base is None and regla.pieza is not None:
            # Huevo a granel: piezas por kg. Lo demás: el paquete es una pieza.
            base = mag[0] * regla.pieza if mag and mag[1] == "kg" and regla.necesidad == "huevo" else regla.pieza
    return round(base * regla.factor, 4) if base and base > 0 else None


def regla_para(producto: str, presentacion: str, marca: str) -> Regla | None:
    texto = f"{presentacion} | {marca}"
    for regla in REGLAS.get(producto, []):
        if regla.si and not re.search(regla.si, texto, re.IGNORECASE):
            continue
        if regla.no and re.search(regla.no, texto, re.IGNORECASE):
            continue
        return regla
    return None


def nombre_legible(base: str, presentacion: str, marca: str) -> str:
    detalle = presentacion.strip().rstrip(".")
    # Se conserva el punto que sigue a la unidad: separa "Paquete 210 Gr. Príncipe" en dos partes.
    detalle = re.sub(r"\bGr\b", "g", detalle)
    detalle = re.sub(r"\bKg\b", "kg", detalle)
    detalle = re.sub(r"\bLt\b", "L", detalle)
    detalle = re.sub(r"\bMl\b", "ml", detalle)
    detalle = detalle.replace("P/", "para ")
    partes = [p.strip().rstrip(".") for p in re.split(r"\.\s+", detalle) if p.strip()]
    # Profeco lista sinónimos con " o "; nos quedamos con el primero cuando la parte es larga.
    partes = [re.split(r" o (?![^(]*\))", p)[0] if len(p) > 40 else p for p in partes]
    partes = [p[0].upper() + p[1:].lower() if i == 0 else p.lower() for i, p in enumerate(partes)]
    detalle = re.sub(r"(\d) l\b", r"\1 L", ", ".join(partes))
    titulo = base if marca in ("S/M", "") else f"{base} {marca.replace('. ', ' ')}"
    return f"{titulo} · {detalle}" if detalle else titulo


def identificador(producto: str, presentacion: str, marca: str) -> str:
    return "P" + hashlib.sha1(f"{producto}|{presentacion}|{marca}".encode()).hexdigest()[:8]


def leer(zip_path: Path, archivo: str | None):
    """tienda -> (producto, presentacion, marca) -> [(precio, estado, fecha)]"""
    datos: dict[str, dict[tuple, list]] = defaultdict(lambda: defaultdict(list))
    ajenos: set[str] = set()
    with zipfile.ZipFile(zip_path) as z:
        csvs = sorted(n for n in z.namelist() if n.lower().endswith(".csv"))
        miembro = next((n for n in csvs if n.endswith(archivo)), None) if archivo else csvs[-1]
        if miembro is None:
            sys.exit(f"No encontré {archivo} en el ZIP. Archivos: {', '.join(csvs)}")
        with z.open(miembro) as raw:
            for f in csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8-sig", newline="")):
                tienda = CADENAS.get(f["cadena_comercial"].strip())
                if tienda is None:
                    continue
                try:
                    precio = float(f["precio"])
                except ValueError:
                    continue
                if f["catalogo"].strip() in CATALOGOS_AJENOS:
                    ajenos.add(f["producto"].strip())
                clave = (f["producto"].strip(), f["presentacion"].strip(), f["marca"].strip())
                datos[tienda][clave].append((precio, f["estado"].strip(), f["fecha_registro"].replace("/", "-")))
    return miembro, datos, ajenos


def construir(datos_tienda: dict[tuple, list], sin_regla: Counter, sin_contenido: Counter):
    filas, por_estado = [], []
    total = sum(len(r) for r in datos_tienda.values())
    minimo = max(MIN_REGISTROS[0], min(MIN_REGISTROS[1], total // REGISTROS_POR_UNIDAD_DE_MINIMO))
    for (producto, presentacion, marca), registros in datos_tienda.items():
        if len(registros) < minimo:
            continue
        if producto not in REGLAS:
            sin_regla[producto] += 1
            continue
        regla = regla_para(producto, presentacion, marca)
        if regla is None:
            continue
        cont = contenido(regla, presentacion)
        if cont is None:
            sin_contenido[f"{producto} | {presentacion}"] += 1
            continue
        pid = identificador(producto, presentacion, marca)
        precio = round(statistics.median(r[0] for r in registros), 2)
        filas.append({
            "id": pid,
            "nombre": nombre_legible(regla.nombre or producto, presentacion, marca),
            "marca": "" if marca == "S/M" else marca,
            "tipo": producto,
            "departamento": regla.departamento,
            "necesidad": regla.necesidad,
            "contenido": f"{cont:g}",
            "unidad": NECESIDADES[regla.necesidad].unidad,
            "precio": f"{precio:g}",
            "alergenos": regla.alergenos,
            "posibles": regla.posibles,
            "etiquetas": regla.etiquetas,
            "vida_util_dias": regla.vida,
            "congelable": int(regla.congelable),
            "nivel": "medio",
            "fuente_precio": FUENTE,
            "fecha_precio": max(r[2] for r in registros),
            "registros": len(registros),
        })
        estados = defaultdict(list)
        for p, estado, _ in registros:
            estados[estado].append(p)
        for estado, precios in sorted(estados.items()):
            if len(precios) >= MIN_REGISTROS_ESTADO:
                por_estado.append((pid, estado, f"{round(statistics.median(precios), 2):g}"))
    _asignar_niveles(filas)
    filas.sort(key=lambda f: (f["departamento"], f["necesidad"], f["nombre"]))
    return filas, por_estado


def _asignar_niveles(filas: list[dict]) -> None:
    """Económico / medio / premium según el precio por unidad dentro del mismo tipo de producto."""
    grupos = defaultdict(list)
    for f in filas:
        grupos[(f["necesidad"], f["tipo"])].append(f)
    for grupo in grupos.values():
        if len(grupo) < 3:
            continue
        unitarios = sorted(float(f["precio"]) / float(f["contenido"]) for f in grupo)
        bajo, alto = unitarios[len(unitarios) // 3], unitarios[(2 * len(unitarios)) // 3]
        for f in grupo:
            unitario = float(f["precio"]) / float(f["contenido"])
            f["nivel"] = "economico" if unitario < bajo else "premium" if unitario > alto else "medio"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("zip", type=Path)
    parser.add_argument("--archivo", help="CSV dentro del ZIP (default: el más reciente)")
    parser.add_argument("--aplicar", action="store_true", help="Escribe los catálogos")
    parser.add_argument("--detalle", action="store_true", help="Lista las presentaciones que no se pudieron medir")
    args = parser.parse_args()

    miembro, datos, ajenos = leer(args.zip, args.archivo)
    print(f"Fuente: {miembro}\n")
    sin_regla, sin_contenido = Counter(), Counter()
    for tienda in sorted(datos):
        filas, por_estado = construir(datos[tienda], sin_regla, sin_contenido)
        optimizables = [f for f in filas if f["necesidad"] != "extras"]
        estados = {e for _, e, _ in por_estado}
        print(f"{tienda:<16} {len(filas):>5} productos ({len(optimizables)} calculables, "
              f"{len(filas) - len(optimizables)} extras) · {len(estados)} estados con precio propio")
        if args.aplicar:
            (RAIZ / "data" / "catalogos").mkdir(parents=True, exist_ok=True)
            (RAIZ / "data" / "precios_estado").mkdir(parents=True, exist_ok=True)
            with open(RAIZ / "data" / "catalogos" / f"{tienda}.csv", "w", encoding="utf-8", newline="") as f:
                w = csv.DictWriter(f, fieldnames=COLUMNAS, lineterminator="\n")
                w.writeheader()
                w.writerows(filas)
            with open(RAIZ / "data" / "precios_estado" / f"{tienda}.csv", "w", encoding="utf-8", newline="") as f:
                w = csv.writer(f, lineterminator="\n")
                w.writerow(["id", "estado", "precio"])
                w.writerows(por_estado)

    de_super = [(p, n) for p, n in sin_regla.most_common() if p not in ajenos]
    print(f"\nTipos de producto de súper sin regla (se omiten): {len(de_super)}")
    print("  " + "; ".join(f"{p} ({n})" for p, n in de_super))
    print(f"Presentaciones que no se pudieron medir: {len(sin_contenido)}")
    if args.detalle:
        for p, n in sin_contenido.most_common():
            print(f"  {p} ({n})")
    print("\nCatálogos escritos en data/catalogos y data/precios_estado." if args.aplicar
          else "\n(Solo reporte. Usa --aplicar para escribir.)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
