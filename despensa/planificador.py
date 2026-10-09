"""Orquesta el flujo completo: perfil -> necesidades -> filtrado -> optimización -> plan."""
import math
from dataclasses import asdict, dataclass, field

from .catalogo import Producto, filtrar
from .necesidades import aplicar_sustitutos, calcular_necesidades
from .optimizador import optimizar
from .perfil import Hogar
from .reglas import NECESIDADES

# Máximo de visitas sugeridas para productos frescos dentro del periodo.
MAX_VISITAS = 4


@dataclass
class LineaCompra:
    producto: Producto
    paquetes: int
    # Visitas en que conviene repartir la compra (frescos que no se congelan).
    visitas: int

    @property
    def subtotal(self) -> float:
        return round(self.producto.precio * self.paquetes, 2)


@dataclass
class CoberturaNecesidad:
    clave: str
    nombre: str
    unidad: str
    prioridad: int
    requerido: float
    cubierto: float

    @property
    def porcentaje(self) -> float:
        return 100.0 * self.cubierto / self.requerido if self.requerido else 100.0


@dataclass
class Plan:
    hogar: Hogar
    lineas: list[LineaCompra]
    cobertura: list[CoberturaNecesidad]
    excluidos: list[tuple[Producto, str]]
    notas: list[str] = field(default_factory=list)

    @property
    def total(self) -> float:
        return round(sum(l.subtotal for l in self.lineas), 2)

    @property
    def sobrante(self) -> float:
        return round(self.hogar.presupuesto - self.total, 2)

    def a_dict(self) -> dict:
        """Representación JSON-serializable, pensada para la futura API/app."""
        return {
            "hogar": asdict(self.hogar),
            "presupuesto": self.hogar.presupuesto,
            "total": self.total,
            "sobrante": self.sobrante,
            "lineas": [
                {
                    "id": l.producto.id,
                    "nombre": l.producto.nombre,
                    "departamento": l.producto.departamento,
                    "necesidad": l.producto.necesidad,
                    "paquetes": l.paquetes,
                    "precio_unitario": l.producto.precio,
                    "subtotal": l.subtotal,
                    "visitas": l.visitas,
                }
                for l in self.lineas
            ],
            "cobertura": [
                {**asdict(c), "porcentaje": round(c.porcentaje, 1)} for c in self.cobertura
            ],
            "excluidos": [{"id": p.id, "nombre": p.nombre, "motivo": m} for p, m in self.excluidos],
            "notas": self.notas,
        }


def _visitas(producto: Producto, periodo_dias: int) -> int:
    if producto.congelable or producto.vida_util_dias >= periodo_dias:
        return 1
    return min(MAX_VISITAS, math.ceil(periodo_dias / producto.vida_util_dias))


def planear(hogar: Hogar, catalogo: list[Producto], tiempo_limite: int = 30) -> Plan:
    demandas = calcular_necesidades(hogar)
    aptos, excluidos = filtrar(catalogo, hogar)

    con_opciones = {p.necesidad for p in aptos}
    sin_opciones = {clave for clave in demandas if clave not in con_opciones}
    demandas, notas = aplicar_sustitutos(demandas, sin_opciones)
    # Un sustituto puede no tener tampoco opciones; esos se reportan pero no se optimizan.
    demandas = {k: v for k, v in demandas.items() if k in con_opciones}

    resultado = optimizar(aptos, demandas, hogar.presupuesto, tiempo_limite)
    if resultado.estado != "Optimal":
        notas.append("El optimizador alcanzó el tiempo límite; la lista es buena pero puede no ser la óptima.")

    por_id = {p.id: p for p in aptos}
    lineas = [
        LineaCompra(por_id[pid], n, _visitas(por_id[pid], hogar.periodo_dias))
        for pid, n in resultado.paquetes.items()
    ]
    lineas.sort(key=lambda l: (l.producto.departamento, l.producto.necesidad, l.producto.nombre))

    cobertura = []
    for clave, requerido in demandas.items():
        nec = NECESIDADES[clave]
        cobertura.append(
            CoberturaNecesidad(clave, nec.nombre, nec.unidad, nec.prioridad, requerido, resultado.cubierto.get(clave, 0.0))
        )
    cobertura.sort(key=lambda c: (c.prioridad, c.nombre))

    faltantes = [c for c in cobertura if c.porcentaje < 95]
    if faltantes:
        notas.append(
            "El presupuesto no alcanza para cubrir todo; se priorizó lo esencial. "
            f"Quedan por debajo del 95%: {', '.join(c.nombre for c in faltantes)}."
        )
    return Plan(hogar, lineas, cobertura, excluidos, notas)
