import json
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import api.app as api_app
from despensa.catalogo import cargar_catalogo
from despensa.texto import normalizar

PERFILES = Path(__file__).resolve().parent.parent / "perfiles"


@pytest.fixture
def cliente(tmp_path, monkeypatch):
    monkeypatch.setattr(api_app, "REPORTES_PATH", tmp_path / "reportes.jsonl")
    return TestClient(api_app.app)


def _id(*palabras):
    """Id del primer producto de Walmart cuyo nombre contiene todas las palabras."""
    return next(
        p.id for p in cargar_catalogo("walmart") if all(normalizar(w) in normalizar(p.nombre) for w in palabras)
    )


@pytest.fixture
def perfil():
    return json.loads((PERFILES / "familia_4_perro.json").read_text(encoding="utf-8"))


def test_salud(cliente):
    assert cliente.get("/api/salud").json() == {"ok": True}


def test_opciones(cliente):
    datos = cliente.get("/api/opciones").json()
    assert {"clave": "pescado", "nombre": "Pescado"} in datos["alergias"]
    assert {a["clave"] for a in datos["dietas"]} == {"vegetariana", "pescetariana", "sin_cerdo"}
    assert datos["catalogo"]["productos"] > 500
    assert {t["clave"] for t in datos["tiendas"]} >= {"walmart", "soriana", "chedraui"}
    assert "Jalisco" in next(t for t in datos["tiendas"] if t["clave"] == "walmart")["estados"]


def test_plan_caso_de_ejemplo_rapido(cliente, perfil):
    inicio = time.perf_counter()
    r = cliente.post("/api/plan", json={"perfil": perfil})
    duracion = time.perf_counter() - inicio
    assert r.status_code == 200, r.text
    datos = r.json()
    assert 0 < datos["total"] <= 10000
    assert datos["catalogo"]["tienda"] == "Walmart"
    assert all("fuente_precio" in l for l in datos["lineas"])
    assert duracion < 2.0


def test_plan_quitar_producto(cliente, perfil):
    original = cliente.post("/api/plan", json={"perfil": perfil}).json()
    quitado = original["lineas"][0]["id"]
    r = cliente.post("/api/plan", json={"perfil": perfil, "ajustes": {"excluir_productos": [quitado]}})
    datos = r.json()
    assert quitado not in {l["id"] for l in datos["lineas"]}
    assert any(e["id"] == quitado and e["motivo"] == "quitado por ti" for e in datos["excluidos"])


def test_plan_fijar_cantidad(cliente, perfil):
    # 10 kg de bistec de res: mucho más de lo que el optimizador elegiría solo.
    bistec = _id("res", "bistec")
    r = cliente.post("/api/plan", json={"perfil": perfil, "ajustes": {"fijar": {bistec: 10}}})
    assert r.status_code == 200, r.text
    datos = r.json()
    linea = next(l for l in datos["lineas"] if l["id"] == bistec)
    assert linea["paquetes"] == 10 and linea["fijado"] is True
    assert datos["total"] <= 10000


def test_plan_fijar_producto_que_el_hogar_no_necesita(cliente, perfil):
    perfil["mascotas"] = []
    r = cliente.post("/api/plan", json={"perfil": perfil, "ajustes": {"fijar": {"M002": 1}}})
    assert r.status_code == 200, r.text
    assert any(l["id"] == "M002" and l["paquetes"] == 1 for l in r.json()["lineas"])


@pytest.mark.parametrize("ajustes, mensaje", [
    ({"fijar": {"NOEXISTE": 1}}, "no existen"),
    ({"fijar": {_id("atun", "lata"): 1}}, "no es compatible"),  # atún con alergia a pescado
    ({"fijar": {"M004": 11}}, "superan el presupuesto"),         # 11 × $999
])
def test_plan_ajustes_invalidos(cliente, perfil, ajustes, mensaje):
    r = cliente.post("/api/plan", json={"perfil": perfil, "ajustes": ajustes})
    assert r.status_code == 422
    assert mensaje in r.json()["detail"]


@pytest.mark.parametrize("cambio", [
    {"miembros": []},
    {"presupuesto": -5},
    {"alergias": ["kriptonita"]},
    {"mascotas": [{"tipo": "hamster"}]},
    {"tienda": "tiendita"},
])
def test_plan_perfil_invalido(cliente, perfil, cambio):
    perfil.update(cambio)
    r = cliente.post("/api/plan", json={"perfil": perfil})
    assert r.status_code == 422
    assert isinstance(r.json()["detail"], str)


def test_reporte_de_precio_se_guarda(cliente):
    r = cliente.post("/api/reporte", json={"tipo": "precio", "producto_id": "M001", "precio_reportado": 155.5})
    assert r.status_code == 201
    lineas = api_app.REPORTES_PATH.read_text(encoding="utf-8").splitlines()
    assert json.loads(lineas[-1])["precio_reportado"] == 155.5


@pytest.mark.parametrize("cuerpo", [
    {"tipo": "precio", "producto_id": "M001"},
    {"tipo": "precio", "producto_id": "NOEXISTE", "precio_reportado": 10},
    {"tipo": "comentario", "comentario": "   "},
])
def test_reporte_invalido(cliente, cuerpo):
    assert cliente.post("/api/reporte", json=cuerpo).status_code == 422


