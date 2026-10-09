"""Convierte el perfil del hogar en cantidades necesarias para el periodo."""
from collections import defaultdict

from . import reglas
from .perfil import Hogar


def calcular_necesidades(hogar: Hogar) -> dict[str, float]:
    """Cantidad requerida por necesidad (en su unidad) para el periodo del hogar."""
    mensual: dict[str, float] = defaultdict(float)

    for clave, nec in reglas.NECESIDADES.items():
        mensual[clave] += nec.base_hogar
        for m in hogar.miembros:
            mensual[clave] += nec.por_persona.get(m.grupo, 0.0)

    edad_min, edad_max = reglas.EDAD_TOALLAS_FEMENINAS
    for m in hogar.miembros:
        if m.sexo == "F" and edad_min <= m.edad <= edad_max:
            mensual["toallas_femeninas"] += reglas.TOALLAS_FEMENINAS_MES
        if m.edad in reglas.PANALES_MES_POR_EDAD:
            mensual["panales"] += reglas.PANALES_MES_POR_EDAD[m.edad]
            mensual["toallitas_humedas"] += reglas.TOALLITAS_MES

    for mascota in hogar.mascotas:
        if mascota.tipo == "perro":
            mensual["croquetas_perro"] += reglas.CROQUETAS_PERRO_DIA[mascota.tamano] * 30
        else:
            mensual["croquetas_gato"] += reglas.CROQUETAS_GATO_DIA * 30
            mensual["arena_gato"] += reglas.ARENA_GATO_MES

    escala = hogar.periodo_dias / 30
    return {clave: round(cant * escala, 3) for clave, cant in mensual.items() if cant > 0}


def aplicar_sustitutos(demandas: dict[str, float], sin_opciones: set[str]) -> tuple[dict[str, float], list[str]]:
    """Pasa la cantidad de necesidades sin productos compatibles a sus sustitutos.

    Devuelve las demandas ajustadas (sin las necesidades imposibles) y notas legibles.
    """
    ajustadas = {k: v for k, v in demandas.items() if k not in sin_opciones}
    notas = []
    for clave in sorted(sin_opciones):
        if clave not in demandas:
            continue
        nombre = reglas.NECESIDADES[clave].nombre
        destinos = [
            (dest, frac, factor)
            for dest, frac, factor in reglas.SUSTITUTOS.get(clave, [])
            if dest not in sin_opciones
        ]
        if not destinos:
            notas.append(f"{nombre}: no hay productos compatibles con sus restricciones; no se incluye.")
            continue
        # Reparte entre los sustitutos disponibles, reescalando las fracciones a 1.
        total_frac = sum(frac for _, frac, _ in destinos)
        textos = []
        for dest, frac, factor in destinos:
            extra = demandas[clave] * (frac / total_frac) * factor
            ajustadas[dest] = round(ajustadas.get(dest, 0.0) + extra, 3)
            nec = reglas.NECESIDADES[dest]
            textos.append(f"+{extra:.1f} {nec.unidad} de {nec.nombre.lower()}")
        notas.append(f"{nombre}: sin productos compatibles, se sustituye con {', '.join(textos)}.")
    return ajustadas, notas
