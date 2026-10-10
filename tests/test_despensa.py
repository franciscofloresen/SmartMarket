from pathlib import Path

import pytest

from despensa.catalogo import cargar_catalogo, coincide_exclusion, estados_de, filtrar, tiendas_en
from despensa.necesidades import calcular_necesidades
from despensa.perfil import PerfilInvalido, cargar_hogar, hogar_desde_dict
from despensa.planificador import planear
from despensa.reglas import NECESIDADES, TIENDAS
from despensa.texto import normalizar

PERFILES = Path(__file__).resolve().parent.parent / "perfiles"


@pytest.fixture(scope="module")
def catalogo():
    return cargar_catalogo()


def _producto(catalogo, *palabras):
    """Primer producto cuyo nombre contiene todas las palabras (sin acentos ni mayúsculas)."""
    return next(p for p in catalogo if all(normalizar(w) in normalizar(p.nombre) for w in palabras))


def _hogar(**extra):
    datos = {"presupuesto": 10000, "miembros": [{"edad": 35, "sexo": "F"}, {"edad": 37, "sexo": "M"}]}
    datos.update(extra)
    return hogar_desde_dict(datos)


# --- Necesidades ---

def test_necesidades_crecen_con_el_hogar():
    pareja = calcular_necesidades(_hogar())
    familia = calcular_necesidades(_hogar(miembros=[{"edad": 35}, {"edad": 37}, {"edad": 8}, {"edad": 15}]))
    for clave in ("carne_aves", "leche", "tortilla_pan", "papel_higienico"):
        assert familia[clave] > pareja[clave]


def test_necesidades_se_escalan_al_periodo():
    mes = calcular_necesidades(_hogar())
    quincena = calcular_necesidades(_hogar(periodo_dias=15))
    assert quincena["frutas"] == pytest.approx(mes["frutas"] / 2)


def test_reglas_especiales_por_miembro_y_mascota():
    sin_extras = calcular_necesidades(_hogar(miembros=[{"edad": 60, "sexo": "F"}]))
    assert "panales" not in sin_extras
    assert "toallas_femeninas" not in sin_extras  # fuera del rango de edad
    assert "croquetas_perro" not in sin_extras

    con_extras = calcular_necesidades(_hogar(
        miembros=[{"edad": 30, "sexo": "F"}, {"edad": 0}],
        mascotas=[{"tipo": "perro", "tamano": "grande"}, {"tipo": "gato"}],
    ))
    assert con_extras["panales"] == 210
    assert con_extras["toallas_femeninas"] == 22
    assert con_extras["croquetas_perro"] == pytest.approx(15.0)
    assert con_extras["arena_gato"] == pytest.approx(5.0)


@pytest.mark.parametrize("datos", [
    {"presupuesto": 1000, "miembros": []},
    {"presupuesto": 0, "miembros": [{"edad": 30}]},
    {"presupuesto": 1000, "miembros": [{"edad": 30}], "alergias": ["kriptonita"]},
    {"presupuesto": 1000, "miembros": [{"edad": 30}], "mascotas": [{"tipo": "perro", "tamano": "enorme"}]},
    {"presupuesto": 1000, "miembros": [{"edad": 30}], "dieta": "carnivora"},
])
def test_perfil_invalido(datos):
    with pytest.raises(PerfilInvalido):
        hogar_desde_dict(datos)


# --- Catálogo y filtros ---

@pytest.mark.parametrize("tienda", list(TIENDAS))
def test_catalogos_cargan_y_son_grandes(tienda):
    productos = cargar_catalogo(tienda)
    assert len(productos) > 500
    # Toda necesidad que el motor calcula tiene al menos un producto en cada tienda.
    cubiertas = {p.necesidad for p in productos}
    assert set(NECESIDADES) - cubiertas == set(), tienda


def test_precios_por_estado():
    assert "Jalisco" in estados_de("walmart")
    nacional = {p.id: p.precio for p in cargar_catalogo("walmart")}
    jalisco = {p.id: p.precio for p in cargar_catalogo("walmart", "Jalisco")}
    assert nacional.keys() == jalisco.keys()
    assert any(nacional[i] != jalisco[i] for i in nacional)
    # Un estado sin datos usa la mediana nacional.
    assert {p.id: p.precio for p in cargar_catalogo("walmart", "Atlántida")} == nacional


