"""Formato de texto legible del plan de compra."""
from itertools import groupby

from .planificador import Plan
from .reglas import TIENDAS

DEPARTAMENTOS = {
    "bebe": "Bebé",
    "bebidas": "Bebidas",
    "carnes": "Carnes y aves",
    "salchichoneria": "Salchichonería",
    "pescados": "Pescados y mariscos",
    "congelados": "Congelados",
    "despensa": "Despensa",
    "frutas_verduras": "Frutas y verduras",
    "higiene": "Higiene personal",
    "lacteos_huevo": "Lácteos y huevo",
    "limpieza": "Limpieza",
    "mascotas": "Mascotas",
    "panaderia_tortilleria": "Panadería y tortillería",
}


def _dinero(valor: float) -> str:
    return f"${valor:,.2f}"


def formatear(plan: Plan) -> str:
    h = plan.hogar
    personas = ", ".join(f"{m.nombre or m.grupo} ({m.edad})" for m in h.miembros)
    out = [
        f"DESPENSA INTELIGENTE · {TIENDAS[h.tienda]}{' · ' + h.estado if h.estado else ''} · {h.nombre or 'Mi hogar'}",
        f"Hogar: {personas}",
    ]
    if h.mascotas:
        out.append("Mascotas: " + ", ".join(f"{m.tipo} {m.tamano if m.tipo == 'perro' else ''}".strip() for m in h.mascotas))
    restricciones = []
    if h.alergias:
        restricciones.append("alergias: " + ", ".join(h.alergias))
    if h.excluir:
        restricciones.append("sin: " + ", ".join(h.excluir))
    if h.dieta:
        restricciones.append("dieta " + h.dieta)
    if restricciones:
        out.append("Restricciones: " + "; ".join(restricciones))
    out.append(f"Periodo: {h.periodo_dias} días · Presupuesto: {_dinero(h.presupuesto)}")
    out.append("")

    for depto, lineas in groupby(plan.lineas, key=lambda l: l.producto.departamento):
        lineas = list(lineas)
        out.append(f"── {DEPARTAMENTOS.get(depto, depto)} " + "─" * 40)
        for l in lineas:
            nota = f"  (repartir en {l.visitas} compras)" if l.visitas > 1 else ""
            out.append(f"  {l.paquetes:>3} × {l.producto.nombre:<52} {_dinero(l.subtotal):>11}{nota}")
        out.append(f"  {'':>58} {_dinero(sum(l.subtotal for l in lineas)):>11}")
        out.append("")

    out.append(f"TOTAL:    {_dinero(plan.total):>12}")
    out.append(f"SOBRANTE: {_dinero(plan.sobrante):>12}")
    out.append("")
    out.append("Cobertura de necesidades (requerido → comprado):")
    for c in plan.cobertura:
        marca = "✔" if c.porcentaje >= 95 else ("~" if c.porcentaje >= 60 else "✘")
        out.append(
            f"  {marca} [P{c.prioridad}] {c.nombre:<36} {c.requerido:>7.1f} → {c.cubierto:>7.1f} {c.unidad:<5} ({c.porcentaje:.0f}%)"
        )

    if plan.notas:
        out.append("")
        out.append("Notas:")
        out.extend(f"  • {n}" for n in plan.notas)

    if plan.excluidos:
        out.append("")
        out.append(f"Productos excluidos por sus restricciones ({len(plan.excluidos)}):")
        for p, motivo in plan.excluidos:
            out.append(f"  - {p.nombre} [{motivo}]")
        if h.alergias:
            out.append("  ⚠ Revisa siempre la etiqueta: la información de alérgenos del catálogo puede no estar completa.")

    out.append("")
    de_profeco = [l for l in plan.lineas if l.producto.fuente_precio == "profeco_qqp"]
    fecha = max((l.producto.fecha_precio for l in de_profeco), default="")
    out.append(
        f"Precios: {len(de_profeco)} de {len(plan.lineas)} productos con precio de referencia de Profeco"
        + (f" (al {fecha})" if fecha else "")
        + "; el resto son estimados. Pueden variar por sucursal."
    )
    return "\n".join(out)
