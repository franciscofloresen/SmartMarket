# SmartMarket · Despensa inteligente

App que arma la despensa de un hogar mexicano para una semana, quincena o mes, ajustada a su
presupuesto, alergias, gustos, dieta y mascotas, con precios de referencia de Profeco en seis
cadenas: Walmart, Bodega Aurrerá, Soriana, Chedraui, La Comer y H-E-B.

- `despensa/`: motor (necesidades, filtros, optimizador, consultas).
- `api/`: API HTTP (FastAPI) y funciones opcionales de IA.
- `web/`: app para el celular (React, instalable como PWA).
- `herramientas/`: importador de precios de Profeco.

## Uso rápido

```bash
uv venv --python 3.12 .venv && uv pip install --python .venv/bin/python -r requirements-dev.txt
.venv/bin/python -m despensa perfiles/familia_4_perro.json
.venv/bin/python -m despensa perfiles/familia_4_perro.json --tienda chedraui --estado Jalisco
.venv/bin/python -m despensa perfiles/pareja_con_bebe.json --json
.venv/bin/python -m pytest
```

## Probar la app en tu iPhone

La Mac y el iPhone deben estar en la misma red Wi-Fi.

```bash
cd web && npm install && npm run build && cd ..
.venv/bin/uvicorn api.app:app --host 0.0.0.0 --port 8000
```

Abre en Safari del iPhone `http://<ip-de-tu-mac>:8000` (la IP sale con `ipconfig getifaddr en0`).
Para desarrollar con recarga en vivo, usa `npm run dev` en `web/` (puerto 5173; reenvía `/api`
a la API local).

Por la red local (HTTP) no hay modo sin conexión: Safari solo lo permite con HTTPS.

### Qué hace la app

- **Asistente del hogar** en 6 pasos: personas, mascotas, restricciones, antojos (refrescos,
  botanas, chocolates, cerveza...), estado y tienda, presupuesto y nivel de marcas.
- **Tiendas de tu estado**: el estado se elige de la lista o con "Usar mi ubicación" (las
  coordenadas no salen del teléfono). Solo se ofrecen y comparan las cadenas con sucursales ahí:
  en Jalisco no aparece H-E-B.
- **Inicio**: presupuesto usado, gasto por departamento, consejos y accesos rápidos.
- **Lista**: por departamento; cambiar cantidades, cambiar un producto por una alternativa (con la
  diferencia de precio), quitar lo que no gusta, buscar y agregar cualquier producto, marcar lo
  que ya hay en casa, comparar la despensa entre tiendas y compartirla.
- **Modo compra**: lista para marcar; al terminar se anota el total del ticket.
- **Más**: editar hogar, historial de compras, gustos recordados, apariencia (clara por defecto,
  oscura o automática), respaldo y borrar datos.

Todo se guarda en el teléfono (`localStorage`); el servidor no guarda perfiles.

### IA (opcional)

Con una clave de Anthropic, la app agrega tres funciones (`api/ia.py`):

- Describir el hogar con palabras y prellenar el asistente.
- Pedir cambios escribiendo ("quita los refrescos y agrega más fruta").
- Menú de la semana con lo que hay en la lista.

```bash
ANTHROPIC_API_KEY=sk-ant-... .venv/bin/uvicorn api.app:app --host 0.0.0.0 --port 8000
```

Sin la clave, esas opciones no aparecen y lo demás funciona igual. Cada uso cuesta centavos de
dólar; `IA_LLAMADAS_POR_HORA` (30 por defecto) limita el uso por dirección IP. La IA solo
interpreta y redacta: cantidades, precios y compatibilidad con alergias los decide el motor, y
todo lo que el modelo propone se valida contra el catálogo antes de aplicarse.

### Publicar (Railway)

`railway.json` le indica a Railway que construya el `Dockerfile` y revise `/api/salud`.

1. En https://railway.com crea un proyecto con **Deploy from GitHub repo** y elige este repositorio.
2. Agrega un **Volume** montado en `/data`, para que los reportes de los testers no se borren.
3. En **Variables** define `REPORTES_PATH=/data/reportes.jsonl`, `REPORTES_TOKEN=<clave larga>`
   (`openssl rand -hex 24`) y, si quieres IA, `ANTHROPIC_API_KEY`.
4. En *Settings → Networking* usa **Generate Domain** y comparte esa URL.

Para descargar los reportes (precios, tickets y comentarios):

```bash
curl -H "Authorization: Bearer $REPORTES_TOKEN" https://TU-DOMINIO.up.railway.app/api/reportes > reportes.jsonl
```

## Perfil del hogar (JSON)

```json
{
  "nombre": "Familia con 2 hijos y perro",
  "presupuesto": 10000,
  "periodo_dias": 30,
  "miembros": [{"nombre": "Mamá", "edad": 38, "sexo": "F"}, {"edad": 7}],
  "mascotas": [{"tipo": "perro", "tamano": "mediano"}, {"tipo": "gato"}],
  "alergias": ["pescado"],
  "excluir": ["brócoli", "coliflor"],
  "dieta": "vegetariana",
  "tortillas_caseras": false,
  "tienda": "walmart",
  "estado": "Jalisco",
  "nivel": "equilibrado",
  "antojos": ["refrescos", "botanas"]
}
```

