"""Uso: python -m despensa perfiles/familia_4_perro.json [--presupuesto 8000] [--json]"""
import argparse
import json
import sys

from .catalogo import catalogo_de
from .reglas import TIENDAS
from .perfil import PerfilInvalido, cargar_hogar
from .planificador import planear
from .reporte import formatear


def main() -> int:
    parser = argparse.ArgumentParser(description="Genera una despensa optimizada para tu hogar.")
    parser.add_argument("perfil", help="Archivo JSON con el perfil del hogar")
    parser.add_argument("--tienda", choices=list(TIENDAS), help="Sobrescribe la tienda del perfil")
    parser.add_argument("--estado", help="Estado para usar precios locales (ej. Jalisco)")
    parser.add_argument("--presupuesto", type=float, help="Sobrescribe el presupuesto del perfil")
    parser.add_argument("--json", action="store_true", help="Salida en JSON (para la app/API)")
    args = parser.parse_args()

    try:
        hogar = cargar_hogar(args.perfil)
    except PerfilInvalido as e:
        print(f"Perfil inválido: {e}", file=sys.stderr)
        return 2
    if args.presupuesto is not None:
        hogar.presupuesto = args.presupuesto

    if args.tienda:
        hogar.tienda = args.tienda
    if args.estado:
        hogar.estado = args.estado

    plan = planear(hogar, catalogo_de(hogar))
    if args.json:
        print(json.dumps(plan.a_dict(), ensure_ascii=False, indent=2))
    else:
        print(formatear(plan))
    return 0


if __name__ == "__main__":
    sys.exit(main())
