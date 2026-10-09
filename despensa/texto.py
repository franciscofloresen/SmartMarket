"""Utilidades de texto: normalización sin acentos y comparación tolerante a plurales."""
import re
import unicodedata


def normalizar(texto: str) -> str:
    """Minúsculas, sin acentos (ñ -> n) y espacios simples."""
    sin_acentos = unicodedata.normalize("NFKD", texto)
    sin_acentos = "".join(c for c in sin_acentos if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", sin_acentos.lower()).strip()


def formas(palabra: str) -> set[str]:
    """Variantes singular/plural de una palabra normalizada (limones -> limon, papas -> papa)."""
    resultado = {palabra}
    if palabra.endswith("es") and len(palabra) > 4:
        resultado.add(palabra[:-2])
    if palabra.endswith("s") and len(palabra) > 3:
        resultado.add(palabra[:-1])
    return resultado


def palabras(texto: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", normalizar(texto))
