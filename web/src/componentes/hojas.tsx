import { useEffect, useState } from "react";
import { api, ErrorApi } from "../api";
import { useApp } from "../estado";
import { cantidad, dinero, fechaCorta, partirNombre } from "../formato";
import { departamento, iconoProducto } from "../iconos";
import type { Alternativa, Linea, ProductoResumen, TiendaComparada } from "../tipos";
import { Aviso, Boton, Burbuja, Campo, claseEntrada, Hoja, Segmentado, Stepper } from "./ui";

/** Carga algo de la API al montar; se usa dentro de hojas, que se montan al abrirse. */
function useCarga<T>(pedir: () => Promise<T>): { datos: T | null; error: string | null } {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let vigente = true;
    pedir()
      .then((d) => vigente && setDatos(d))
      .catch((e) => vigente && setError(e instanceof ErrorApi ? e.message : "No se pudo cargar."));
    return () => {
      vigente = false;
    };
    // Solo al montar: quien llama remonta el componente (con `key`) si cambian los parámetros.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { datos, error };
}

function Esqueleto({ filas = 3 }: { filas?: number }) {
  return (
    <div className="flex flex-col gap-2" role="status" aria-label="Cargando">
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl bg-hundido" />
      ))}
    </div>
  );
}

const NOMBRE_NIVEL: Record<string, string> = { economico: "Económico", medio: "Marca media", premium: "Marca líder" };

// ---------------------------------------------------------------- Producto

export function HojaProducto({ linea, onCerrar }: { linea: Linea | null; onCerrar: () => void }) {
  return (
    <Hoja abierta={linea !== null} onCerrar={onCerrar} titulo={linea ? partirNombre(linea.nombre).titulo : ""}>
      {/* La key reinicia el estado interno cada vez que se abre otro producto. */}
      {linea && <ContenidoProducto key={linea.id} linea={linea} onCerrar={onCerrar} />}
    </Hoja>
  );
}