def test_alergia_excluye_lo_que_contiene_y_lo_que_puede_contener(catalogo):
    aptos, excluidos = filtrar(catalogo, _hogar(alergias=["Pescado"]))
    motivos = {p.id: m for p, m in excluidos}
    for palabras in (["tilapia"], ["atun", "lata"], ["salsa", "inglesa"]):  # el pescado oculto incluido
        assert motivos[_producto(catalogo, *palabras).id] == "alergia: pescado"
    assert motivos[_producto(catalogo, "surimi").id] == "alergia: pescado"
    assert all("pescado" not in p.alergenos | p.posibles for p in aptos)

    # Las galletas no declaran nuez, pero no se puede descartar: se excluyen por precaución.
    _, excluidos = filtrar(catalogo, _hogar(alergias=["nueces"]))
    assert {p.id: m for p, m in excluidos}[_producto(catalogo, "galletas", "dulces").id] == "puede contener: nueces"


def test_exclusion_tolera_plurales_y_acentos(catalogo):
    assert coincide_exclusion("chiles", _producto(catalogo, "chile", "serrano"))
    assert coincide_exclusion("brócoli", _producto(catalogo, "brocoli", "granel"))
    assert coincide_exclusion("limones", _producto(catalogo, "limon"))
    assert coincide_exclusion("tomate verde", _producto(catalogo, "tomate verde"))
    assert not coincide_exclusion("tomate verde", _producto(catalogo, "jitomate"))


def test_exclusion_no_confunde_palabras_parecidas(catalogo):
    assert coincide_exclusion("pan", _producto(catalogo, "pan de caja"))
    assert not coincide_exclusion("pan", _producto(catalogo, "queso panela"))
    assert not coincide_exclusion("pan", _producto(catalogo, "panales"))
    assert not coincide_exclusion("sal", _producto(catalogo, "salsa picante"))


def test_exclusion_alcanza_productos_mixtos(catalogo):
    # La mezcla California congelada trae brócoli: excluir brócoli debe quitarla.
    _, excluidos = filtrar(catalogo, _hogar(excluir=["brócoli"]))
    assert _producto(catalogo, "mezcla california").id in {p.id for p, _ in excluidos}


def test_harina_para_tortilla_solo_si_las_hacen_en_casa(catalogo):
    maseca = _producto(catalogo, "harina de maiz", "maseca").id
    aptos, _ = filtrar(catalogo, _hogar())
    assert maseca not in {p.id for p in aptos}
    aptos, _ = filtrar(catalogo, _hogar(tortillas_caseras=True))
    assert maseca in {p.id for p in aptos}


# --- Plan completo ---

@pytest.mark.parametrize("archivo", sorted(PERFILES.glob("*.json")), ids=lambda p: p.stem)
def test_perfiles_de_ejemplo_respetan_presupuesto_y_restricciones(archivo, catalogo):
    hogar = cargar_hogar(archivo)
    plan = planear(hogar, catalogo)
    assert 0 < plan.total <= hogar.presupuesto + 1e-6
    for linea in plan.lineas:
        assert not (linea.producto.alergenos & set(hogar.alergias))
        assert not any(coincide_exclusion(t, linea.producto) for t in hogar.terminos_excluidos)


def test_presupuesto_holgado_cubre_todo(catalogo):
    hogar = cargar_hogar(PERFILES / "familia_4_perro.json")
    plan = planear(hogar, catalogo)
    assert all(c.porcentaje >= 95 for c in plan.cobertura), [
        (c.nombre, round(c.porcentaje)) for c in plan.cobertura if c.porcentaje < 95
    ]
    assert plan.sobrante >= 0


def test_presupuesto_corto_recorta_primero_lo_opcional(catalogo):
    hogar = cargar_hogar(PERFILES / "familia_4_perro.json")
    hogar.presupuesto = 5000
    plan = planear(hogar, catalogo)

    def promedio(prioridad):
        valores = [min(c.porcentaje, 100) for c in plan.cobertura if c.prioridad == prioridad]
        return sum(valores) / len(valores)

    assert plan.total <= 5000
    assert promedio(1) > promedio(2) > promedio(3)
    # Ninguna necesidad esencial se elimina por completo.
    assert all(c.porcentaje >= 40 for c in plan.cobertura if c.prioridad == 1)


def test_dieta_vegetariana_sustituye_carne(catalogo):
    plan = planear(_hogar(dieta="vegetariana"), catalogo)
    assert not any("carne" in l.producto.etiquetas for l in plan.lineas)
    assert "carne_aves" not in {c.clave for c in plan.cobertura}
    assert any("Carnes y aves" in n for n in plan.notas)


