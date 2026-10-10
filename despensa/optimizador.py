"""Optimizador de la despensa (programación lineal entera con PuLP/CBC).

Se resuelve en dos fases:
  1. Cubrir lo más posible las necesidades dentro del presupuesto, castigando más
     lo que falte de lo esencial que de lo opcional.
  2. Con esa cobertura fija, encontrar la combinación más barata.
"""
import math
from collections import defaultdict
from dataclasses import dataclass

import pulp

from .catalogo import Producto
from .reglas import CALIDAD_POR_NIVEL, HOLGURA_POR_NIVEL, NECESIDADES, PESO_BASICO, PESO_PRIORIDAD

# Se permite comprar hasta 25% de más, más un paquete del producto más grande disponible,
# porque se vende en paquetes enteros (1 kg de sal aunque se usen 400 g). Comprar de más
# solo ocurre si sale más barato en total, porque la fase 2 minimiza el costo.
EXCESO_PERMITIDO = 0.25
TOLERANCIA_FASE_1 = 1e-4
# En la fase 2 cada paquete "cuesta" un poco más: ante precios casi iguales se prefieren
# menos paquetes, más grandes (1 yogur de 1 kg en vez de 5 de 220 g).
PENALIZACION_PAQUETE = 0.75
# Tramos del faltante (fracción de la necesidad, multiplicador de castigo). Al ser
# crecientes, conviene recortar un poco de varias cosas antes que eliminar una por completo.
TRAMOS_FALTANTE = [(0.2, 1.0), (0.3, 3.0), (0.5, 10.0)]


@dataclass
class ResultadoOptimizacion:
    paquetes: dict[str, int]        # id de producto -> paquetes a comprar
    cubierto: dict[str, float]      # necesidad -> cantidad cubierta
    costo: float
    estado: str