def test_descargar_reportes_requiere_clave(cliente, monkeypatch):
    assert cliente.get("/api/reportes").status_code == 404  # sin REPORTES_TOKEN no existe
    monkeypatch.setattr(api_app, "REPORTES_TOKEN", "secreta")
    assert cliente.get("/api/reportes").status_code == 401
    assert cliente.get("/api/reportes", headers={"Authorization": "Bearer otra"}).status_code == 401

    cliente.post("/api/reporte", json={"tipo": "comentario", "comentario": "Muy útil"})
    r = cliente.get("/api/reportes", headers={"Authorization": "Bearer secreta"})
    assert r.status_code == 200
    assert json.loads(r.text.splitlines()[-1])["comentario"] == "Muy útil"


def test_plan_en_otra_tienda_con_precios_del_estado(cliente, perfil):
    perfil.update(tienda="soriana", estado="Jalisco")
    datos = cliente.post("/api/plan", json={"perfil": perfil}).json()
    assert datos["catalogo"]["tienda"] == "Soriana"
    assert datos["catalogo"]["estado"] == "Jalisco"
    assert 0 < datos["total"] <= 10000


def test_niveles_de_marca_gastan_distinto(cliente, perfil):
    totales = {}
    for nivel in ("ahorro", "equilibrado", "premium"):
        perfil["nivel"] = nivel
        totales[nivel] = cliente.post("/api/plan", json={"perfil": perfil}).json()["total"]
    assert totales["ahorro"] < totales["equilibrado"] < totales["premium"] <= 10000


def test_ya_tengo_en_casa_descuenta_la_necesidad(cliente, perfil):
    base = cliente.post("/api/plan", json={"perfil": perfil}).json()
    r = cliente.post("/api/plan", json={"perfil": perfil, "ajustes": {"en_casa": {"leche": 0.5, "papel_higienico": 1}}})
    datos = r.json()
    leche = lambda d: next(c for c in d["cobertura"] if c["clave"] == "leche")
    assert leche(datos)["requerido"] == pytest.approx(leche(base)["requerido"] / 2)
    assert leche(datos)["en_casa"] == 0.5
    assert "papel_higienico" not in {c["clave"] for c in datos["cobertura"]}
    assert not any(l["necesidad"] == "papel_higienico" for l in datos["lineas"])
    assert datos["total"] < base["total"]


def test_cobertura_explica_las_cantidades(cliente, perfil):
    datos = cliente.post("/api/plan", json={"perfil": perfil}).json()
    leche = next(c for c in datos["cobertura"] if c["clave"] == "leche")
    assert leche["explicacion"] == "2 niños × 12 L + 2 adultos × 7 L al mes"


def test_consejo_cuando_no_alcanza_el_presupuesto(cliente, perfil):
    perfil["presupuesto"] = 4000
    datos = cliente.post("/api/plan", json={"perfil": perfil}).json()
    assert datos["costo_completo"] > 4000
    assert any("cubrirías todo" in c for c in datos["consejos"])


def test_buscar_marca_incompatibles(cliente, perfil):
    resultados = cliente.post("/api/buscar", json={"perfil": perfil, "texto": "atun"}).json()["resultados"]
    assert resultados and all(not r["compatible"] and "pescado" in r["motivo"] for r in resultados)
    resultados = cliente.post("/api/buscar", json={"perfil": perfil, "texto": "frijoles negros"}).json()["resultados"]
    assert resultados and all(r["compatible"] for r in resultados)
    assert all("negro" in r["nombre"].lower() for r in resultados)
    # Los extras (no calculados) también se pueden buscar para agregarlos a mano.
    extras = cliente.post("/api/buscar", json={"perfil": perfil, "texto": "rastrillos"}).json()["resultados"]
    assert extras and extras[0]["necesidad"] == "extras"


def test_alternativas_del_mismo_tipo_primero(cliente, perfil):
    leche = _id("leche", "lala", "1 l", "entera")
    r = cliente.post("/api/alternativas", json={"perfil": perfil, "producto_id": leche, "paquetes": 10})
    opciones = r.json()["alternativas"]
    assert opciones and opciones[0]["mismo_tipo"]
    assert all(o["necesidad"] == "leche" and o["compatible"] for o in opciones)
    primera = opciones[0]
    assert primera["paquetes_equivalentes"] * primera["contenido"] >= 10 - 1e-6


def test_comparar_tiendas(cliente, perfil):
    perfil["nivel"] = "ahorro"
    tiendas = cliente.post("/api/comparar", json={"perfil": perfil}).json()["tiendas"]
    assert len(tiendas) == 6
    assert sum(t["actual"] for t in tiendas) == 1
    completas = [t["total"] for t in tiendas if t["cobertura_completa"]]
    assert completas == sorted(completas) and len(completas) >= 4


def test_reporte_de_ticket(cliente):
    cuerpo = {"tipo": "ticket", "tienda": "walmart", "total_estimado": 7500, "total_real": 7812.4}
    assert cliente.post("/api/reporte", json=cuerpo).status_code == 201
    assert cliente.post("/api/reporte", json={"tipo": "ticket", "total_estimado": 7500}).status_code == 422