function ContenidoProducto({ linea, onCerrar }: { linea: Linea; onCerrar: () => void }) {
  const { datos, aplicarAjustes, quitarProducto } = useApp();
  const { ajustes } = datos;
  const [paquetes, setPaquetes] = useState(linea.paquetes);
  const [vista, setVista] = useState<"principal" | "cambiar" | "reportar">("principal");
  const { detalle } = partirNombre(linea.nombre);

  const { [linea.id]: _fijado, ...sinFijar } = ajustes.fijar;
  const aplicar = (nuevos: typeof ajustes) => {
    onCerrar();
    return aplicarAjustes(nuevos);
  };

  if (vista === "reportar") return <ReportePrecio linea={linea} onListo={onCerrar} onVolver={() => setVista("principal")} />;
  if (vista === "cambiar") {
    return (
      <Alternativas
        linea={linea}
        onVolver={() => setVista("principal")}
        onElegir={(alt) =>
          // Cambio puntual: sale el original de esta lista y entra la alternativa en cantidad equivalente.
          aplicar({
            ...ajustes,
            excluir_productos: [...new Set([...ajustes.excluir_productos, linea.id])],
            fijar: { ...sinFijar, [alt.id]: alt.paquetes_equivalentes },
          })
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Burbuja emoji={iconoProducto(linea)} fondo={departamento(linea.departamento).fondo} tam="lg" />
        <div className="min-w-0 text-sm text-suave">
          {detalle && <p className="text-base text-tinta">{detalle}</p>}
          <p>
            {dinero(linea.precio_unitario)} c/u · {NOMBRE_NIVEL[linea.nivel] ?? ""}
          </p>
          <p>
            {linea.fuente_precio === "estimado"
              ? "Precio estimado, sin verificar"
              : `Precio Profeco${linea.fecha_precio ? ` al ${fechaCorta(linea.fecha_precio)}` : ""}`}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-3xl bg-tarjeta p-4 shadow-suave">
        <div>
          <p className="font-semibold">Cantidad</p>
          <p className="tabular text-sm text-suave">{dinero(paquetes * linea.precio_unitario)}</p>
        </div>
        <Stepper etiqueta="paquetes" valor={paquetes} onCambio={setPaquetes} />
      </div>

      {paquetes !== linea.paquetes && (
        <Boton
          ancho
          onClick={() =>
            paquetes === 0
              ? (onCerrar(), quitarProducto(linea.id))
              : aplicar({ ...ajustes, fijar: { ...ajustes.fijar, [linea.id]: paquetes } })
          }
        >
          {paquetes === 0 ? "Quitar de la lista" : `Llevar ${paquetes} y recalcular`}
        </Boton>
      )}
      {linea.fijado && paquetes === linea.paquetes && (
        <Boton variante="secundario" ancho onClick={() => aplicar({ ...ajustes, fijar: sinFijar })}>
          🤖 Que la app decida la cantidad
        </Boton>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Boton variante="secundario" onClick={() => setVista("cambiar")} disabled={linea.necesidad === "extras"}>
          🔄 Cambiar
        </Boton>
        <Boton variante="peligro" onClick={() => (onCerrar(), quitarProducto(linea.id))}>
          👎 No me gusta
        </Boton>
      </div>
      <p className="text-center text-xs text-suave">
        Al quitar o cambiar algo, ajustamos el resto para cubrir lo que hace falta sin pasar tu presupuesto. Lo que no te gusta lo
        recordamos para tus próximas listas.
      </p>
      <Boton variante="texto" ancho onClick={() => setVista("reportar")}>
        ¿El precio está mal? Repórtalo
      </Boton>
    </div>
  );
}

function Alternativas({ linea, onVolver, onElegir }: { linea: Linea; onVolver: () => void; onElegir: (a: Alternativa) => void }) {
  const { datos } = useApp();
  const { datos: opciones, error } = useCarga(() => api.alternativas(datos.hogar!, linea.id, linea.paquetes));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-suave">
        Opciones para cambiar {linea.paquetes} × {partirNombre(linea.nombre).titulo}. Mostramos cuánto sube o baja tu cuenta.
      </p>
      {error && <Aviso tono="error">{error}</Aviso>}
      {!opciones && !error && <Esqueleto filas={4} />}
      {opciones?.length === 0 && <Aviso tono="alerta">No encontramos otras opciones compatibles con tu hogar.</Aviso>}
      {opciones && opciones.length > 0 && (
        <ul className="flex flex-col gap-2">
          {opciones.map((a) => {
            const { titulo, detalle } = partirNombre(a.nombre);
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => onElegir(a)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-tarjeta p-3 text-left shadow-suave active:scale-[0.98]"
                >
                  <Burbuja emoji={iconoProducto(a)} fondo={departamento(a.departamento).fondo} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-snug">{titulo}</span>
                    <span className="block truncate text-xs text-suave">
                      {a.paquetes_equivalentes} × {detalle || `${cantidad(a.contenido)} ${a.unidad}`}
                    </span>
                  </span>
                  <span
                    className={`tabular shrink-0 rounded-full px-2.5 py-1 text-sm font-bold ${
                      a.diferencia <= 0 ? "bg-nopal-tenue text-nopal-fuerte" : "bg-maiz-tenue text-tinta"
                    }`}
                  >
                    {a.diferencia === 0 ? "igual" : `${a.diferencia < 0 ? "−" : "+"}${dinero(Math.abs(a.diferencia))}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <Boton variante="texto" ancho onClick={onVolver}>
        ← Volver
      </Boton>
    </div>
  );
}

function ReportePrecio({ linea, onListo, onVolver }: { linea: Linea; onListo: () => void; onVolver: () => void }) {
  const [precio, setPrecio] = useState("");
  const [sucursal, setSucursal] = useState("");
  const [estado, setEstado] = useState<"editando" | "enviando" | "enviado">("editando");
  const [error, setError] = useState<string | null>(null);
  const valor = Number(precio.replace(",", "."));

  if (estado === "enviado") {
    return (
      <div className="flex flex-col gap-3">
        <Aviso>¡Gracias! Con tu reporte mejoramos los precios para todos.</Aviso>
        <Boton ancho onClick={onListo}>
          Listo
        </Boton>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setEstado("enviando");
        setError(null);
        try {
          await api.reportarPrecio(linea.id, valor, sucursal.trim());
          setEstado("enviado");
        } catch (err) {
          setError(err instanceof ErrorApi ? err.message : "No se pudo enviar.");
          setEstado("editando");
        }
      }}
    >
      <Campo etiqueta={`¿Qué precio viste? (nosotros tenemos ${dinero(linea.precio_unitario)})`}>
        {(id) => (
          <input
            id={id}
            className={`${claseEntrada} tabular`}
            inputMode="decimal"
            placeholder={String(linea.precio_unitario)}
            value={precio}
            onChange={(e) => setPrecio(e.target.value.replace(/[^\d.,]/g, ""))}
          />
        )}
      </Campo>
      <Campo etiqueta="Sucursal (opcional)">
        {(id) => (
          <input
            id={id}
            className={claseEntrada}
            maxLength={100}
            placeholder="Ej. Av. Universidad, CDMX"
            value={sucursal}
            onChange={(e) => setSucursal(e.target.value)}
          />
        )}
      </Campo>
      {error && <Aviso tono="error">{error}</Aviso>}
      <Boton type="submit" ancho disabled={!(valor > 0) || estado === "enviando"}>
        {estado === "enviando" ? "Enviando…" : "Enviar reporte"}
      </Boton>
      <Boton variante="texto" ancho onClick={onVolver}>
        ← Volver
      </Boton>
    </form>
  );
}

// ---------------------------------------------------------------- Buscar y agregar

export function HojaBuscar({ abierta, onCerrar }: { abierta: boolean; onCerrar: () => void }) {
  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="Agregar un producto">
      {abierta && <Buscador onCerrar={onCerrar} />}
    </Hoja>
  );
}

const SUGERENCIAS = ["café", "yogur griego", "atún", "cerveza", "rastrillos", "helado", "salmón", "pañales"];

function Buscador({ onCerrar }: { onCerrar: () => void }) {
  const { datos, aplicarAjustes } = useApp();
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<ProductoResumen[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const enLista = new Map(datos.plan?.lineas.map((l) => [l.id, l.paquetes]) ?? []);

  useEffect(() => {
    const limpio = texto.trim();
    if (limpio.length < 2) {
      setResultados(null);
      return;
    }
    let vigente = true;
    // Espera a que el usuario deje de escribir antes de consultar.
    const espera = setTimeout(() => {
      api
        .buscar(datos.hogar!, limpio)
        .then((r) => vigente && (setResultados(r), setError(null)))
        .catch((e) => vigente && setError(e instanceof ErrorApi ? e.message : "No se pudo buscar."));
    }, 300);
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [texto, datos.hogar]);

  function agregar(p: ProductoResumen) {
    const { ajustes } = datos;
    onCerrar();
    void aplicarAjustes({
      ...ajustes,
      excluir_productos: ajustes.excluir_productos.filter((x) => x !== p.id),
      fijar: { ...ajustes.fijar, [p.id]: (enLista.get(p.id) ?? 0) + 1 },
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        className={claseEntrada}
        type="search"
        enterKeyHint="search"
        autoFocus
        value={texto}
        maxLength={60}
        placeholder={`Buscar en ${datos.plan?.catalogo.tienda ?? "la tienda"}…`}
        aria-label="Buscar producto"
        onChange={(e) => setTexto(e.target.value)}
      />
      {error && <Aviso tono="error">{error}</Aviso>}
      {resultados === null && texto.trim().length < 2 && (
        <div className="flex flex-wrap gap-2">
          {SUGERENCIAS.map((s) => (
            <button
              key={s}
              type="button"
              className="min-h-10 rounded-full bg-hundido px-4 text-sm font-medium active:scale-95"
              onClick={() => setTexto(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}
      {resultados === null && texto.trim().length >= 2 && !error && <Esqueleto />}
      {resultados?.length === 0 && <Aviso tono="alerta">No encontramos “{texto.trim()}” en esta tienda.</Aviso>}
      {resultados && resultados.length > 0 && (
        <ul className="flex flex-col gap-2">
          {resultados.map((p) => {
            const { titulo, detalle } = partirNombre(p.nombre);
            const ya = enLista.get(p.id);
            return (
              <li key={p.id} className={`flex items-center gap-3 rounded-2xl bg-tarjeta p-3 shadow-suave ${p.compatible ? "" : "opacity-60"}`}>
                <Burbuja emoji={iconoProducto(p)} fondo={departamento(p.departamento).fondo} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-snug">{titulo}</p>
                  <p className="line-clamp-2 text-xs text-suave">{detalle}</p>
                  <p className="tabular text-sm">
                    {dinero(p.precio)}
                    {!p.compatible && <span className="ml-2 font-semibold text-rosa">🚫 {p.motivo}</span>}
                    {ya && <span className="ml-2 font-semibold text-nopal">en tu lista: {ya}</span>}
                  </p>
                </div>
                {p.compatible && (
                  <button
                    type="button"
                    onClick={() => agregar(p)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-nopal text-2xl font-bold text-white active:scale-90"
                    aria-label={`Agregar ${titulo}`}
                  >
                    +
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Ya tengo en casa

export function HojaEnCasa({ abierta, onCerrar }: { abierta: boolean; onCerrar: () => void }) {
  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="¿Qué ya tienes en casa?">
      {abierta && <EnCasa onCerrar={onCerrar} />}
    </Hoja>
  );
}

function EnCasa({ onCerrar }: { onCerrar: () => void }) {
  const { datos, opciones, aplicarAjustes } = useApp();
  const [enCasa, setEnCasa] = useState<Record<string, number>>(datos.ajustes.en_casa);
  // Las categorías de la lista actual, más las que ya se marcaron como "tengo todo" (ya no salen en la lista).
  const claves = [...new Set([...(datos.plan?.cobertura.map((c) => c.clave) ?? []), ...Object.keys(datos.ajustes.en_casa)])];
  const nombre = (clave: string) =>
    datos.plan?.cobertura.find((c) => c.clave === clave)?.nombre ?? opciones.necesidades.find((n) => n.clave === clave)?.nombre ?? clave;
  const cambios = JSON.stringify(enCasa) !== JSON.stringify(datos.ajustes.en_casa);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-suave">Marca lo que te queda y lo descontamos de la lista.</p>
      <ul className="flex flex-col gap-3">
        {claves.map((clave) => (
          <li key={clave}>
            <p className="mb-1 font-semibold">{nombre(clave)}</p>
            <Segmentado
              etiqueta={nombre(clave)}
              valor={enCasa[clave] ?? 0}
              onCambio={(v) =>
                setEnCasa((actual) => {
                  const { [clave]: _anterior, ...resto } = actual;
                  return v === 0 ? resto : { ...resto, [clave]: v };
                })
              }
              opciones={[
                { valor: 0, texto: "No tengo" },
                { valor: 0.5, texto: "La mitad" },
                { valor: 1, texto: "Tengo todo" },
              ]}
            />
          </li>
        ))}
      </ul>
      <div className="sticky bottom-0 bg-fondo pb-1 pt-2">
        <Boton
          ancho
          disabled={!cambios}
          onClick={() => {
            onCerrar();
            void aplicarAjustes({ ...datos.ajustes, en_casa: enCasa });
          }}
        >
          Actualizar mi lista
        </Boton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Comparar tiendas

export function HojaComparar({ abierta, onCerrar }: { abierta: boolean; onCerrar: () => void }) {
  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="Tu despensa en cada tienda">
      {abierta && <Comparador onCerrar={onCerrar} />}
    </Hoja>
  );
}

function Comparador({ onCerrar }: { onCerrar: () => void }) {
  const { datos, cambiarTienda } = useApp();
  const { datos: tiendas, error } = useCarga<TiendaComparada[]>(() => api.comparar(datos.hogar!, datos.ajustes));
  // Las diferencias entre tiendas son de pocos puntos porcentuales: la barra arranca cerca del
  // total más bajo para que se noten.
  const totales = tiendas?.map((t) => t.total) ?? [1];
  const base = Math.min(...totales) * 0.9;
  const maximo = Math.max(...totales);
  const actual = tiendas?.find((t) => t.actual);
  const mejor = tiendas?.find((t) => t.cobertura_completa);

  return (
    <div className="flex flex-col gap-3">
      {error && <Aviso tono="error">{error}</Aviso>}
      {!tiendas && !error && (
        <>
          <p className="text-sm text-suave">Armando la misma despensa en 6 tiendas… tarda unos segundos.</p>
          <Esqueleto filas={6} />
        </>
      )}
      {tiendas && actual && mejor && (
        <>
          {mejor.clave === actual.clave ? (
            <Aviso>¡Ya estás en la tienda más barata para tu despensa!</Aviso>
          ) : (
            <Aviso tono="consejo">
              En <strong>{mejor.tienda}</strong> tu despensa cuesta <strong>{dinero(actual.total - mejor.total)}</strong> menos.
            </Aviso>
          )}
          <ul className="flex flex-col gap-2">
            {tiendas.map((t, i) => (
              <li key={t.clave} className={`rounded-2xl p-3 ${t.actual ? "bg-nopal-tenue ring-2 ring-nopal" : "bg-tarjeta shadow-suave"}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-titulo text-lg font-semibold">
                    {i === 0 && t.cobertura_completa && "🏆 "}
                    {t.tienda}
                    {t.actual && <span className="ml-2 text-xs font-normal text-suave">tu tienda</span>}
                  </span>
                  <span className="tabular font-titulo text-lg font-bold">{dinero(t.total)}</span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-hundido" aria-hidden="true">
                  <div
                    className={`h-full rounded-full ${t.cobertura_completa ? "bg-nopal" : "bg-maiz"}`}
                    style={{ width: `${Math.max(8, ((t.total - base) / (maximo - base || 1)) * 100)}%` }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-suave">
                  <span>{t.cobertura_completa ? `${t.productos} productos · cubre todo` : "⚠️ no alcanza a cubrir todo"}</span>
                  {!t.actual && (
                    <button
                      type="button"
                      className="min-h-9 rounded-full bg-nopal px-3 text-sm font-semibold text-white active:scale-95"
                      onClick={() => {
                        onCerrar();
                        void cambiarTienda(t.clave);
                      }}
                    >
                      Cambiar aquí
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <p className="text-center text-xs text-suave">
            Precios de referencia de Profeco. Cada tienda maneja marcas distintas, así que los productos pueden cambiar.
          </p>
        </>
      )}
    </div>
  );
}
