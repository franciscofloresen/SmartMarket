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

`data/catalogo_walmart.csv`: 181 productos. Columnas: necesidad que cubren, contenido en
la unidad de esa necesidad, precio, alérgenos, etiquetas, vida útil y si se congela.

> ⚠ **Los precios son aproximados y no se han verificado** contra la tienda. Antes de usar el
> motor con familias reales hay que cargar precios actuales. Fuentes posibles: datos abiertos
> de Profeco ("Quién es Quién en los Precios"), tickets escaneados o un convenio con la cadena.
> La información de alérgenos debe validarse con la etiqueta de cada producto.

## Pendientes sugeridos

- Precios reales y actualización periódica del catálogo.
- API (FastAPI) sobre `planear()` usando `Plan.a_dict()` y app móvil.
- Modo "aprovechar presupuesto": usar el sobrante en marcas preferidas o productos de mejor
  calidad (requiere una calificación por producto).
- Fórmula infantil, etapas de pañal por edad y más tipos de mascota.
