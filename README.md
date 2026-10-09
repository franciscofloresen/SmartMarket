# SmartMarket · Despensa inteligente

Motor que arma la despensa de un hogar mexicano para un periodo (por defecto 30 días),
ajustada a su presupuesto, alergias, alimentos excluidos, dieta y mascotas.
Por ahora trabaja con un solo catálogo: **Walmart Supercenter** (el surtido más amplio
de despensa, frescos, limpieza, bebé y mascotas, con presencia nacional).

## Uso rápido

```bash
uv venv --python 3.12 .venv && uv pip install --python .venv/bin/python -r requirements.txt
.venv/bin/python -m despensa perfiles/familia_4_perro.json
.venv/bin/python -m despensa perfiles/familia_4_perro.json --presupuesto 5000
.venv/bin/python -m despensa perfiles/pareja_con_bebe.json --json   # salida para la app/API
.venv/bin/python -m pytest
```

## Web app (beta)

La app para el celular está en `web/` (React + TypeScript + Vite + Tailwind, instalable como PWA).

**Probar en tu iPhone (desarrollo).** La Mac y el iPhone deben estar en la misma red Wi-Fi:

```bash
.venv/bin/uvicorn api.app:app --port 8000          # terminal 1: API
cd web && npm install && npm run dev                # terminal 2: web app
```

Vite muestra una dirección `Network: http://192.168.x.x:5173`. Ábrela en Safari del iPhone.
Las llamadas a `/api` se reenvían a la API local.

**Producción.** `npm run build` genera `web/dist`, y la API la sirve en `/` (misma URL). El
`Dockerfile` hace las dos cosas en una sola imagen.

Pantallas:
- Bienvenida
- Asistente del hogar (personas, mascotas, alimentación, presupuesto)
- Lista: quitar o fijar cantidades y recalcular, reportar precios
- Modo compra: lista para marcar, funciona sin conexión
- Más: editar hogar, comentarios, respaldo y borrar datos

Todo se guarda en el teléfono (`localStorage`); el servidor no guarda perfiles.

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
  "tortillas_caseras": false
}
```

| Campo | Opciones |
|---|---|
| `alergias` | pescado, mariscos, lácteos, huevo, gluten, cacahuate, nueces, soya, ajonjolí (acepta sinónimos: lactosa, trigo, maní...) |
| `excluir` | cualquier alimento; tolera acentos y plurales ("chiles" excluye chile serrano, jalapeños, chipotles) |
| `dieta` | `vegetariana`, `pescetariana`, `sin_cerdo` |
| `mascotas` | perro (`chico`, `mediano`, `grande`, `gigante`) o gato |

## Cómo funciona

```
perfil ──► necesidades ──► filtro ──► optimizador ──► lista de compra
           (reglas.py)    (alergias,   (2 fases)       (cantidades, total,
                           exclusiones)                 cobertura, notas)
```

1. **Necesidades** (`despensa/reglas.py`, `necesidades.py`): consumo mensual por persona según
   grupo de edad (bebé, niño, adolescente, adulto, mayor) y reglas especiales: pañales,
   toallas femeninas y alimento de mascotas. Todo es configurable en `reglas.py`.
2. **Filtro** (`catalogo.py`): quita productos con alérgenos declarados (incluye ocultos como
   salsa inglesa o aderezo César para pescado) y los excluidos por el usuario o su dieta.
   Si una necesidad queda sin opciones (p. ej. carne en dieta vegetariana), su cantidad pasa
   a sus sustitutos (leguminosas y huevo).
3. **Optimizador** (`optimizador.py`, programación lineal entera con PuLP + HiGHS):
   - Fase 1: cubrir lo más posible dentro del presupuesto. El faltante se castiga por
     prioridad (esencial ≫ importante ≫ opcional) y por tramos, para recortar un poco de varias
     cosas en lugar de eliminar una. También castiga que falten básicos (jitomate, cebolla,
     frijol, sal...) en su proporción mínima.
   - Fase 2: con esa cobertura, la combinación más barata. Lo que sobra se reporta.
   - Restricciones: paquetes enteros, tope de compra en exceso y variedad (ningún producto
     puede cubrir toda la necesidad de frutas, verduras o carnes).
4. **Frescos**: los productos que caducan antes del fin del periodo y no se congelan se marcan
   para repartirse en varias compras.

## Datos

`data/catalogo_walmart.csv`: 192 productos. Columnas: necesidad que cubren, contenido en la unidad
de esa necesidad, precio, alérgenos, etiquetas, vida útil, si se congela, y de dónde sale el precio
(`fuente_precio`, `fecha_precio`).

**149 precios vienen de Profeco** ("Quién es Quién en los Precios", datos abiertos, cadena
Wal-mart, segunda quincena de julio 2026): la mediana de lo que Profeco registró en tiendas
Walmart de todo el país. **43 siguen estimados**, porque Profeco no los levanta: alimento y arena
de mascotas, bolsas de basura, toallas de cocina, bebidas vegetales, toallitas húmedas y algunos
condimentos. Esos hay que verificarlos a mano.

### Actualizar precios

1. Descarga el ZIP del año en https://datos.profeco.gob.mx/datos_abiertos/qqp.php
2. Revisa el reporte y luego aplica:

```bash
.venv/bin/python herramientas/precios_qqp.py RUTA/QQP_2026.zip            # solo reporte
.venv/bin/python herramientas/precios_qqp.py RUTA/QQP_2026.zip --aplicar  # escribe el catálogo
```

`data/mapeo_qqp.csv` asocia cada producto del catálogo con los registros de Profeco: producto
exacto, expresiones regulares para presentación y marca, y un factor (ej. 6 bolillos = 6 × precio
por pieza). El reporte marca para revisión los cambios de más del 50% y los productos con pocos
registros. Si cambias el nombre de un producto, **revisa sus etiquetas y alérgenos**, porque de
ellas dependen los filtros.

> ⚠ Profeco publica precios de referencia; cada sucursal puede variar. La información de alérgenos
> debe validarse con la etiqueta de cada producto.

## Pendientes sugeridos

- Verificar a mano los 43 precios estimados (mascotas, bolsas, toallas de cocina...).
- Publicar la beta (Render, Railway o Fly.io) y compartir con familias de prueba.
- Modo "aprovechar presupuesto": usar el sobrante en marcas preferidas o productos de mejor
  calidad (requiere una calificación por producto).
- Fórmula infantil, etapas de pañal por edad y más tipos de mascota.