| Campo | Opciones |
|---|---|
| `alergias` | pescado, mariscos, lácteos, huevo, gluten, cacahuate, nueces, soya, ajonjolí (acepta sinónimos: lactosa, trigo, maní...) |
| `excluir` | cualquier alimento; tolera acentos y plurales ("chiles" excluye chile serrano, jalapeños, chipotles) |
| `dieta` | `vegetariana`, `pescetariana`, `sin_cerdo` |
| `mascotas` | perro (`chico`, `mediano`, `grande`, `gigante`) o gato |
| `tienda` | `walmart`, `bodega_aurrera`, `soriana`, `chedraui`, `la_comer`, `heb` |
| `estado` | opcional; usa los precios que Profeco registró en ese estado, o el promedio nacional si no hay. También limita la comparación a las tiendas con sucursales ahí |
| `antojos` | opcional: `refrescos`, `jugos`, `botanas`, `dulces`, `galletas`, `postres`, `cerveza`. Se suman a la lista con prioridad opcional: si el presupuesto no alcanza, es lo primero que se recorta |
| `nivel` | `ahorro` (lo más barato), `equilibrado` (parte del sobrante en mejores marcas), `premium` (todo el presupuesto) |

## Cómo funciona el motor

```
perfil ──► necesidades ──► filtro ──► optimizador ──► lista de compra
           (reglas.py)    (alergias,   (2 a 4 fases)   (cantidades, total,
                           exclusiones)                 cobertura, consejos)
```

1. **Necesidades** (`reglas.py`, `necesidades.py`): consumo mensual por persona según grupo de
   edad, más pañales, toallas femeninas y alimento de mascotas. Cada cantidad lleva su
   explicación ("2 niños × 12 L + 2 adultos × 7 L al mes"). Lo que el hogar dice tener ya en casa
   se descuenta.
2. **Filtro** (`catalogo.py`): con una alergia declarada se quita todo producto que la **contenga
   o pueda contenerla**, además de lo excluido por gusto o dieta. Si una necesidad queda sin
   opciones (carne en dieta vegetariana), su cantidad pasa a sus sustitutos.
3. **Optimizador** (`optimizador.py`, programación lineal entera con PuLP + HiGHS):
   - Fase 1: cubrir lo más posible dentro del presupuesto. El faltante se castiga por prioridad
     (esencial ≫ importante ≫ opcional) y por tramos, para recortar un poco de varias cosas en
     lugar de eliminar una.
   - Fase 2: con esa cobertura, la combinación más barata, prefiriendo menos paquetes.
   - Fases 3 y 4 (niveles `equilibrado` y `premium`): con parte del sobrante, subir de marca.
   - Reglas de sentido común: básicos que no deben faltar (jitomate, frijol, sal...), variedad
     por producto y por tipo, y topes a sustitutos baratos (embutidos, producto lácteo, quesos de
     imitación).
4. **Consultas** (`consultas.py`): buscar en el catálogo, alternativas a un producto y la misma
   despensa en cada tienda.

## Datos

- `data/catalogos/<tienda>.csv`: entre 860 y 1,170 productos por tienda, generados desde los
  datos abiertos de Profeco ("Quién es Quién en los Precios", segunda quincena de julio 2026).
  El precio es la mediana nacional de lo que Profeco registró en esa cadena.
- `data/precios_estado/<tienda>.csv`: la mediana por estado, donde hay al menos 3 registros.
- Qué cadenas hay en cada estado sale de esos precios por estado; Walmart, Bodega Aurrerá, Soriana
  y Chedraui se consideran nacionales, y `PRESENCIA_EXTRA` (`despensa/reglas.py`) agrega estados
  donde H-E-B o La Comer tienen sucursales pero Profeco no les levantó precios.
- `data/catalogo_manual.csv`: lo que Profeco no levanta (alimento y arena para mascotas, bolsas
  de basura, bebidas vegetales). **Sus precios son estimados** y hay que verificarlos a mano.

### Actualizar precios

1. Descarga el ZIP del año en https://datos.profeco.gob.mx/datos_abiertos/qqp.php
2. Revisa el reporte y luego aplica:

```bash
.venv/bin/python herramientas/importar_qqp.py RUTA/QQP_2026.zip            # solo reporte
.venv/bin/python herramientas/importar_qqp.py RUTA/QQP_2026.zip --aplicar  # escribe los catálogos
```

`herramientas/reglas_qqp.py` define, para cada tipo de producto de Profeco, qué necesidad cubre,
cómo se mide su presentación y qué alérgenos **contiene** o **puede contener**. Los alérgenos se
asignan por tipo de producto, no por etiqueta: ante la duda, se agregan a "puede contener".

> ⚠ Profeco publica precios de referencia; cada sucursal puede variar. La información de alérgenos
> no sustituye la lectura de la etiqueta de cada producto.

## Pendientes sugeridos

- Probar la IA con una clave real (solo está probada con un modelo simulado).
- Verificar los precios estimados del catálogo manual.
- Fórmula infantil y etapas de pañal por edad como necesidades calculadas.
- Fotos de producto (hoy cada producto se muestra con un emoji).