def test_alergia_a_lacteos_usa_bebidas_vegetales(catalogo):
    plan = planear(_hogar(alergias=["lactosa"]), catalogo)
    leches = [l for l in plan.lineas if l.producto.necesidad == "leche"]
    assert leches and all("bebida vegetal" in l.producto.etiquetas for l in leches)


def test_plan_serializa_a_dict(catalogo):
    datos = planear(_hogar(), catalogo).a_dict()
    assert datos["total"] == pytest.approx(sum(l["subtotal"] for l in datos["lineas"]))


def test_plan_tiene_variedad_y_sentido_comun(catalogo):
    plan = planear(cargar_hogar(PERFILES / "familia_4_perro.json"), catalogo)
    def kg(necesidad, filtro):
        return sum(l.producto.contenido * l.paquetes for l in plan.lineas if l.producto.necesidad == necesidad and filtro(l.producto))
    requerido = {c.clave: c.requerido for c in plan.cobertura}
    # El pollo no acapara la carne, los embutidos son minoría y la leche es leche.
    assert kg("carne_aves", lambda p: "pollo" in p.etiquetas) <= 0.6 * requerido["carne_aves"] + 2
    assert kg("carne_aves", lambda p: "res" in p.etiquetas) >= 0.15 * requerido["carne_aves"]
    assert kg("carne_aves", lambda p: "embutido" in p.etiquetas) <= 0.2 * requerido["carne_aves"] + 1
    assert kg("leche", lambda p: "producto lacteo" in p.etiquetas) <= 0.25 * requerido["leche"] + 1
    # Ningún tipo de verdura pasa de la cuarta parte (más un paquete).
    por_tipo = {}
    for l in plan.lineas:
        if l.producto.necesidad == "verduras":
            por_tipo[l.producto.tipo] = por_tipo.get(l.producto.tipo, 0) + l.producto.contenido * l.paquetes
    assert max(por_tipo.values()) <= 0.25 * requerido["verduras"] + 1.01
    assert len(por_tipo) >= 4


def test_otra_tienda_y_estado_dan_otro_total():
    hogar = cargar_hogar(PERFILES / "familia_4_perro.json")
    totales = set()
    for tienda, estado in [("walmart", None), ("bodega_aurrera", None), ("walmart", "Jalisco")]:
        hogar.tienda, hogar.estado = tienda, estado
        plan = planear(hogar, cargar_catalogo(tienda, estado))
        assert 0 < plan.total <= hogar.presupuesto
        totales.add(plan.total)
    assert len(totales) == 3


# --- Antojos ---

def test_sin_antojos_no_hay_refresco_ni_cerveza(catalogo):
    plan = planear(_hogar(), catalogo, tiempo_limite=10)
    assert not any({"refresco", "cerveza"} & l.producto.etiquetas for l in plan.lineas)


def test_antojos_agregan_ese_tipo_de_producto(catalogo):
    base = planear(_hogar(), catalogo, tiempo_limite=10)
    plan = planear(_hogar(antojos=["refrescos", "cerveza"]), catalogo, tiempo_limite=10)
    refresco = sum(l.producto.contenido * l.paquetes for l in plan.lineas if "refresco" in l.producto.etiquetas)
    assert refresco >= 8  # 2 adultos × 4 L
    assert any("cerveza" in l.producto.etiquetas for l in plan.lineas)
    cobertura = {c.clave: c for c in plan.cobertura}
    assert cobertura["bebidas"].requerido > next(c.requerido for c in base.cobertura if c.clave == "bebidas")
    assert "antojo de refrescos" in cobertura["bebidas"].explicacion


def test_antojo_respeta_alergias(catalogo):
    plan = planear(_hogar(antojos=["cerveza"], alergias=["gluten"]), catalogo, tiempo_limite=10)
    assert not any("cerveza" in l.producto.etiquetas for l in plan.lineas)
    assert any("Cerveza" in n for n in plan.notas)


def test_antojo_desconocido_es_perfil_invalido():
    with pytest.raises(PerfilInvalido):
        _hogar(antojos=["caviar"])


# --- Tiendas por estado ---

def test_tiendas_regionales_solo_donde_tienen_sucursales():
    assert "heb" not in tiendas_en("Jalisco")
    assert "heb" in tiendas_en("Nuevo León")
    assert set(tiendas_en("Hidalgo")) >= {"walmart", "bodega_aurrera", "soriana", "chedraui"}
    assert tiendas_en(None) == list(TIENDAS)
