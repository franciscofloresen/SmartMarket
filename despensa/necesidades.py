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


_NOMBRES_GRUPO = {
    reglas.BEBE: ("bebé", "bebés"),
    reglas.NINO: ("niño", "niños"),
    reglas.ADOLESCENTE: ("adolescente", "adolescentes"),
    reglas.ADULTO: ("adulto", "adultos"),
    reglas.MAYOR: ("adulto mayor", "adultos mayores"),
}


def _cantidad(valor: float, unidad: str) -> str:
    return f"{valor:.1f}".rstrip("0").rstrip(".") + f" {unidad}"


def explicar_necesidades(hogar: Hogar) -> dict[str, str]:
    """Por qué se pide cada cantidad, en palabras: '2 adultos × 7 L + 2 niños × 12 L al mes'."""
    grupos: dict[str, int] = defaultdict(int)
    for m in hogar.miembros:
        grupos[m.grupo] += 1
    textos: dict[str, str] = {}

    for clave, nec in reglas.NECESIDADES.items():
        partes = []
        if nec.base_hogar:
            partes.append(f"{_cantidad(nec.base_hogar, nec.unidad)} por hogar")
        for grupo in _NOMBRES_GRUPO:  # orden fijo: de bebés a mayores
            n, por_persona = grupos.get(grupo, 0), nec.por_persona.get(grupo, 0.0)
            if n and por_persona:
                singular, plural = _NOMBRES_GRUPO[grupo]
                partes.append(f"{n} {singular if n == 1 else plural} × {_cantidad(por_persona, nec.unidad)}")
        if partes:
            textos[clave] = " + ".join(partes) + " al mes"

    edad_min, edad_max = reglas.EDAD_TOALLAS_FEMENINAS
    mujeres = sum(1 for m in hogar.miembros if m.sexo == "F" and edad_min <= m.edad <= edad_max)
    if mujeres:
        textos["toallas_femeninas"] = f"{mujeres} × {reglas.TOALLAS_FEMENINAS_MES} piezas al mes"
    en_panal = [m for m in hogar.miembros if m.edad in reglas.PANALES_MES_POR_EDAD]
    if en_panal:
        textos["panales"] = " + ".join(
            f"{reglas.PANALES_MES_POR_EDAD[m.edad] // 30} al día ({m.edad} {'año' if m.edad == 1 else 'años'})" for m in en_panal
        )
        textos["toallitas_humedas"] = f"{len(en_panal)} × {reglas.TOALLITAS_MES} piezas al mes"
    perros = [m for m in hogar.mascotas if m.tipo == "perro"]
    if perros:
        textos["croquetas_perro"] = " + ".join(
            f"perro {m.tamano}: {int(reglas.CROQUETAS_PERRO_DIA[m.tamano] * 1000)} g al día" for m in perros
        )
    gatos = len(hogar.mascotas) - len(perros)
    if gatos:
        textos["croquetas_gato"] = f"{gatos} × {int(reglas.CROQUETAS_GATO_DIA * 1000)} g al día"
        textos["arena_gato"] = f"{gatos} × {_cantidad(reglas.ARENA_GATO_MES, 'kg')} al mes"

    if hogar.periodo_dias != 30:
        textos = {k: f"{v}, ajustado a {hogar.periodo_dias} días" for k, v in textos.items()}
    return textos
