"""Reglas para convertir productos de Profeco (QQP) en productos del catálogo.

Cada regla dice, para un tipo de producto de Profeco (columna `producto`):
  - qué necesidad del hogar cubre y en qué departamento se muestra,
  - cómo medir su contenido a partir de la presentación ("Bolsa 900 Gr." -> 0.9 kg),
  - etiquetas (para exclusiones, dietas y básicos),
  - alérgenos que CONTIENE y alérgenos que PUEDE contener (no se puede descartar sin ver la etiqueta).

Si un hogar declara una alergia, se excluye todo producto que la contenga o pueda contenerla.
Ante la duda, agrega el alérgeno a `posibles`: es preferible ofrecer menos opciones que arriesgar.

Para un mismo producto puede haber varias reglas; gana la primera cuya condición `si` coincide
con "presentación | marca" y cuya condición `no` no coincide. Sin regla aplicable, se omite.
"""
from dataclasses import dataclass

# Formas de medir el contenido de un paquete.
PESO = "peso"            # kg
VOLUMEN = "volumen"      # L
MASA_O_VOL = "masa_o_vol"  # kg o L, lo que traiga (1 kg ≈ 1 L)
PIEZAS = "piezas"        # número de piezas/rollos/unidades declaradas
UNIDAD = "unidad"        # el paquete cuenta como 1


@dataclass(frozen=True)
class Regla:
    necesidad: str
    departamento: str
    medida: str
    etiquetas: str = ""
    alergenos: str = ""
    posibles: str = ""
    vida: int = 365
    congelable: bool = False
    si: str | None = None
    no: str | None = None
    factor: float = 1.0          # multiplica el contenido (ej. harina de maíz rinde 1.7 kg de tortilla)
    pieza: float | None = None   # contenido cuando la presentación es "Pieza"/"Manojo" sin peso
    nombre: str | None = None    # nombre a mostrar en lugar del de Profeco


# --- Grupos de alérgenos frecuentes en productos procesados ---
PROCESADO = "soya;gluten;lacteos;huevo"                        # salsas, embutidos, enlatados
HORNEADO = "lacteos;huevo;soya;nueces;cacahuate;ajonjoli"      # además del gluten que sí contienen
DULCE = "lacteos;soya;nueces;cacahuate;gluten;huevo"

# Cortes que no queremos que el optimizador elija solo por baratos.
CORTES_NO = r"Cabeza|Manitas|Hueso|Retazo|V[ií]sceras|H[ií]gado|Menudo|Pata|Molleja|Rabadilla|Huacal|Espinazo|Lengua|Rabo|Panza|Coraz[oó]n|Ri[ñn][oó]n|Cuero|Lonja|Grasa"

carne = lambda etq, **k: Regla("carne_aves", "carnes", PESO, f"carne;{etq}", vida=4, congelable=True, no=CORTES_NO, **k)
embutido = lambda etq, **k: Regla(
    "carne_aves", "salchichoneria", PESO, f"carne;embutido;{etq}", posibles=PROCESADO, vida=20, congelable=True, **k
)
pescado = lambda **k: Regla("carne_aves", "pescados", PESO, "pescado", alergenos="pescado", vida=3, congelable=True, **k)
marisco = lambda **k: Regla("carne_aves", "pescados", PESO, "mariscos", alergenos="mariscos", vida=3, congelable=True, **k)
fruta = lambda vida, etq="", **k: Regla("frutas", "frutas_verduras", PESO, etq, vida=vida, **k)
verdura = lambda vida, etq="", **k: Regla("verduras", "frutas_verduras", PESO, etq, vida=vida, **k)
congelada = lambda etq="": Regla("verduras", "congelados", PESO, etq, vida=180, congelable=True)
queso = lambda vida=20: [
    # Los quesos "imitación" llevan grasa vegetal; se limitan para que no sustituyan al queso.
    Regla("queso_yogur", "lacteos_huevo", PESO, "queso;imitacion", alergenos="lacteos", posibles="soya", vida=vida, si="Imitaci"),
    Regla("queso_yogur", "lacteos_huevo", PESO, "queso", alergenos="lacteos", vida=vida),
]
botana = lambda etq, alergenos="", posibles=DULCE, **k: Regla(
    "botanas_galletas", "despensa", PESO, etq, alergenos=alergenos, posibles=posibles, vida=180, **k
)
conserva = lambda etq="", alergenos="", posibles="", **k: Regla(
    "enlatados_salsas", "despensa", MASA_O_VOL, etq, alergenos=alergenos, posibles=posibles, vida=365, **k
)
especia = lambda etq, **k: Regla("condimentos", "despensa", PESO, etq, vida=365, **k)
bebida = lambda etq, **k: Regla("bebidas", "bebidas", VOLUMEN, etq, vida=180, **k)
limpieza = lambda necesidad, medida, etq, **k: Regla(necesidad, "limpieza", medida, etq, vida=1000, **k)
higiene = lambda necesidad, medida, etq, **k: Regla(necesidad, "higiene", medida, etq, vida=1000, **k)
# Productos que la app no calcula pero se pueden agregar a mano desde el buscador.
extra = lambda depto, etq="", **k: Regla("extras", depto, UNIDAD, etq, vida=365, **k)

