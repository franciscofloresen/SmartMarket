"""Los endpoints de IA con el modelo simulado: lo que se prueba es que la app valide lo que el modelo propone."""
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import api.app as api_app
from api import ia
from despensa.catalogo import cargar_catalogo
from despensa.texto import normalizar

PERFILES = Path(__file__).resolve().parent.parent / "perfiles"


def _id(*palabras):
    return next(p.id for p in cargar_catalogo("walmart") if all(normalizar(w) in normalizar(p.nombre) for w in palabras))


@pytest.fixture
def perfil():
    return json.loads((PERFILES / "familia_4_perro.json").read_text(encoding="utf-8"))


@pytest.fixture
def cliente(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "clave-de-prueba")
    api_app._llamadas_ia.clear()
    return TestClient(api_app.app)


def _simular(monkeypatch, respuesta):
    """Sustituye la llamada al modelo; guarda lo que se le habría enviado."""
    enviado = {}

    def falso(sistema, usuario, formato, esfuerzo):
        enviado.update(sistema=sistema, usuario=usuario, formato=formato, esfuerzo=esfuerzo)
        return respuesta

    monkeypatch.setattr(ia, "_pedir", falso)
    return enviado


def test_sin_credenciales_la_ia_responde_503(monkeypatch, perfil):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    cliente = TestClient(api_app.app)
    assert cliente.get("/api/opciones").json()["ia"] is False
    assert cliente.post("/api/ia/hogar", json={"texto": "somos cuatro y un perro"}).status_code == 503
    assert cliente.post("/api/ia/menu", json={"perfil": perfil}).status_code == 503


def test_hogar_en_lenguaje_natural_se_sanea(cliente, monkeypatch):
    sugerido = ia.HogarSugerido(
        miembros=[ia.MiembroIA(edad=38, sexo="F", nombre="Mamá"), ia.MiembroIA(edad=999, sexo=None, nombre="")],
        mascotas=[ia.MascotaIA(tipo="perro", tamano="mediano")],
        alergias=["pescado"], excluir=["  Brócoli "], dieta=None, presupuesto=-5, periodo_dias=30, tienda=None,
        estado=None, nivel=None, tortillas_caseras=None, falta=["el presupuesto"], resumen="Entendido.",
    )
    enviado = _simular(monkeypatch, sugerido)
    r = cliente.post("/api/ia/hogar", json={"texto": "Somos mi hija y yo, tenemos un perro. Alergia al pescado."})
    assert r.status_code == 200, r.text
    datos = r.json()
    assert [m["edad"] for m in datos["miembros"]] == [38]      # la edad imposible se descarta
    assert datos["excluir"] == ["brócoli"]
    assert datos["presupuesto"] is None                        # un presupuesto negativo no pasa
    assert cliente.get("/api/opciones").json()["ia"] is True
    assert "pescado" in enviado["sistema"] and enviado["formato"] is ia.HogarSugerido


def test_menu_recibe_la_lista_y_las_alergias(cliente, monkeypatch, perfil):
    comida = ia.Comida(nombre="Pollo con arroz", preparacion="Se guisa.", ingredientes=["pollo", "arroz"])
    menu = ia.Menu(dias=[ia.DiaDeMenu(dia="Lunes", desayuno=comida, comida=comida, cena=comida)], consejos=["Congela el pollo."])
    enviado = _simular(monkeypatch, menu)
    r = cliente.post("/api/ia/menu", json={"perfil": perfil})
    assert r.status_code == 200, r.text
    assert r.json()["dias"][0]["comida"]["nombre"] == "Pollo con arroz"
    assert "ALERGIAS: pescado" in enviado["usuario"]
    assert "Pollo" in enviado["usuario"] and "Papel Higiénico" not in enviado["usuario"]  # solo comestibles


def test_cambios_solo_se_aplican_si_son_validos(cliente, monkeypatch, perfil):
    plan = cliente.post("/api/plan", json={"perfil": perfil}).json()
    en_lista = [l["id"] for l in plan["lineas"]]
    atun = _id("atun", "lata")  # incompatible con la alergia a pescado del perfil
    cambios = ia.Cambios(
        quitar=[en_lista[0], "INVENTADO", atun],
        cantidades=[ia.CambioDeCantidad(id=en_lista[1], paquetes=500), ia.CambioDeCantidad(id="OTRO", paquetes=2)],
        agregar=[ia.ProductoPorAgregar(busqueda="yogur griego", paquetes=2), ia.ProductoPorAgregar(busqueda="atun", paquetes=1),
                 ia.ProductoPorAgregar(busqueda="unicornio", paquetes=1)],
        en_casa=[ia.YaTengo(necesidad="arroz_pasta", fraccion=1), ia.YaTengo(necesidad="no_existe", fraccion=1)],
        respuesta="Listo.",
    )
    _simular(monkeypatch, cambios)
    r = cliente.post("/api/ia/cambios", json={"perfil": perfil, "texto": "quita el primero y agrega yogur griego"})
    assert r.status_code == 200, r.text
    datos = r.json()
    ajustes = datos["ajustes"]
    assert ajustes["excluir_productos"] == [en_lista[0]]              # ni el inventado ni el que no estaba en la lista
    assert ajustes["fijar"][en_lista[1]] == 100                       # cantidad acotada
    assert "OTRO" not in ajustes["fijar"] and atun not in ajustes["fijar"]
    assert any(v == 2 for k, v in ajustes["fijar"].items() if k != en_lista[1])  # el yogur griego entró
    assert set(datos["sin_encontrar"]) == {"atun", "unicornio"}      # el atún existe pero no es compatible
    assert ajustes["en_casa"] == {"arroz_pasta": 1}
    assert datos["hubo_cambios"] is True
    # Los ajustes resultantes son válidos para recalcular la lista.
    assert cliente.post("/api/plan", json={"perfil": perfil, "ajustes": ajustes}).status_code == 200


def test_limite_de_uso_de_ia_por_hora(cliente, monkeypatch):
    monkeypatch.setattr(api_app, "IA_LLAMADAS_POR_HORA", 2)
    _simular(monkeypatch, ia.HogarSugerido(
        miembros=[], mascotas=[], alergias=[], excluir=[], dieta=None, presupuesto=None, periodo_dias=None, tienda=None,
        estado=None, nivel=None, tortillas_caseras=None, falta=[], resumen="",
    ))
    codigos = [cliente.post("/api/ia/hogar", json={"texto": "somos dos adultos"}).status_code for _ in range(3)]
    assert codigos == [200, 200, 429]


def test_errores_de_la_ia_se_traducen(cliente, monkeypatch):
    def falla(*_):
        raise ia.IASinRespuesta("La IA no pudo ayudar con esa petición.")

    monkeypatch.setattr(ia, "_pedir", falla)
    r = cliente.post("/api/ia/hogar", json={"texto": "somos dos adultos"})
    assert r.status_code == 422 and "no pudo ayudar" in r.json()["detail"]
