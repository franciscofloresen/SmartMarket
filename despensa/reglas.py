"""Reglas de consumo del hogar.

Todas las cantidades son POR MES (30 días) y se escalan al periodo del perfil.
Son valores de referencia aproximados para un hogar mexicano promedio; ajústalos
aquí sin tocar el resto del código.
"""
from dataclasses import dataclass, field

# Grupos de edad usados en las tablas de consumo.
BEBE, NINO, ADOLESCENTE, ADULTO, MAYOR = "bebe", "nino", "adolescente", "adulto", "mayor"


def grupo_edad(edad: int) -> str:
    if edad < 2:
        return BEBE
    if edad <= 12:
        return NINO
    if edad <= 17:
        return ADOLESCENTE
    if edad <= 59:
        return ADULTO
    return MAYOR


def por_edad(bebe: float, nino: float, adolescente: float, adulto: float, mayor: float) -> dict[str, float]:
    return {BEBE: bebe, NINO: nino, ADOLESCENTE: adolescente, ADULTO: adulto, MAYOR: mayor}


@dataclass(frozen=True)
class Necesidad:
    clave: str
    nombre: str
    unidad: str
    # 1 = esencial, 2 = importante, 3 = opcional. Con presupuesto corto se recorta primero lo opcional.
    prioridad: int
    # Consumo mensual por persona según grupo de edad.
    por_persona: dict[str, float] = field(default_factory=dict)
    # Consumo mensual fijo del hogar, sin importar cuántos sean.
    base_hogar: float = 0.0
    # Máxima fracción de la necesidad que puede cubrir un solo producto (fuerza variedad).
    variedad_max: float = 1.0
    # Básicos que no deben faltar: etiqueta de producto -> fracción mínima de la necesidad
    # (ej. jitomate >= 20% de las verduras). Solo aplica si hay productos compatibles.
    basicos: dict[str, float] = field(default_factory=dict)


_NECESIDADES = [
    # --- Alimentos ---
    Necesidad("carne_aves", "Carnes y aves", "kg", 1, por_edad(0.5, 2.5, 4.5, 4.0, 3.2), variedad_max=0.45,
              basicos={"pollo": 0.3, "res": 0.15}),
    Necesidad("huevo", "Huevo", "pz", 1, por_edad(6, 18, 28, 25, 22)),
    Necesidad("leche", "Leche", "L", 1, por_edad(0, 12, 10, 7, 6)),
    Necesidad("queso_yogur", "Quesos, yogur y crema", "kg", 2, por_edad(0.8, 2.0, 2.0, 1.8, 1.5), variedad_max=0.6,
              basicos={"queso": 0.2}),
    Necesidad("leguminosas", "Leguminosas (frijol, lenteja...)", "kg", 1, por_edad(0.2, 0.7, 1.3, 1.2, 1.0), variedad_max=0.7,
              basicos={"frijol": 0.6}),
    Necesidad("tortilla_pan", "Tortilla y pan", "kg", 1, por_edad(0.3, 3.5, 7.0, 6.5, 5.0), variedad_max=0.75,
              basicos={"tortilla": 0.6, "pan": 0.1}),
    Necesidad("arroz_pasta", "Arroz y pasta", "kg", 1, por_edad(0.3, 1.0, 1.5, 1.3, 1.0), variedad_max=0.7,
              basicos={"arroz": 0.4, "pasta": 0.2}),
    Necesidad("cereal_desayuno", "Cereal y avena", "kg", 2, por_edad(0.3, 1.0, 1.0, 0.6, 0.6), variedad_max=0.7),
    Necesidad("frutas", "Frutas", "kg", 1, por_edad(3.0, 6.0, 8.0, 7.5, 7.0), variedad_max=0.35,
              basicos={"platano": 0.2, "limon": 0.05}),
    Necesidad("verduras", "Verduras", "kg", 1, por_edad(2.0, 5.0, 9.0, 9.0, 8.5), variedad_max=0.25,
              basicos={"jitomate": 0.2, "cebolla": 0.1, "papa": 0.12, "chile": 0.03}),
    Necesidad("aceite", "Aceite", "L", 1, por_edad(0, 0.4, 0.8, 0.75, 0.6)),
    Necesidad("azucar", "Azúcar y endulzantes", "kg", 2, por_edad(0, 0.6, 0.9, 0.9, 0.6)),
    Necesidad("cafe_te", "Café y té", "kg", 2, por_edad(0, 0, 0, 0.25, 0.25)),
    Necesidad("enlatados_salsas", "Enlatados, salsas y aderezos", "kg", 2, por_edad(0, 0.5, 1.0, 1.0, 0.8), variedad_max=0.5),
    Necesidad("condimentos", "Sal, consomé y especias", "kg", 2, por_edad(0, 0.06, 0.12, 0.12, 0.12), variedad_max=0.6,
              basicos={"sal": 0.2, "consome": 0.1}),
    Necesidad("botanas_galletas", "Botanas y galletas", "kg", 3, por_edad(0.2, 1.0, 1.2, 0.8, 0.5), variedad_max=0.6),
    Necesidad("bebidas", "Jugos y refrescos", "L", 3, por_edad(0, 5, 7, 6, 4)),
    # --- Limpieza del hogar ---
    Necesidad("papel_higienico", "Papel higiénico", "rollo", 1, por_edad(1, 5, 5, 5, 5)),
    Necesidad("servitoallas", "Toallas de papel", "rollo", 2, por_edad(0, 0.3, 0.3, 0.3, 0.3), base_hogar=2),
    Necesidad("jabon_trastes", "Lavatrastes", "L", 1, por_edad(0.1, 0.15, 0.15, 0.15, 0.15), base_hogar=0.5),
    Necesidad("detergente_ropa", "Detergente para ropa", "kg", 1, por_edad(1.0, 0.8, 0.8, 0.8, 0.8), base_hogar=1),
    Necesidad("suavizante", "Suavizante", "L", 3, por_edad(0.3, 0.3, 0.3, 0.3, 0.3), base_hogar=0.5),
    Necesidad("limpieza_hogar", "Limpiadores y cloro", "L", 2, por_edad(0.4, 0.4, 0.4, 0.4, 0.4), base_hogar=2, variedad_max=0.7,
              basicos={"cloro": 0.3, "limpiador": 0.3}),
    Necesidad("bolsas_basura", "Bolsas para basura", "pz", 2, por_edad(4, 4, 4, 4, 4), base_hogar=12),
    # --- Higiene personal ---
    Necesidad("jabon_corporal", "Jabón de baño", "pz", 1, por_edad(0.5, 1, 1, 1, 1)),
    Necesidad("shampoo", "Shampoo", "L", 2, por_edad(0.05, 0.15, 0.2, 0.2, 0.2)),
    Necesidad("pasta_dental", "Pasta dental (piezas de ~100 ml)", "pz", 1, por_edad(0.2, 0.5, 0.5, 0.5, 0.5)),
    Necesidad("desodorante", "Desodorante", "pz", 2, por_edad(0, 0, 0.6, 0.6, 0.6)),
    # Reglas especiales (calculadas en necesidades.py): sin consumo por tabla.
    Necesidad("toallas_femeninas", "Toallas femeninas", "pz", 1),
    Necesidad("panales", "Pañales", "pz", 1),
    Necesidad("toallitas_humedas", "Toallitas húmedas", "pz", 2),
    Necesidad("croquetas_perro", "Alimento para perro", "kg", 1),
    Necesidad("croquetas_gato", "Alimento para gato", "kg", 1),
    Necesidad("arena_gato", "Arena para gato", "kg", 2),
]