PESCADOS = [
    "Bagre", "Bandera", "Basa", "Besugo", "Blanco del Nilo", "Carpa", "Cazón", "Chucumite", "Curvina", "Huachinango",
    "Jurel", "Lenguado", "Lisa", "Lobina", "Merluza", "Mero", "Mojarra", "Pargo", "Pámpano", "Robalo", "Rubia",
    "Salmón", "Sierra", "Tilapia", "Trucha", "Robalito",
]
MARISCOS = [
    "Almeja", "Calamar", "Callo de Almeja", "Callo de Hacha", "Camarón", "Jaiba", "Jaibón", "Langosta",
    "Langostino", "Pulpo", "Villajaiba",
]

REGLAS: dict[str, list[Regla]] = {
    # ---------------- Carnes ----------------
    "Carne Pollo": [carne("pollo", nombre="Pollo")],
    "Carne Pavo": [carne("pavo", nombre="Pavo")],
    "Carne Res": [carne("res", nombre="Res")],
    "Carne Ternera": [carne("res;ternera", nombre="Ternera")],
    "Carne Cerdo": [
        embutido("cerdo", si="Longaniza|Chorizo|Ahumad", nombre="Cerdo"),
        carne("cerdo", nombre="Cerdo"),
    ],
    "Chorizo": [embutido("cerdo;chorizo")],
    "Jamón": [embutido("jamon;cerdo")],
    "Mortadela": [embutido("mortadela;cerdo")],
    "Pastel Pimiento": [embutido("cerdo")],
    "Pechuga de Pavo": [embutido("pavo")],
    "Queso de Puerco": [embutido("cerdo")],
    "Salchicha": [embutido("salchicha;cerdo")],
    "Tocino Ahumado": [embutido("tocino;cerdo", nombre="Tocino ahumado")],
    **{p: [pescado()] for p in PESCADOS},
    **{m: [marisco()] for m in MARISCOS},
    "Barrita de Surimi o Barrita de Surimi Cangre": [
        Regla("carne_aves", "pescados", PESO, "pescado;surimi", alergenos="pescado;mariscos", posibles="huevo;gluten;soya",
              vida=10, congelable=True, nombre="Surimi")
    ],
    "Atún": [
        pescado(si="Granel"),
        Regla("carne_aves", "despensa", PESO, "pescado;atun;enlatado", alergenos="pescado", posibles="soya", vida=720),
    ],
    "Sardina": [Regla("carne_aves", "despensa", PESO, "pescado;sardina;enlatado", alergenos="pescado", posibles="soya", vida=720)],
    # ---------------- Huevo y lácteos ----------------
    "Huevo": [Regla("huevo", "lacteos_huevo", PIEZAS, "huevo", alergenos="huevo", vida=30, pieza=16)],  # ~16 huevos por kg
    "Leche Pasteurizada": [Regla("leche", "lacteos_huevo", VOLUMEN, "leche", alergenos="lacteos", vida=10, nombre="Leche fresca")],
    "Leche Ultrapasteurizada": [Regla("leche", "lacteos_huevo", VOLUMEN, "leche", alergenos="lacteos", vida=90, nombre="Leche")],
    "Producto Lácteo": [Regla("leche", "lacteos_huevo", VOLUMEN, "leche;producto lacteo", alergenos="lacteos", posibles="soya", vida=90)],
    "Fórmula Láctea": [
        extra("bebe", "formula infantil", alergenos="lacteos", posibles="soya", si="Lactante|Lata", nombre="Fórmula infantil"),
        Regla("leche", "lacteos_huevo", VOLUMEN, "leche;formula lactea", alergenos="lacteos", posibles="soya", vida=90),
    ],
    # 1 kg de leche en polvo rinde aprox. 7.5 L.
    "Leche en Polvo": [Regla("leche", "despensa", PESO, "leche;leche en polvo", alergenos="lacteos", posibles="soya", vida=365, factor=7.5)],
    "Leche Condensada": [conserva("leche condensada", alergenos="lacteos")],
    "Leche Evaporada": [conserva("leche evaporada", alergenos="lacteos")],
    "Crema": [Regla("queso_yogur", "lacteos_huevo", MASA_O_VOL, "crema", alergenos="lacteos", vida=20)],
    "Yoghurt": [Regla("queso_yogur", "lacteos_huevo", MASA_O_VOL, "yogur", alergenos="lacteos", posibles="nueces;gluten;soya",
                      vida=20, nombre="Yogur")],
    "Queso Americano": queso(30), "Queso Chihuahua": queso(), "Queso Cotija": queso(30), "Queso Fresco": queso(12),
    "Queso Manchego": queso(), "Queso Crema": queso(30), "Queso Oaxaca": queso(), "Queso Panela": queso(15), "Queso Sierra": queso(),
    "Mantequilla": [Regla("aceite", "lacteos_huevo", PESO, "mantequilla", alergenos="lacteos", vida=60)],
    "Margarina": [Regla("aceite", "lacteos_huevo", PESO, "margarina", posibles="lacteos;soya", vida=90)],
    "Helado": [Regla("botanas_galletas", "congelados", MASA_O_VOL, "helado;postre", alergenos="lacteos", posibles="nueces;cacahuate;soya;huevo;gluten",
                     vida=180, congelable=True)],
    # ---------------- Leguminosas y granos ----------------
    "Frijol": [Regla("leguminosas", "despensa", PESO, "frijol")],
    "Lenteja": [Regla("leguminosas", "despensa", PESO, "lenteja")],
    "Garbanzo": [Regla("leguminosas", "despensa", PESO, "garbanzo")],
    "Haba": [Regla("leguminosas", "despensa", PESO, "haba")],
    "Alubia": [Regla("leguminosas", "despensa", PESO, "alubia")],
    "Soya": [Regla("leguminosas", "despensa", PESO, "soya", alergenos="soya")],
    # Frijoles ya cocidos o refritos: ~1/3 de su peso en frijol seco.
    "Frijoles": [Regla("leguminosas", "despensa", PESO, "frijol;enlatado", posibles="soya", vida=720, factor=0.35, nombre="Frijoles preparados")],
    "Arroz": [Regla("arroz_pasta", "despensa", PESO, "arroz")],
    "Pasta para Sopa": [Regla("arroz_pasta", "despensa", PESO, "pasta", alergenos="gluten", posibles="huevo")],
    "Avena": [Regla("cereal_desayuno", "despensa", PESO, "avena;cereal", alergenos="gluten", posibles="nueces;lacteos;soya")],
    "Cereales": [Regla("cereal_desayuno", "despensa", PESO, "cereal", alergenos="gluten", posibles="nueces;lacteos;soya;cacahuate", nombre="Cereal")],
    "Granola": [Regla("cereal_desayuno", "despensa", PESO, "granola;cereal", alergenos="gluten;nueces", posibles="lacteos;soya;cacahuate;ajonjoli")],
    "Harina Hot Cakes": [Regla("cereal_desayuno", "despensa", PESO, "hot cakes;harina", alergenos="gluten", posibles="lacteos;huevo;soya",
                               nombre="Harina para hot cakes")],
    "Harina de Trigo": [extra("despensa", "harina", alergenos="gluten")],
    "Harina de Arroz": [extra("despensa", "harina;arroz")],
    "Maíz Pozolero": [extra("despensa", "maiz;pozole")],
    "Chía": [extra("despensa", "chia")], "Linaza": [extra("despensa", "linaza")],
    "Crema Batida": [extra("lacteos_huevo", "crema batida", posibles="lacteos;soya")],
    "Pollo Rostizado. Tradicional": [extra("carnes", "pollo;carne;pollo rostizado", posibles=PROCESADO, nombre="Pollo rostizado")],
    # ---------------- Tortilla y pan ----------------
    "Tortilla de Maíz": [Regla("tortilla_pan", "panaderia_tortilleria", PESO, "tortilla;maiz", vida=4)],
    "Tortilla de Harina de Trigo": [Regla("tortilla_pan", "panaderia_tortilleria", PESO, "tortilla;harina", alergenos="gluten",
                                          posibles="lacteos;soya", vida=30, congelable=True, nombre="Tortilla de harina")],
    "Tostadas de Maíz": [Regla("tortilla_pan", "despensa", PESO, "tostada;maiz", vida=60)],
    "Pan de Caja": [Regla("tortilla_pan", "panaderia_tortilleria", PESO, "pan", alergenos="gluten", posibles=HORNEADO, vida=7, congelable=True)],
    "Pan Blanco Bolillo": [Regla("tortilla_pan", "panaderia_tortilleria", PESO, "pan;bolillo", alergenos="gluten", posibles="lacteos;huevo;soya",
                                 vida=2, congelable=True, pieza=0.06, nombre="Bolillo")],
    # 1 kg de harina de maíz nixtamalizado rinde ~1.7 kg de tortilla; solo si las hacen en casa.
    "Harina de Maíz": [
        Regla("tortilla_pan", "despensa", PESO, "harina;maiz;tortilla;hecho en casa", vida=180, factor=1.7, no="F[eé]cula|Maizena"),
        extra("despensa", "fecula;maiz", si="F[eé]cula|Maizena", nombre="Fécula de maíz"),
    ],
    "Empanizadores": [extra("despensa", "pan molido", alergenos="gluten", posibles=HORNEADO)],
    # ---------------- Frutas ----------------
    "Plátano": [fruta(6, "platano")], "Manzana": [fruta(21)], "Naranja": [fruta(14)], "Papaya": [fruta(5)],
    "Guayaba": [fruta(7)], "Mandarina": [fruta(10)], "Sandía": [fruta(7)], "Piña": [fruta(7)], "Melón": [fruta(7)],
    "Limón": [fruta(20, "limon")], "Mango": [fruta(6)], "Pera": [fruta(14)], "Perón": [fruta(14)], "Uva": [fruta(7)],
    "Fresa": [fruta(4)], "Durazno": [fruta(5)], "Ciruela": [fruta(6)], "Kiwi": [fruta(14)], "Toronja": [fruta(14)],
    "Granada": [fruta(14)], "Guanábana": [fruta(4)], "Mamey": [fruta(5)], "Tuna": [fruta(6)], "Lima": [fruta(14)],
    # ---------------- Verduras ----------------
    "Jitomate": [verdura(7, "jitomate;tomate")], "Cebolla": [verdura(21, "cebolla", pieza=0.15)],
    "Papa": [verdura(30, "papa")], "Zanahoria": [verdura(21)], "Calabaza": [verdura(7, "calabacita", nombre="Calabacita")],
    "Chile Fresco": [verdura(10, "chile", nombre="Chile")], "Brócoli": [verdura(5, pieza=0.5)], "Coliflor": [verdura(7, pieza=1.0)],
    "Lechuga": [verdura(6, pieza=0.5)], "Pepino": [verdura(7)], "Chayote": [verdura(14)], "Ejote": [verdura(6)],
    "Espinacas": [verdura(4, "espinaca", pieza=0.3)], "Acelga": [verdura(4, pieza=0.3)], "Aguacate": [verdura(5)],
    "Tomate": [verdura(10, "tomate verde", nombre="Tomate verde")], "Nopal": [verdura(7)], "Apio": [verdura(10, pieza=0.6)],
    "Betabel": [verdura(21)], "Col": [verdura(14, pieza=1.2)], "Champiñones": [verdura(5, "champinon")],
    "Chícharos": [verdura(5, "chicharo")], "Elote": [verdura(4, pieza=0.25)], "Pimiento": [verdura(10)],
    "Rábano": [verdura(7, pieza=0.25)], "Verdolaga": [verdura(3, pieza=0.3)], "Alcachofa": [verdura(7, pieza=0.3)],
    "Cilantro": [verdura(5, pieza=0.08)], "Jícama": [verdura(14)], "Romeritos": [verdura(4)],
    "Mezcla California": [congelada("brocoli;coliflor;zanahoria")],
    "Mezcla Campesina": [congelada("zanahoria;chicharo;elote;ejote")],
    "Combinado Primavera": [congelada("zanahoria;chicharo;elote")],
    "Floretes de Brócoli": [congelada("brocoli")],
    "Granos de Elote": [congelada("elote")],
    "Guarnición de Verduras": [congelada("zanahoria;chicharo;elote;papa")],
    # ---------------- Aceites ----------------
    "Aceite": [
        Regla("aceite", "despensa", VOLUMEN, "aceite;soya", alergenos="soya", si="Soya"),
        Regla("aceite", "despensa", VOLUMEN, "aceite", posibles="soya"),
    ],
    "Aceite de Oliva": [Regla("aceite", "despensa", VOLUMEN, "aceite;oliva")],
    "Grasa Comestible": [Regla("aceite", "despensa", PESO, "manteca vegetal", posibles="soya")],
    "Manteca de Cerdo": [Regla("aceite", "despensa", PESO, "manteca;cerdo;carne")],
    # ---------------- Azúcar y untables ----------------
    "Azúcar": [Regla("azucar", "despensa", PESO, "azucar", vida=720)],
    "Sustituto de Azúcar": [extra("despensa", "endulzante")],
    "Miel de Abeja": [Regla("azucar", "despensa", PESO, "miel", vida=720)],
    "Mermelada": [Regla("azucar", "despensa", PESO, "mermelada", vida=365)],
    "Cajeta": [Regla("azucar", "despensa", PESO, "cajeta", alergenos="lacteos", vida=365)],
    "Crema de Cacahuate": [Regla("azucar", "despensa", PESO, "cacahuate", alergenos="cacahuate", posibles="nueces;soya", vida=365)],
    "Crema de Avellanas con Cacao": [Regla("azucar", "despensa", PESO, "avellana;chocolate", alergenos="nueces;lacteos;soya", vida=365)],
    "Jarabe P/preparar Bebidas": [extra("despensa", "jarabe", posibles="lacteos;soya", nombre="Jarabe para preparar bebidas")],
    # ---------------- Café y té ----------------
    "Café Soluble": [Regla("cafe_te", "despensa", PESO, "cafe")],
    "Café Tostado y Molido": [Regla("cafe_te", "despensa", PESO, "cafe", nombre="Café molido")],
    "Chocolate en Tablillas": [Regla("cafe_te", "despensa", PESO, "chocolate", posibles="lacteos;soya;nueces;cacahuate", nombre="Chocolate de mesa")],
    "Té": [extra("despensa", "te")],
    # ---------------- Enlatados y salsas ----------------
    "Mayonesa": [conserva("mayonesa", alergenos="huevo", posibles="soya")],
    "Mostaza": [conserva("mostaza", posibles="gluten")],
    "Salsa Catsup": [conserva("catsup;tomate", nombre="Catsup")],
    "Salsa Picante y Similares": [conserva("salsa;picante;chile", posibles="soya;gluten", nombre="Salsa picante")],
    "Salsa Inglesa": [conserva("salsa inglesa;salsa", alergenos="pescado", posibles="soya;gluten")],
    "Salsa de Soya": [conserva("salsa de soya;salsa", alergenos="soya;gluten")],
    "Mole Rojo en Pasta": [conserva("mole", alergenos="cacahuate;ajonjoli", posibles="nueces;gluten;soya", nombre="Mole en pasta")],
    "Vinagre": [conserva("vinagre")],
    "Chiles": [conserva("chile;enlatado", nombre="Chiles en lata")],
    "Puré de Tomate": [conserva("tomate;pure")],
    "Chícharos en Lata": [conserva("chicharo;enlatado")],
    "Coctel de Frutas en Almíbar": [conserva("fruta en almibar")],
    "Duraznos en Almíbar": [conserva("durazno;fruta en almibar")],
    "Piña en Almíbar": [conserva("pina;fruta en almibar")],
    "Aceituna": [conserva("aceituna", posibles="pescado")],  # algunas van rellenas de anchoa
    "Alcaparra": [conserva("alcaparra")],
    # ---------------- Condimentos ----------------
    "Sal Molida de Mesa": [especia("sal", nombre="Sal")],
    "Sal de Mar": [especia("sal")],
    "Concentrado de Pollo": [especia("consome", posibles="soya;gluten;lacteos;huevo", nombre="Consomé de pollo")],
    "Pimienta": [especia("pimienta;especia")], "Comino": [especia("comino;especia")], "Orégano": [especia("oregano;especia")],
    "Hojas de Laurel": [especia("laurel;especia")], "Cúrcuma": [especia("curcuma;especia")], "Canela": [especia("canela;especia")],
    "Tomillo": [especia("tomillo;especia")], "Vainilla": [Regla("condimentos", "despensa", MASA_O_VOL, "vainilla")],
    "Polvo P/hornear": [especia("polvo para hornear", nombre="Polvo para hornear")],
    "Ajo": [Regla("condimentos", "frutas_verduras", PESO, "ajo", vida=60, pieza=0.05)],
    "Chile Seco": [especia("chile;chile seco")],
    "Ajonjolí": [especia("ajonjoli", alergenos="ajonjoli")],
    # ---------------- Botanas, galletas y postres ----------------
    "Galletas Dulces": [botana("galleta", alergenos="gluten", posibles=HORNEADO)],
    "Galletas Populares": [botana("galleta", alergenos="gluten", posibles=HORNEADO, nombre="Galletas")],
    "Galletas Saladas": [botana("galleta", alergenos="gluten", posibles=HORNEADO)],
    "Papas Fritas y Similares": [botana("botana;frituras", posibles="lacteos;soya;gluten;cacahuate", nombre="Botana")],
    "Cacahuates": [botana("cacahuate;botana", alergenos="cacahuate", posibles="nueces;soya;gluten")],
    "Nuez": [botana("nuez", alergenos="nueces", posibles="cacahuate")],
    "Almendras": [botana("almendra", alergenos="nueces", posibles="cacahuate")],
    "Pasa (Uva Pasa)": [botana("pasa", posibles="nueces;cacahuate", nombre="Pasas")],
    "Ciruela Pasa": [botana("ciruela pasa", posibles="nueces;cacahuate")],
    "Semilla de Girasol": [botana("girasol", posibles="nueces;cacahuate")],
    "Amaranto": [botana("amaranto", posibles="nueces;cacahuate;gluten")],
    "Maíz Palomero": [botana("palomitas;maiz", posibles="")],
    "Barras de Avena": [botana("barra;avena", alergenos="gluten")],
    "Barras de Cereal": [botana("barra;cereal", alergenos="gluten")],
    "Chocolate": [botana("chocolate", alergenos="lacteos;soya", posibles="nueces;cacahuate;gluten;huevo")],
    "Pan Dulce": [Regla("botanas_galletas", "panaderia_tortilleria", PESO, "pan dulce", alergenos="gluten;lacteos;huevo",
                        posibles="soya;nueces;cacahuate;ajonjoli", vida=3, pieza=0.08)],
    "Pastelillos y Pan Dulce Empaquetado": [botana("pan dulce;pastelito", alergenos="gluten;lacteos;huevo",
                                                   posibles="soya;nueces;cacahuate;ajonjoli", nombre="Pastelitos")],
    "Gelatina en Polvo": [botana("gelatina;postre", posibles="lacteos;soya")],
    "Flan": [botana("flan;postre", alergenos="lacteos", posibles="huevo;soya")],
    "Polvo P/preparar Bebidas Sabor Chocolate": [botana("chocolate en polvo", posibles="lacteos;soya;gluten",
                                                        nombre="Chocolate en polvo")],
    # ---------------- Bebidas ----------------
    "Refresco": [bebida("refresco")],
    "Jugo de Fruta": [bebida("jugo", posibles="soya", nombre="Jugo")],
    "Agua Sin Gas": [bebida("agua", nombre="Agua")],
    "Agua con Gas": [bebida("agua mineral", nombre="Agua mineral")],
    "Bebidas Hidratantes": [bebida("bebida hidratante", nombre="Bebida hidratante")],
    "Té Preparado": [bebida("te", nombre="Té preparado")],
    "Bebida Varias": [bebida("bebida")],
    # Cada sobre rinde aprox. 1 L de bebida.
    "Polvo P/preparar Bebidas": [Regla("bebidas", "bebidas", PIEZAS, "bebida en polvo", vida=365, pieza=1, si="Sobre",
                                       nombre="Bebida en polvo")],
    "Jamaica": [extra("despensa", "jamaica")],
    "Tamarindo": [extra("despensa", "tamarindo")],
    "Cerveza": [extra("bebidas", "cerveza;alcohol", alergenos="gluten")],
    "Brandy": [extra("bebidas", "alcohol")], "Ron": [extra("bebidas", "alcohol")],
    "Tequila": [extra("bebidas", "alcohol")], "Whisky": [extra("bebidas", "alcohol")],
    # ---------------- Limpieza ----------------
    "Papel Higiénico": [limpieza("papel_higienico", PIEZAS, "papel", si="Rollo")],
    "Toalla de Papel": [limpieza("servitoallas", PIEZAS, "papel;servitoalla", pieza=1, nombre="Toallas de papel")],
    # 200 servilletas equivalen aprox. a un rollo de toallas de cocina.
    "Servilletas de Papel Blanco": [limpieza("servitoallas", PIEZAS, "papel;servilletas", factor=1 / 200, nombre="Servilletas")],
    "Detergente P/trastes": [limpieza("jabon_trastes", MASA_O_VOL, "lavatrastes", nombre="Lavatrastes")],
    "Detergente P/ropa": [limpieza("detergente_ropa", MASA_O_VOL, "detergente", nombre="Detergente para ropa")],
    "Detergente P/ropa y Trastes": [limpieza("detergente_ropa", MASA_O_VOL, "detergente", nombre="Detergente multiusos")],
    "Jabón de Pasta": [limpieza("detergente_ropa", PESO, "jabon de pasta", nombre="Jabón de lavandería")],
    "Suavizante P/ropa": [limpieza("suavizante", VOLUMEN, "suavizante", nombre="Suavizante")],
    "Blanqueador": [limpieza("limpieza_hogar", VOLUMEN, "cloro")],
    "Limpiador Líquido P/piso": [limpieza("limpieza_hogar", VOLUMEN, "limpiador", nombre="Limpiador multiusos")],
    "Spray Desinfectante": [limpieza("limpieza_hogar", MASA_O_VOL, "desinfectante")],
    "Insecticida Aerosol": [extra("limpieza", "insecticida")],
    "Fibra para Cocina": [extra("limpieza", "fibra")],
    "Toallitas Desinfectantes": [extra("limpieza", "toallitas desinfectantes")],
    "Microbicida": [extra("limpieza", "desinfectante de verduras", nombre="Desinfectante de verduras")],
    "Pilas Eléctricas": [extra("limpieza", "pilas", nombre="Pilas")],
    "Cerillos": [extra("limpieza", "cerillos")],
    # ---------------- Higiene ----------------
    "Jabón de Tocador": [higiene("jabon_corporal", PIEZAS, "jabon", pieza=1, si="Barra")],
    "Shampoo": [higiene("shampoo", MASA_O_VOL, "shampoo")],
    "Acondicionador y Enjuague": [extra("higiene", "acondicionador", nombre="Acondicionador")],
    # Una "pieza" de pasta dental son ~100 ml (≈130 g).
    "Crema Dental": [higiene("pasta_dental", MASA_O_VOL, "pasta dental", factor=10, nombre="Pasta dental")],
    "Desodorante": [higiene("desodorante", UNIDAD, "desodorante")],
    "Toalla Femenina": [higiene("toallas_femeninas", PIEZAS, "toallas femeninas", nombre="Toallas femeninas")],
    "Tampones": [extra("higiene", "tampones")], "Pantiprotectores": [extra("higiene", "pantiprotectores")],
    "Cepillo Dental": [extra("higiene", "cepillo dental")], "Crema Líquida": [extra("higiene", "crema corporal", nombre="Crema corporal")],
    "Crema Sólida": [extra("higiene", "crema")], "Rastrillos Desechables": [extra("higiene", "rastrillos", nombre="Rastrillos")],
    "Espuma de Afeitar": [extra("higiene", "espuma de afeitar")], "Gel Fijador": [extra("higiene", "gel")],
    "Protector Solar": [extra("higiene", "protector solar")], "Talco": [extra("higiene", "talco")],
    # ---------------- Bebé ----------------
    "Pañales Desechables": [Regla("panales", "bebe", PIEZAS, "panal", vida=1000, nombre="Pañales")],
    "Toallita Húmeda Limpiadora": [Regla("toallitas_humedas", "bebe", PIEZAS, "toallitas", vida=1000, nombre="Toallitas húmedas")],
    "Shampoo para Bebés/niños": [extra("bebe", "shampoo;bebe", nombre="Shampoo para bebé")],
    "Jabón de Tocador para Bebé": [extra("bebe", "jabon;bebe", nombre="Jabón para bebé")],
    "Talco para Bebé": [extra("bebe", "talco;bebe")],
    "Crema para Rozaduras": [extra("bebe", "crema;bebe")],
    "Alimento Preparado para Niños": [extra("bebe", "papilla", posibles="lacteos;gluten;soya;huevo", nombre="Papilla")],
}