def optimizar(
    productos: list[Producto],
    demandas: dict[str, float],
    presupuesto: float,
    tiempo_limite: int = 30,
    fijos: dict[str, int] | None = None,
    nivel: str = "ahorro",
    minimos: list[tuple[str, frozenset[str], float]] | None = None,
) -> ResultadoOptimizacion:
    """`fijos` son cantidades de paquetes que el usuario fijó (id -> paquetes); se respetan tal cual.

    `minimos` son antojos: (necesidad, etiquetas, cantidad) que debe venir de productos con alguna
    de esas etiquetas. La cantidad ya debe estar sumada a la demanda de su necesidad.

    `nivel` decide qué hacer con el dinero que sobra después de cubrir todo al menor costo:
    "ahorro" lo deja, "equilibrado" usa una parte en mejores marcas y "premium" lo usa todo.
    """
    fijos = fijos or {}
    por_necesidad: dict[str, list[Producto]] = defaultdict(list)
    # Productos fijados cuya necesidad no hace falta en este hogar: solo suman al costo.
    extras: list[Producto] = []
    for p in productos:
        if demandas.get(p.necesidad, 0) > 0:
            por_necesidad[p.necesidad].append(p)
        elif p.id in fijos:
            extras.append(p)
    candidatos = [p for ps in por_necesidad.values() for p in ps] + extras

    topes: dict[str, float] = {}
    for clave, ps in por_necesidad.items():
        tope = demandas[clave] * (1 + EXCESO_PERMITIDO) + max(p.contenido for p in ps)
        fijado = sum(p.contenido * fijos[p.id] for p in ps if p.id in fijos)
        topes[clave] = max(tope, fijado)

    prob = pulp.LpProblem("despensa", pulp.LpMinimize)
    x = {}
    for p in candidatos:
        if p.id in fijos:
            x[p.id] = prob.add_variable(f"x_{p.id}", fijos[p.id], fijos[p.id], cat="Integer")
        else:
            x[p.id] = prob.add_variable(f"x_{p.id}", 0, math.floor(topes[p.necesidad] / p.contenido), cat="Integer")
    tramos = {
        clave: [
            prob.add_variable(f"falta_{clave}_{i}", 0, ancho * demandas[clave])
            for i, (ancho, _) in enumerate(TRAMOS_FALTANTE)
        ]
        for clave in por_necesidad
    }

    costo = pulp.lpSum(p.precio * x[p.id] for p in candidatos)
    prob += costo <= presupuesto, "presupuesto"

    for clave, ps in por_necesidad.items():
        cobertura = pulp.lpSum(p.contenido * x[p.id] for p in ps)
        prob += cobertura + pulp.lpSum(tramos[clave]) >= demandas[clave], f"cubrir_{clave}"
        prob += cobertura <= topes[clave], f"tope_{clave}"
        # Variedad: ningún producto puede cubrir más de cierta fracción (más un paquete).
        # Si hay pocas opciones aptas, la fracción se relaja para que sigan alcanzando.
        variedad = max(NECESIDADES[clave].variedad_max, 1 / len(ps))
        if variedad < 1:
            for p in ps:
                if p.id in fijos:
                    continue  # lo que el usuario fijó manda sobre la variedad
                prob += p.contenido * x[p.id] <= variedad * demandas[clave] + p.contenido, f"variedad_{p.id}"

    # Variedad por tipo: todo el pollo o todos los yogures juntos tampoco pueden dominar.
    for clave, ps in por_necesidad.items():
        por_tipo: dict[str, list[Producto]] = defaultdict(list)
        for p in ps:
            if p.id not in fijos:
                por_tipo[p.tipo or p.id].append(p)
        variedad_tipo = max(NECESIDADES[clave].variedad_tipo_max, 1 / max(1, len(por_tipo)))
        if variedad_tipo < 1:
            for n, del_tipo in enumerate(por_tipo.values()):
                prob += (
                    pulp.lpSum(p.contenido * x[p.id] for p in del_tipo)
                    <= variedad_tipo * demandas[clave] + min(p.contenido for p in del_tipo),
                    f"variedad_tipo_{clave}_{n}",
                )

    # Topes por etiqueta (ej. embutidos <= 20% de las carnes), más un paquete de holgura.
    for clave, ps in por_necesidad.items():
        for etiqueta, fraccion in NECESIDADES[clave].limites.items():
            con_etiqueta = [p for p in ps if etiqueta in p.etiquetas and p.id not in fijos]
            if con_etiqueta:
                holgura = min(p.contenido for p in con_etiqueta)
                prob += (
                    pulp.lpSum(p.contenido * x[p.id] for p in con_etiqueta) <= fraccion * demandas[clave] + holgura,
                    f"limite_{clave}_{etiqueta}",
                )

    # Básicos: castigar no cubrir la proporción mínima de cada uno (si hay productos compatibles).
    sin_basico = []
    for clave, ps in por_necesidad.items():
        peso = PESO_PRIORIDAD[NECESIDADES[clave].prioridad] * PESO_BASICO
        for etiqueta, fraccion in NECESIDADES[clave].basicos.items():
            con_etiqueta = [p for p in ps if etiqueta in p.etiquetas]
            if not con_etiqueta:
                continue
            minimo = fraccion * demandas[clave]
            falta = prob.add_variable(f"sin_basico_{clave}_{etiqueta.replace(' ', '_')}", 0, minimo)
            prob += (
                pulp.lpSum(p.contenido * x[p.id] for p in con_etiqueta) + falta >= minimo,
                f"basico_{clave}_{etiqueta.replace(' ', '_')}",
            )
            sin_basico.append(peso * falta / minimo)

    # Antojos: castigar que falte la cantidad pedida de ese tipo de producto.
    for n, (clave, etiquetas, minimo) in enumerate(minimos or []):
        con_etiqueta = [p for p in por_necesidad.get(clave, []) if etiquetas & p.etiquetas]
        if not con_etiqueta or minimo <= 0:
            continue
        falta = prob.add_variable(f"sin_antojo_{n}", 0, minimo)
        prob += pulp.lpSum(p.contenido * x[p.id] for p in con_etiqueta) + falta >= minimo, f"antojo_{n}"
        sin_basico.append(PESO_PRIORIDAD[NECESIDADES[clave].prioridad] * falta / minimo)

    # Fase 1: minimizar la fracción faltante ponderada por prioridad.
    penalizacion = pulp.lpSum(
        PESO_PRIORIDAD[NECESIDADES[clave].prioridad] * mult * var / demandas[clave]
        for clave in por_necesidad
        for var, (_, mult) in zip(tramos[clave], TRAMOS_FALTANTE)
    ) + pulp.lpSum(sin_basico)
    prob.setObjective(penalizacion)
    _resolver(prob, tiempo_limite)
    mejor = pulp.value(penalizacion) or 0.0

    # Fase 2: misma cobertura (con tolerancia), al menor costo.
    prob += penalizacion <= mejor + TOLERANCIA_FASE_1 * max(1.0, mejor), "cobertura_fase_1"
    libres = [x[p.id] for p in candidatos if p.id not in fijos]
    prob.setObjective(costo + PENALIZACION_PAQUETE * pulp.lpSum(libres))
    estado = _resolver(prob, tiempo_limite)

    holgura = HOLGURA_POR_NIVEL[nivel]
    if holgura > 0 and por_necesidad:
        # Fase 3: con parte del sobrante, subir de marca. La calidad de cada necesidad se mide
        # como cobertura ponderada por nivel y se satura, para que no convenga comprar de más.
        costo_minimo = pulp.value(costo) or 0.0
        prob += costo <= costo_minimo + holgura * (presupuesto - costo_minimo) + 0.01, "tope_de_mejora"
        puntos = CALIDAD_POR_NIVEL[nivel]
        maximo = max(puntos.values())
        calidad = []
        for clave, ps in por_necesidad.items():
            c = prob.add_variable(f"calidad_{clave}", 0, maximo)
            prob += (
                c <= pulp.lpSum(puntos[p.nivel] * p.contenido * x[p.id] for p in ps) / demandas[clave],
                f"calidad_de_{clave}",
            )
            calidad.append(c)
        prob.setObjective(-pulp.lpSum(calidad))
        _resolver(prob, tiempo_limite)
        mejor_calidad = sum(c.value() or 0.0 for c in calidad)

        # Fase 4: esa misma calidad, al menor costo.
        prob += pulp.lpSum(calidad) >= mejor_calidad - 1e-3, "calidad_fase_3"
        prob.setObjective(costo + PENALIZACION_PAQUETE * pulp.lpSum(libres))
        estado = _resolver(prob, tiempo_limite)

    paquetes = {pid: int(round(v.value() or 0)) for pid, v in x.items()}
    paquetes = {pid: n for pid, n in paquetes.items() if n > 0}
    por_id = {p.id: p for p in candidatos}
    cubierto: dict[str, float] = defaultdict(float)
    for pid, n in paquetes.items():
        cubierto[por_id[pid].necesidad] += por_id[pid].contenido * n
    total = sum(por_id[pid].precio * n for pid, n in paquetes.items())
    return ResultadoOptimizacion(paquetes, dict(cubierto), round(total, 2), estado)


def _solver(tiempo_limite: int) -> pulp.LpSolver:
    # HiGHS tiene binarios nativos para Apple Silicon; el CBC que trae PuLP es solo x86.
    # Una brecha de 0.2% es imperceptible en una despensa y evita afinar centavos durante segundos.
    highs = pulp.HiGHS(msg=False, timeLimit=tiempo_limite, gapRel=0.002)
    if highs.available():
        return highs
    return pulp.PULP_CBC_CMD(msg=False, timeLimit=tiempo_limite, gapRel=0.002)


def _resolver(prob: pulp.LpProblem, tiempo_limite: int) -> str:
    prob.solve(_solver(tiempo_limite))
    estado = pulp.LpStatus[prob.status]
    if estado not in ("Optimal", "Not Solved"):
        # Es factible siempre que lo fijado quepa en el presupuesto (planear() lo valida),
        # así que esto indica un bug.
        raise RuntimeError(f"El optimizador terminó en estado inesperado: {estado}")
    return estado
