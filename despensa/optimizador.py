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
from .reglas import NECESIDADES, PESO_BASICO, PESO_PRIORIDAD

# Se permite comprar hasta 25% de más, más un paquete del producto más grande disponible,
# porque se vende en paquetes enteros (1 kg de sal aunque se usen 400 g). Comprar de más
# solo ocurre si sale más barato en total, porque la fase 2 minimiza el costo.
EXCESO_PERMITIDO = 0.25
TOLERANCIA_FASE_1 = 1e-4
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
) -> ResultadoOptimizacion:
    por_necesidad: dict[str, list[Producto]] = defaultdict(list)
    for p in productos:
        if demandas.get(p.necesidad, 0) > 0:
            por_necesidad[p.necesidad].append(p)
    candidatos = [p for ps in por_necesidad.values() for p in ps]

    topes: dict[str, float] = {}
    for clave, ps in por_necesidad.items():
        topes[clave] = demandas[clave] * (1 + EXCESO_PERMITIDO) + max(p.contenido for p in ps)

    prob = pulp.LpProblem("despensa", pulp.LpMinimize)
    x = {
        p.id: prob.add_variable(f"x_{p.id}", 0, math.floor(topes[p.necesidad] / p.contenido), cat="Integer")
        for p in candidatos
    }
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
                prob += p.contenido * x[p.id] <= variedad * demandas[clave] + p.contenido, f"variedad_{p.id}"

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
    prob.setObjective(costo)
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
    highs = pulp.HiGHS(msg=False, timeLimit=tiempo_limite)
    if highs.available():
        return highs
    return pulp.PULP_CBC_CMD(msg=False, timeLimit=tiempo_limite)


def _resolver(prob: pulp.LpProblem, tiempo_limite: int) -> str:
    prob.solve(_solver(tiempo_limite))
    estado = pulp.LpStatus[prob.status]
    if estado not in ("Optimal", "Not Solved"):
        # El problema siempre es factible (comprar nada cumple todo), así que esto indica un bug.
        raise RuntimeError(f"El optimizador terminó en estado inesperado: {estado}")
    return estado
