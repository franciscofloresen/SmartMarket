"""Consultas sobre el catálogo para la app: buscar, alternativas y comparar tiendas."""
import math
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace

from .catalogo import Producto, cargar_catalogo, catalogo_de, filtrar, tiendas_en
from .perfil import Hogar
from .planificador import Ajustes, Plan, planear
from .reglas import NECESIDADES, TIENDAS
from .texto import formas, palabras

MAX_RESULTADOS = 40
MAX_ALTERNATIVAS = 8


def _compatibilidad(hogar: Hogar, catalogo: list[Producto]) -> dict[str, str]:
    """id -> motivo por el que el producto no es compatible con el hogar."""
    _, excluidos = filtrar(catalogo, hogar)
    return {p.id: motivo for p, motivo in excluidos}


def _resumen(p: Producto, motivo: str | None = None) -> dict:
    return {
        "id": p.id,
        "nombre": p.nombre,
        "departamento": p.departamento,
        "necesidad": p.necesidad,
        "categoria": NECESIDADES[p.necesidad].nombre,
        "tipo": p.tipo,
        "nivel": p.nivel,
        "contenido": p.contenido,
        "unidad": p.unidad,
        "precio": p.precio,
        "precio_por_unidad": round(p.precio / p.contenido, 2),
        "fuente_precio": p.fuente_precio,
        "compatible": motivo is None,
        "motivo": motivo,
    }


def buscar(hogar: Hogar, texto: str) -> list[dict]:
    """Productos de la tienda del hogar cuyo nombre o etiquetas contienen todas las palabras."""
    terminos = [formas(t) for t in palabras(texto)]
    if not terminos:
        return []
    catalogo = catalogo_de(hogar)
    incompatibles = _compatibilidad(hogar, catalogo)
    resultados = []
    for p in catalogo:
        tokens = palabras(p.nombre) + [t for e in p.etiquetas for t in palabras(e)]
        formas_tokens = [formas(t) for t in tokens]
        # Cada término debe coincidir con alguna palabra (por forma singular/plural o como prefijo).
        if all(any(f & ft or any(t.startswith(x) for t in ft for x in f) for ft in formas_tokens) for f in terminos):
            resultados.append(p)
    # Primero lo compatible; dentro de eso, lo más barato por unidad.
    resultados.sort(key=lambda p: (p.id in incompatibles, p.necesidad == "extras", p.precio / p.contenido))
    return [_resumen(p, incompatibles.get(p.id)) for p in resultados[:MAX_RESULTADOS]]


def alternativas(hogar: Hogar, producto_id: str, paquetes: int = 1) -> list[dict]:
    """Opciones compatibles para cambiar un producto: mismo tipo primero, luego misma necesidad.

    Cada opción indica cuántos paquetes equivalen a los `paquetes` del original y la diferencia de costo.
    """
    catalogo = catalogo_de(hogar)
    original = next((p for p in catalogo if p.id == producto_id), None)
    if original is None or original.necesidad == "extras":
        return []
    aptos, _ = filtrar(catalogo, hogar)
    candidatos = [p for p in aptos if p.necesidad == original.necesidad and p.id != original.id]
    candidatos.sort(key=lambda p: (p.tipo != original.tipo, p.precio / p.contenido))
    cantidad = original.contenido * max(1, paquetes)
    opciones = []
    for p in candidatos[:MAX_ALTERNATIVAS]:
        equivalentes = max(1, math.ceil(cantidad / p.contenido - 1e-9))
        opciones.append({
            **_resumen(p),
            "paquetes_equivalentes": equivalentes,
            "diferencia": round(equivalentes * p.precio - max(1, paquetes) * original.precio, 2),
            "mismo_tipo": p.tipo == original.tipo,
        })
    return opciones


def comparar_tiendas(hogar: Hogar, ajustes: Ajustes | None = None, tiempo_limite: int = 10) -> list[dict]:
    """La misma despensa en cada tienda con sucursales en el estado del hogar, de la más barata a la más cara.

    Los productos fijados solo se respetan en la tienda del hogar: en otra tienda pueden no existir.
    """
    ajustes = ajustes or Ajustes()

    def calcular(tienda: str) -> dict:
        nombre = TIENDAS[tienda]
        h = replace(hogar, tienda=tienda)
        catalogo = cargar_catalogo(tienda, hogar.estado)
        ids = {p.id for p in catalogo}
        propios = Ajustes(
            excluir_productos=set(ajustes.excluir_productos),
            fijar={pid: n for pid, n in ajustes.fijar.items() if pid in ids} if tienda == hogar.tienda else {},
            en_casa=dict(ajustes.en_casa),
        )
        plan: Plan = planear(h, catalogo, propios, tiempo_limite)
        esenciales = [c.porcentaje for c in plan.cobertura if c.prioridad == 1]
        return {
            "clave": tienda,
            "tienda": nombre,
            "total": plan.total,
            "productos": len(plan.lineas),
            "cobertura_completa": all(c.porcentaje >= 95 for c in plan.cobertura),
            "cobertura_esencial_minima": round(min(esenciales, default=100.0), 1),
            "actual": tienda == hogar.tienda,
        }

    # El solver suelta el GIL mientras resuelve, así que las tiendas se calculan en paralelo.
    cercanas = tiendas_en(hogar.estado)
    tiendas = [t for t in TIENDAS if t in cercanas or t == hogar.tienda]
    with ThreadPoolExecutor(max_workers=len(tiendas)) as ejecutor:
        filas = list(ejecutor.map(calcular, tiendas))
    # Con cobertura incompleta el total no es comparable: esas tiendas van al final.
    filas.sort(key=lambda f: (not f["cobertura_completa"], f["total"]))
    return filas
