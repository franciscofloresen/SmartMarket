"""Actualiza los precios del catálogo con los datos abiertos de Profeco (Quién es Quién en los Precios).

Descarga el ZIP anual desde https://datos.profeco.gob.mx/datos_abiertos/qqp.php y ejecuta:

    python herramientas/precios_qqp.py RUTA/QQP_2026.zip            # solo muestra el reporte
    python herramientas/precios_qqp.py RUTA/QQP_2026.zip --aplicar  # además actualiza el catálogo

Por defecto usa el archivo más reciente dentro del ZIP. Cada producto del catálogo se asocia a
registros de Profeco en data/mapeo_qqp.csv (producto exacto + expresiones regulares para la
presentación y la marca). El precio es la mediana de todos los registros que coinciden en la
cadena, multiplicada por `factor` (ej. 6 bolillos = 6 × precio por pieza).
"""
import argparse
import csv
import io
import re
import statistics
import sys
import zipfile
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CATALOGO = RAIZ / "data" / "catalogo_walmart.csv"
MAPEO = RAIZ / "data" / "mapeo_qqp.csv"
FUENTE = "profeco_qqp"
MIN_REGISTROS = 10        # menos registros que esto se marca para revisión
CAMBIO_SOSPECHOSO = 0.5   # un cambio de más del 50% contra el precio anterior se marca para revisión


@dataclass
class Registro:
    presentacion: str
    marca: str
    precio: float
    fecha: str


def leer_registros(zip_path: Path, archivo: str | None, cadena: str) -> tuple[str, dict[str, list[Registro]]]:
    por_producto: dict[str, list[Registro]] = defaultdict(list)
    with zipfile.ZipFile(zip_path) as z:
        csvs = sorted(n for n in z.namelist() if n.lower().endswith(".csv"))
        miembro = next((n for n in csvs if n.endswith(archivo)), None) if archivo else csvs[-1]
        if miembro is None:
            sys.exit(f"No encontré {archivo} en el ZIP. Archivos: {', '.join(csvs)}")
        with z.open(miembro) as raw:
            for fila in csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8-sig", newline="")):
                if fila["cadena_comercial"].strip() != cadena:
                    continue
                try:
                    precio = float(fila["precio"])
                except ValueError:
                    continue
                por_producto[fila["producto"].strip()].append(
                    Registro(fila["presentacion"], fila["marca"], precio, fila["fecha_registro"].replace("/", "-"))
                )
    return miembro, por_producto


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("zip", type=Path, help="ZIP de datos abiertos QQP de Profeco")
    parser.add_argument("--archivo", help="CSV dentro del ZIP (default: el más reciente), ej. 07-2026_Q2.csv")
    parser.add_argument("--cadena", default="Wal-mart", help="Valor de cadena_comercial a usar")
    parser.add_argument("--aplicar", action="store_true", help="Escribe los precios en el catálogo")
    args = parser.parse_args()

    miembro, registros = leer_registros(args.zip, args.archivo, args.cadena)
    print(f"Fuente: {miembro} · cadena {args.cadena} · {sum(map(len, registros.values()))} registros\n")

    with open(CATALOGO, encoding="utf-8", newline="") as f:
        lector = csv.DictReader(f)
        columnas = lector.fieldnames
        catalogo = {fila["id"]: fila for fila in lector}

    revisar, sin_datos, actualizados = [], [], 0
    with open(MAPEO, encoding="utf-8", newline="") as f:
        for m in csv.DictReader(f):
            fila = catalogo.get(m["id"])
            if fila is None:
                sys.exit(f"El mapeo menciona {m['id']}, que no existe en el catálogo.")
            presentacion = re.compile(m["presentacion"])
            marca = re.compile(m["marca"]) if m["marca"] else None
            coinciden = [
                r for r in registros.get(m["producto"], [])
                if presentacion.search(r.presentacion) and (marca is None or marca.search(r.marca))
            ]
            if not coinciden:
                sin_datos.append(f"{m['id']} {fila['nombre']}")
                continue

            nuevo = round(statistics.median(r.precio for r in coinciden) * float(m["factor"]), 2)
            anterior = float(fila["precio"])
            variantes = len({(r.presentacion, r.marca) for r in coinciden})
            alertas = []
            if len(coinciden) < MIN_REGISTROS:
                alertas.append(f"solo {len(coinciden)} registros")
            if abs(nuevo - anterior) / anterior > CAMBIO_SOSPECHOSO:
                alertas.append(f"cambió {100 * (nuevo - anterior) / anterior:+.0f}%")
            linea = (
                f"{m['id']:<5} {(m['nombre'] or fila['nombre'])[:48]:<48} "
                f"${anterior:>8.2f} → ${nuevo:>8.2f}  ({len(coinciden)} reg., {variantes} variantes)"
            )
            print(linea + (f"  ⚠ {', '.join(alertas)}" if alertas else ""))
            if alertas:
                revisar.append(linea.strip())

            fila["precio"] = f"{nuevo:g}"
            fila["fuente_precio"] = FUENTE
            fila["fecha_precio"] = max(r.fecha for r in coinciden)
            if m["nombre"]:
                fila["nombre"] = m["nombre"]
            if m["contenido"]:
                fila["contenido"] = m["contenido"]
            actualizados += 1

    print(f"\nActualizados con Profeco: {actualizados} de {len(catalogo)}")
    print(f"Para revisar ({len(revisar)}): cambio grande de precio o pocos registros")
    print(f"Sin datos en este archivo ({len(sin_datos)}): " + "; ".join(sin_datos))
    sin_mapeo = len(catalogo) - actualizados - len(sin_datos)
    print(f"Sin mapeo (siguen estimados): {sin_mapeo}")

    if args.aplicar:
        with open(CATALOGO, "w", encoding="utf-8", newline="") as f:
            escritor = csv.DictWriter(f, fieldnames=columnas, lineterminator="\n")
            escritor.writeheader()
            escritor.writerows(catalogo.values())
        print(f"\nCatálogo actualizado: {CATALOGO.relative_to(RAIZ)}")
    else:
        print("\n(Solo reporte. Usa --aplicar para escribir el catálogo.)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
