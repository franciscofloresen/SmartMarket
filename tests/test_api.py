import json
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import api.app as api_app

PERFILES = Path(__file__).resolve().parent.parent / "perfiles"


@pytest.fixture
def cliente(tmp_path, monkeypatch):
    monkeypatch.setattr(api_app, "REPORTES_PATH", tmp_path / "reportes.jsonl")
    return TestClient(api_app.app)


@pytest.fixture
def perfil():
    return json.loads((PERFILES / "familia_4_perro.json").read_text(encoding="utf-8"))


def test_salud(cliente):
    assert cliente.get("/api/salud").json() == {"ok": True}


def test_opciones(cliente):
    datos = cliente.get("/api/opciones").json()
    assert {"clave": "pescado", "nombre": "Pescado"} in datos["alergias"]
    assert {a["clave"] for a in datos["dietas"]} == {"vegetariana", "pescetariana", "sin_cerdo"}
    assert datos["catalogo"]["productos"] > 100


def test_plan_caso_de_ejemplo_rapido(cliente, perfil):
    inicio = time.perf_counter()
    r = cliente.post("/api/plan", json={"perfil": perfil})
    duracion = time.perf_counter() - inicio
    assert r.status_code == 200, r.text
    datos = r.json()
    assert 0 < datos["total"] <= 10000
    assert datos["catalogo"]["tienda"] == "Walmart Supercenter"
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
    r = cliente.post("/api/plan", json={"perfil": perfil, "ajustes": {"fijar": {"C007": 10}}})
    assert r.status_code == 200, r.text
    datos = r.json()
    linea = next(l for l in datos["lineas"] if l["id"] == "C007")
    assert linea["paquetes"] == 10 and linea["fijado"] is True
    assert datos["total"] <= 10000


def test_plan_fijar_producto_que_el_hogar_no_necesita(cliente, perfil):
    perfil["mascotas"] = []
    r = cliente.post("/api/plan", json={"perfil": perfil, "ajustes": {"fijar": {"M002": 1}}})
    assert r.status_code == 200, r.text
    assert any(l["id"] == "M002" and l["paquetes"] == 1 for l in r.json()["lineas"])


@pytest.mark.parametrize("ajustes, mensaje", [
    ({"fijar": {"NOEXISTE": 1}}, "no existen"),
    ({"fijar": {"C014": 1}}, "no es compatible"),        # atún con alergia a pescado
    ({"fijar": {"M004": 11}}, "superan el presupuesto"),  # 11 × $999
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
])
def test_plan_perfil_invalido(cliente, perfil, cambio):
    perfil.update(cambio)
    r = cliente.post("/api/plan", json={"perfil": perfil})
    assert r.status_code == 422
    assert isinstance(r.json()["detail"], str)


def test_reporte_de_precio_se_guarda(cliente):
    r = cliente.post("/api/reporte", json={"tipo": "precio", "producto_id": "C001", "precio_reportado": 155.5})
    assert r.status_code == 201
    lineas = api_app.REPORTES_PATH.read_text(encoding="utf-8").splitlines()
    assert json.loads(lineas[-1])["precio_reportado"] == 155.5


@pytest.mark.parametrize("cuerpo", [
    {"tipo": "precio", "producto_id": "C001"},
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
