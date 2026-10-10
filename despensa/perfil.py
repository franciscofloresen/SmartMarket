"""Perfil del hogar: quiénes viven, mascotas, restricciones y presupuesto."""
import json
from dataclasses import dataclass, field
from pathlib import Path

from .reglas import ALIAS_ALERGENOS, CROQUETAS_PERRO_DIA, DIETAS, TIENDA_DEFAULT, TIENDAS, grupo_edad
from .texto import normalizar


class PerfilInvalido(ValueError):
    pass


@dataclass
class Miembro:
    edad: int
    sexo: str | None = None  # "F" o "M"
    nombre: str = ""

    @property
    def grupo(self) -> str:
        return grupo_edad(self.edad)


@dataclass
class Mascota:
    tipo: str  # "perro" o "gato"
    tamano: str = "mediano"  # solo perros: chico, mediano, grande, gigante
    nombre: str = ""


@dataclass
class Hogar:
    miembros: list[Miembro]
    presupuesto: float
    periodo_dias: int = 30
    mascotas: list[Mascota] = field(default_factory=list)
    alergias: list[str] = field(default_factory=list)  # normalizadas a su nombre canónico
    excluir: list[str] = field(default_factory=list)   # alimentos que no se quieren
    dieta: str | None = None
    # Si hacen tortillas en casa, la harina de maíz cuenta como tortilla.
    tortillas_caseras: bool = False
    tienda: str = TIENDA_DEFAULT
    # Estado de la República para usar precios locales; None = mediana nacional.
    estado: str | None = None
    nombre: str = ""

    @property
    def terminos_excluidos(self) -> list[str]:
        """Exclusiones del usuario más las etiquetas que excluye su dieta."""
        return self.excluir + DIETAS.get(self.dieta or "", [])


def hogar_desde_dict(datos: dict) -> Hogar:
    try:
        miembros = [
            Miembro(int(m["edad"]), (m.get("sexo") or "").upper() or None, m.get("nombre", ""))
            for m in datos["miembros"]
        ]
        presupuesto = float(datos["presupuesto"])
    except (KeyError, TypeError, ValueError) as e:
        raise PerfilInvalido(f"Faltan 'miembros' (con 'edad') o 'presupuesto' válidos: {e}") from e

    if not miembros:
        raise PerfilInvalido("El hogar necesita al menos un miembro.")
    for m in miembros:
        if not 0 <= m.edad <= 120:
            raise PerfilInvalido(f"Edad fuera de rango: {m.edad}")
        if m.sexo not in (None, "F", "M"):
            raise PerfilInvalido(f"Sexo debe ser 'F' o 'M': {m.sexo}")
    if presupuesto <= 0:
        raise PerfilInvalido("El presupuesto debe ser mayor a 0.")

    periodo = int(datos.get("periodo_dias", 30))
    if not 1 <= periodo <= 62:
        raise PerfilInvalido("periodo_dias debe estar entre 1 y 62.")

    mascotas = []
    for m in datos.get("mascotas", []):
        tipo = normalizar(m.get("tipo", ""))
        tamano = normalizar(m.get("tamano", "mediano"))
        if tipo not in ("perro", "gato"):
            raise PerfilInvalido(f"Tipo de mascota no soportado: {m.get('tipo')} (usa perro o gato)")
        if tipo == "perro" and tamano not in CROQUETAS_PERRO_DIA:
            raise PerfilInvalido(f"Tamaño de perro inválido: {tamano} (usa {', '.join(CROQUETAS_PERRO_DIA)})")
        mascotas.append(Mascota(tipo, tamano, m.get("nombre", "")))

    alergias = []
    for a in datos.get("alergias", []):
        canonica = ALIAS_ALERGENOS.get(normalizar(a))
        if canonica is None:
            raise PerfilInvalido(
                f"Alergia no reconocida: {a}. Reconocidas: {', '.join(sorted(set(ALIAS_ALERGENOS.values())))}"
            )
        alergias.append(canonica)

    dieta = datos.get("dieta")
    if dieta is not None:
        dieta = normalizar(dieta).replace(" ", "_")
        if dieta not in DIETAS:
            raise PerfilInvalido(f"Dieta no reconocida: {dieta}. Opciones: {', '.join(DIETAS)}")

    tienda = datos.get("tienda") or TIENDA_DEFAULT
    if tienda not in TIENDAS:
        raise PerfilInvalido(f"Tienda no reconocida: {tienda}. Opciones: {', '.join(TIENDAS)}")
    estado = (datos.get("estado") or "").strip() or None

    return Hogar(
        miembros=miembros,
        presupuesto=presupuesto,
        periodo_dias=periodo,
        mascotas=mascotas,
        alergias=sorted(set(alergias)),
        excluir=[normalizar(e) for e in datos.get("excluir", [])],
        dieta=dieta,
        tortillas_caseras=bool(datos.get("tortillas_caseras", False)),
        tienda=tienda,
        estado=estado,
        nombre=datos.get("nombre", ""),
    )


def cargar_hogar(ruta: str | Path) -> Hogar:
    with open(ruta, encoding="utf-8") as f:
        return hogar_desde_dict(json.load(f))
