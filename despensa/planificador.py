"""Orquesta el flujo completo: perfil -> necesidades -> filtrado -> optimización -> plan."""
import math
from dataclasses import asdict, dataclass, field

from .catalogo import Producto, filtrar
from .necesidades import aplicar_sustitutos, calcular_antojos, calcular_necesidades, explicar_necesidades
from .optimizador import optimizar
from .perfil import Hogar
from .reglas import ANTOJOS, NECESIDADES

# Máximo de visitas sugeridas para productos frescos dentro del periodo.
MAX_VISITAS = 4
MOTIVO_QUITADO = "quitado por ti"


class AjusteInvalido(ValueError):
    pass


@dataclass
class Ajustes:
    """Cambios del usuario sobre una lista ya generada, para recalcularla."""
    excluir_productos: set[str] = field(default_factory=set)
    fijar: dict[str, int] = field(default_factory=dict)  # id -> paquetes
    # Lo que ya hay en casa: necesidad -> fracción del periodo que ya está cubierta (0 a 1).
    en_casa: dict[str, float] = field(default_factory=dict)


@dataclass
class LineaCompra:
    producto: Producto
    paquetes: int
    # Visitas en que conviene repartir la compra (frescos que no se congelan).
    visitas: int
    fijado: bool = False

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
    explicacion: str = ""   # por qué esa cantidad
    en_casa: float = 0.0    # fracción que el hogar dijo tener ya

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
    consejos: list[str] = field(default_factory=list)
    # Lo que costaría cubrir todo al menor precio; solo se calcula si el presupuesto no alcanzó.
    costo_completo: float | None = None

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
                    "tipo": l.producto.tipo,
                    "nivel": l.producto.nivel,
                    "contenido": l.producto.contenido,
                    "unidad": l.producto.unidad,
                    "paquetes": l.paquetes,
                    "precio_unitario": l.producto.precio,
                    "subtotal": l.subtotal,
                    "visitas": l.visitas,
                    "fijado": l.fijado,
                    "fuente_precio": l.producto.fuente_precio,
                    "fecha_precio": l.producto.fecha_precio,
                }
                for l in self.lineas
            ],
            "cobertura": [
                {**asdict(c), "porcentaje": round(c.porcentaje, 1)} for c in self.cobertura
            ],
            "excluidos": [{"id": p.id, "nombre": p.nombre, "motivo": m} for p, m in self.excluidos],
            "notas": self.notas,
            "consejos": self.consejos,
            "costo_completo": self.costo_completo,
        }


def _visitas(producto: Producto, periodo_dias: int) -> int:
    if producto.congelable or producto.vida_util_dias >= periodo_dias:
        return 1
    return min(MAX_VISITAS, math.ceil(periodo_dias / producto.vida_util_dias))


def _validar_ajustes(ajustes: Ajustes, catalogo: list[Producto], aptos: list[Producto], presupuesto: float) -> None:
    por_id = {p.id: p for p in catalogo}
    aptos_ids = {p.id for p in aptos}
    # Los ids quitados que no existen se ignoran: vienen de gustos guardados con otra tienda.
    desconocidos = sorted(ajustes.fijar.keys() - por_id.keys())
    if desconocidos:
        raise AjusteInvalido(f"Productos que no existen en el catálogo: {', '.join(desconocidos)}")
    for pid, n in ajustes.fijar.items():
        if n < 0:
            raise AjusteInvalido(f"La cantidad fijada de {por_id[pid].nombre} no puede ser negativa.")
        if pid not in aptos_ids:
            raise AjusteInvalido(f"{por_id[pid].nombre} no es compatible con las restricciones del hogar.")
    for clave, fraccion in ajustes.en_casa.items():
        if clave not in NECESIDADES or not 0 <= fraccion <= 1:
            raise AjusteInvalido(f"'Ya tengo en casa' inválido: {clave}={fraccion}")
    costo_fijo = sum(por_id[pid].precio * n for pid, n in ajustes.fijar.items())
    if costo_fijo > presupuesto:
        raise AjusteInvalido(
            f"Los productos fijados suman ${costo_fijo:,.2f} y superan el presupuesto de ${presupuesto:,.2f}."
        )


