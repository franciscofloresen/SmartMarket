from pathlib import Path

import pytest

from despensa.catalogo import cargar_catalogo, coincide_exclusion, filtrar
from despensa.necesidades import calcular_necesidades
from despensa.perfil import PerfilInvalido, cargar_hogar, hogar_desde_dict
from despensa.planificador import planear

PERFILES = Path(__file__).resolve().parent.parent / "perfiles"


@pytest.fixture(scope="module")
def catalogo():
    return cargar_catalogo()


def _producto(catalogo, pid):
    return next(p for p in catalogo if p.id == pid)


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

def test_catalogo_carga_y_es_consistente(catalogo):
    assert len(catalogo) > 100


def test_alergia_excluye_ingredientes_ocultos(catalogo):
    aptos, excluidos = filtrar(catalogo, _hogar(alergias=["Pescado"]))
    ids_excluidos = {p.id for p, _ in excluidos}
    assert {"C013", "C014", "E007", "E008"} <= ids_excluidos  # tilapia, atún, salsa inglesa, César
    assert all("pescado" not in p.alergenos for p in aptos)


def test_exclusion_tolera_plurales_y_acentos(catalogo):
    assert coincide_exclusion("chiles", _producto(catalogo, "V008"))        # Chile serrano
    assert coincide_exclusion("brócoli", _producto(catalogo, "V006"))
    assert coincide_exclusion("limones", _producto(catalogo, "F010"))
    assert coincide_exclusion("tomate verde", _producto(catalogo, "V015"))
    assert not coincide_exclusion("tomate verde", _producto(catalogo, "V001"))  # jitomate


def test_exclusion_no_confunde_palabras_parecidas(catalogo):
    assert coincide_exclusion("pan", _producto(catalogo, "T004"))
    assert not coincide_exclusion("pan", _producto(catalogo, "Q001"))   # queso panela
    assert not coincide_exclusion("pan", _producto(catalogo, "N001"))   # pañales
    assert not coincide_exclusion("sal", _producto(catalogo, "E004"))   # salsa


def test_harina_para_tortilla_solo_si_las_hacen_en_casa(catalogo):
    aptos, _ = filtrar(catalogo, _hogar())
    assert "T002" not in {p.id for p in aptos}
    aptos, _ = filtrar(catalogo, _hogar(tortillas_caseras=True))
    assert "T002" in {p.id for p in aptos}


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