NECESIDADES: dict[str, Necesidad] = {n.clave: n for n in _NECESIDADES}

# Peso de cada prioridad en el optimizador: dejar sin cubrir algo esencial cuesta
# 10 veces más que algo importante y 100 veces más que algo opcional.
PESO_PRIORIDAD = {1: 100.0, 2: 10.0, 3: 1.0}
# No cubrir la proporción de un básico pesa esta fracción de lo que pesa su necesidad.
PESO_BASICO = 0.2

# --- Reglas especiales ---
TOALLAS_FEMENINAS_MES = 22          # mujeres de 12 a 50 años
EDAD_TOALLAS_FEMENINAS = (12, 50)
PANALES_MES_POR_EDAD = {0: 210, 1: 165, 2: 120}   # piezas al mes según edad en años
TOALLITAS_MES = 240                 # niñas y niños menores de 3 años

# Alimento seco por día según tamaño del perro (kg).
CROQUETAS_PERRO_DIA = {"chico": 0.12, "mediano": 0.30, "grande": 0.50, "gigante": 0.75}
CROQUETAS_GATO_DIA = 0.06
ARENA_GATO_MES = 5.0

# Alergias que se pueden declarar, con sinónimos aceptados.
ALIAS_ALERGENOS = {
    "pescado": "pescado", "pescados": "pescado",
    "mariscos": "mariscos", "marisco": "mariscos", "crustaceos": "mariscos", "camaron": "mariscos",
    "lacteos": "lacteos", "lacteo": "lacteos", "leche": "lacteos", "lactosa": "lacteos",
    "huevo": "huevo", "huevos": "huevo",
    "gluten": "gluten", "trigo": "gluten",
    "cacahuate": "cacahuate", "cacahuates": "cacahuate", "mani": "cacahuate",
    "nueces": "nueces", "nuez": "nueces", "almendra": "nueces", "almendras": "nueces",
    "soya": "soya", "soja": "soya",
    "ajonjoli": "ajonjoli", "sesamo": "ajonjoli",
}

# Dietas predefinidas: etiquetas de producto que excluyen.
DIETAS = {
    "vegetariana": ["carne", "pescado", "mariscos"],
    "pescetariana": ["carne"],
    "sin_cerdo": ["cerdo"],
}

# Si una necesidad se queda sin productos compatibles (por alergia o dieta), su
# cantidad se pasa a otras: (necesidad destino, fracción de la cantidad, factor de conversión).
SUSTITUTOS = {
    # 1 kg de carne ≈ 0.35 kg de leguminosas secas ≈ 6 huevos en proteína.
    "carne_aves": [("leguminosas", 0.6, 0.35), ("huevo", 0.4, 6.0)],
    "huevo": [("carne_aves", 1.0, 0.05)],
    # Sin quesos ni yogur: reforzar leche (o bebida vegetal si hay alergia a lácteos).
    "queso_yogur": [("leche", 1.0, 2.0)],
}