def planear(
    hogar: Hogar, catalogo: list[Producto], ajustes: Ajustes | None = None, tiempo_limite: int = 30
) -> Plan:
    ajustes = ajustes or Ajustes()
    demandas = calcular_necesidades(hogar)
    aptos, excluidos = filtrar(catalogo, hogar)
    _validar_ajustes(ajustes, catalogo, aptos, hogar.presupuesto)

    # Fijar 0 paquetes equivale a quitar el producto; fijar manda sobre quitar.
    quitados = (ajustes.excluir_productos | {pid for pid, n in ajustes.fijar.items() if n == 0})
    fijos = {pid: n for pid, n in ajustes.fijar.items() if n > 0}
    quitados -= fijos.keys()
    excluidos += [(p, MOTIVO_QUITADO) for p in aptos if p.id in quitados]
    aptos = [p for p in aptos if p.id not in quitados]

    # Antojos: se suman a la demanda de su necesidad y deben venir de productos de ese tipo.
    notas: list[str] = []
    minimos: dict[str, float] = {}
    for clave, cantidad in calcular_antojos(hogar).items():
        antojo = ANTOJOS[clave]
        if any(p.necesidad == antojo.necesidad and antojo.etiquetas & p.etiquetas for p in aptos):
            demandas[antojo.necesidad] = round(demandas.get(antojo.necesidad, 0.0) + cantidad, 3)
            minimos[clave] = cantidad
        else:
            notas.append(f"{antojo.nombre}: no hay productos compatibles con sus restricciones; no se incluye.")

    con_opciones = {p.necesidad for p in aptos}
    sin_opciones = {clave for clave in demandas if clave not in con_opciones}
    demandas, notas_sustitutos = aplicar_sustitutos(demandas, sin_opciones)
    notas += notas_sustitutos
    # Un sustituto puede no tener tampoco opciones; esos se reportan pero no se optimizan.
    demandas = {k: v for k, v in demandas.items() if k in con_opciones}

    # Lo que ya hay en casa se descuenta; con 100% la necesidad sale de la lista.
    en_casa = {k: f for k, f in ajustes.en_casa.items() if k in demandas and f > 0}
    demandas = {k: round(v * (1 - en_casa.get(k, 0.0)), 3) for k, v in demandas.items()}
    demandas = {k: v for k, v in demandas.items() if v > 0}
    minimos_antojos = [
        (ANTOJOS[clave].necesidad, ANTOJOS[clave].etiquetas, round(cantidad * (1 - en_casa.get(ANTOJOS[clave].necesidad, 0.0)), 3))
        for clave, cantidad in minimos.items()
        if ANTOJOS[clave].necesidad in demandas
    ]

    resultado = optimizar(aptos, demandas, hogar.presupuesto, tiempo_limite, fijos, hogar.nivel, minimos_antojos)
    if resultado.estado != "Optimal":
        notas.append("El optimizador alcanzó el tiempo límite; la lista es buena pero puede no ser la óptima.")

    por_id = {p.id: p for p in aptos}
    lineas = [
        LineaCompra(por_id[pid], n, _visitas(por_id[pid], hogar.periodo_dias), pid in fijos)
        for pid, n in resultado.paquetes.items()
    ]
    lineas.sort(key=lambda l: (l.producto.departamento, l.producto.necesidad, l.producto.nombre))

    explicaciones = explicar_necesidades(hogar, set(minimos))
    cobertura = []
    for clave, requerido in demandas.items():
        nec = NECESIDADES[clave]
        cobertura.append(
            CoberturaNecesidad(
                clave, nec.nombre, nec.unidad, nec.prioridad, requerido, resultado.cubierto.get(clave, 0.0),
                explicaciones.get(clave, ""), en_casa.get(clave, 0.0),
            )
        )
    cobertura.sort(key=lambda c: (c.prioridad, c.nombre))

    faltantes = [c for c in cobertura if c.porcentaje < 95]
    if faltantes:
        notas.append(
            "El presupuesto no alcanza para cubrir todo; se priorizó lo esencial. "
            f"Quedan por debajo del 95%: {', '.join(c.nombre for c in faltantes)}."
        )
    plan = Plan(hogar, lineas, cobertura, excluidos, notas)
    _aconsejar(plan, bool(faltantes), aptos, demandas, fijos, tiempo_limite, minimos_antojos)
    return plan


def _pesos(valor: float) -> str:
    """Pesos enteros, redondeando .5 hacia arriba como lo hace la app (no al par, como Python)."""
    return f"{math.floor(valor + 0.5):,}"


def _redondear_arriba(valor: float, multiplo: int = 50) -> int:
    return int(math.ceil(valor / multiplo) * multiplo)


def _aconsejar(plan: Plan, falta_cobertura: bool, aptos, demandas, fijos, tiempo_limite: int, minimos=None) -> None:
    """Consejos sobre el presupuesto: cuánto falta para cubrir todo, o cuánto se puede bajar."""
    presupuesto = plan.hogar.presupuesto
    if falta_cobertura:
        completo = optimizar(aptos, demandas, 10 * presupuesto + 100_000, tiempo_limite, fijos, "ahorro", minimos)
        plan.costo_completo = completo.costo
        extra = _redondear_arriba(completo.costo - presupuesto)
        if extra > 0:
            plan.consejos.append(
                f"Con ${extra:,} más (${_redondear_arriba(completo.costo):,} en total) cubrirías todo lo que tu hogar necesita."
            )
    elif plan.sobrante >= 0.1 * presupuesto:
        if plan.hogar.nivel == "ahorro":
            plan.consejos.append(
                f"Te sobran ${_pesos(plan.sobrante)}. Puedes subir a marcas de nivel equilibrado "
                f"o bajar tu presupuesto a ${_redondear_arriba(plan.total, 100):,}."
            )
        else:
            plan.consejos.append(
                f"Te sobran ${_pesos(plan.sobrante)}: podrías bajar tu presupuesto a ${_redondear_arriba(plan.total, 100):,}."
            )
