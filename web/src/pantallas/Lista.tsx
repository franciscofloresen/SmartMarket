import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api, ErrorApi } from "../api";
import { Aviso, Boton, Campo, Cargando, claseEntrada, Encabezado, Hoja, Stepper, Tarjeta } from "../componentes/ui";
import { useApp } from "../estado";
import { agruparPorDepartamento, dinero, dineroEntero, fechaCorta } from "../formato";
import type { Ajustes, Cobertura, Linea, Plan } from "../tipos";

const MOTIVO_QUITADO = "quitado por ti";

export default function Lista() {
  const { datos, cargando, error, limpiarError, aplicarAjustes, regenerar } = useApp();
  const [seleccionada, setSeleccionada] = useState<Linea | null>(null);
  const { hogar, plan, ajustes } = datos;

  if (!hogar) return <Navigate to="/" replace />;

  const periodo = hogar.periodo_dias === 30 ? "el mes" : hogar.periodo_dias === 15 ? "la quincena" : `${hogar.periodo_dias} días`;
  const quitados = plan?.excluidos.filter((e) => e.motivo === MOTIVO_QUITADO) ?? [];
  const porRestriccion = plan?.excluidos.filter((e) => e.motivo !== MOTIVO_QUITADO) ?? [];

  const restaurar = (id: string) =>
    aplicarAjustes({ ...ajustes, excluir_productos: ajustes.excluir_productos.filter((x) => x !== id) });

  return (
    <div className="pb-44">
      <Encabezado titulo="Tu despensa" subtitulo={`${hogar.nombre || "Mi hogar"} · para ${periodo}`} />
      {cargando && <Cargando texto="Calculando tu lista…" />}

      <main className="mx-auto flex max-w-lg flex-col gap-4 px-4 pt-4">
        {error && (
          <Aviso tono="error">
            <p>{error}</p>
            <div className="mt-2 flex gap-2">
              <button type="button" className="font-semibold underline" onClick={() => regenerar()}>
                Reintentar
              </button>
              <button type="button" className="underline" onClick={limpiarError}>
                Cerrar
              </button>
            </div>
          </Aviso>
        )}

        {!plan ? (
          <Tarjeta className="flex flex-col items-center gap-3 text-center">
            <p>Aún no hay lista para este hogar.</p>
            <Boton onClick={() => regenerar()}>Generar mi lista</Boton>
          </Tarjeta>
        ) : (
          <>
            <Resumen plan={plan} />
            {plan.notas.map((n) => (
              <Aviso key={n} tono="alerta">
                {n}
              </Aviso>
            ))}

            {agruparPorDepartamento(plan.lineas).map(([departamento, lineas]) => (
              <section key={departamento} aria-labelledby={`dep-${departamento}`}>
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <h2 id={`dep-${departamento}`} className="text-sm font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                    {departamento}
                  </h2>
                  <span className="tabular text-sm text-stone-500 dark:text-stone-400">
                    {dinero(lineas.reduce((s, l) => s + l.subtotal, 0))}
                  </span>
                </div>
                <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200 dark:divide-stone-800 dark:bg-stone-900 dark:ring-stone-800">
                  {lineas.map((l) => (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => setSeleccionada(l)}
                        className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left active:bg-stone-50 dark:active:bg-stone-800"
                      >
                        <span className="tabular flex h-9 min-w-9 items-center justify-center rounded-lg bg-marca-50 px-1.5 text-sm font-bold text-marca-800 dark:bg-marca-900/40 dark:text-marca-200">
                          {l.paquetes}×
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block leading-snug">{l.nombre}</span>
                          <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-stone-500 dark:text-stone-400">
                            <span className="tabular">{dinero(l.precio_unitario)} c/u</span>
                            {l.fijado && <span className="font-medium text-marca-700 dark:text-marca-500">Cantidad fijada</span>}
                            {l.visitas > 1 && <span>Compra en {l.visitas} visitas</span>}
                            {l.fuente_precio === "estimado" && <span className="text-amber-700 dark:text-amber-400">Precio estimado</span>}
                          </span>
                        </span>
                        <span className="tabular shrink-0 font-semibold">{dinero(l.subtotal)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            {quitados.length > 0 && (
              <Tarjeta>
                <h2 className="mb-2 font-semibold">Quitados por ti</h2>
                <ul className="flex flex-col gap-1">
                  {quitados.map((q) => (
                    <li key={q.id} className="flex min-h-11 items-center justify-between gap-3">
                      <span className="text-stone-600 dark:text-stone-300">{q.nombre}</span>
                      <Boton variante="texto" className="min-h-10 px-2 text-sm" onClick={() => restaurar(q.id)}>
                        Restaurar
                      </Boton>
                    </li>
                  ))}
                </ul>
              </Tarjeta>
            )}

            {porRestriccion.length > 0 && (
              <details className="rounded-2xl bg-white p-4 ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
                <summary className="min-h-8 cursor-pointer font-semibold">
                  {porRestriccion.length} productos excluidos por tus restricciones
                </summary>
                <ul className="mt-2 flex flex-col gap-1 text-sm text-stone-600 dark:text-stone-300">
                  {porRestriccion.map((e) => (
                    <li key={e.id}>
                      {e.nombre} <span className="text-stone-400">· {e.motivo}</span>
                    </li>
                  ))}
                </ul>
                {hogar.alergias.length > 0 && (
                  <p className="mt-3 text-xs text-amber-800 dark:text-amber-300">
                    ⚠ Revisa siempre la etiqueta: nuestra información de alérgenos puede no estar completa.
                  </p>
                )}
              </details>
            )}

            <p className="px-1 text-xs text-stone-500 dark:text-stone-400">
              {plan.catalogo.tienda}. Precios de referencia de Profeco
              {plan.catalogo.fecha_precio_mas_reciente && ` al ${fechaCorta(plan.catalogo.fecha_precio_mas_reciente)}`}; los
              marcados como estimados aún no están verificados. Pueden variar por sucursal.
            </p>
          </>
        )}
      </main>

      {plan && plan.lineas.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-10 px-4">
          <Link
            to="/compra"
            className="mx-auto flex min-h-12 max-w-lg items-center justify-center rounded-xl bg-marca-700 text-base font-semibold text-white shadow-lg active:bg-marca-800"
          >
            Ir de compras 🛒
          </Link>
        </div>
      )}

      <HojaLinea linea={seleccionada} ajustes={ajustes} onCerrar={() => setSeleccionada(null)} onAplicar={aplicarAjustes} />
    </div>
  );
}

function Resumen({ plan }: { plan: Plan }) {
  const [verCobertura, setVerCobertura] = useState(false);
  const uso = Math.min(100, (plan.total / plan.presupuesto) * 100);
  const esenciales = plan.cobertura.filter((c) => c.prioridad === 1);
  const minimoEsencial = esenciales.length ? Math.min(...esenciales.map((c) => c.porcentaje)) : 100;
  const completa = plan.cobertura.every((c) => c.porcentaje >= 95);

  return (
    <Tarjeta>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-stone-500 dark:text-stone-400">Total estimado</p>
          <p className="tabular text-3xl font-bold tracking-tight">{dinero(plan.total)}</p>
        </div>
        <p className="tabular pb-1 text-right text-sm text-stone-500 dark:text-stone-400">
          de {dineroEntero(plan.presupuesto)}
          <br />
          <span className="font-semibold text-marca-700 dark:text-marca-500">te sobran {dinero(plan.sobrante)}</span>
        </p>
      </div>
      <div
        className="mt-3 h-2.5 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800"
        role="progressbar"
        aria-label="Uso del presupuesto"
        aria-valuenow={Math.round(uso)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-marca-600" style={{ width: `${uso}%` }} />
      </div>
      <button
        type="button"
        onClick={() => setVerCobertura(!verCobertura)}
        aria-expanded={verCobertura}
        className="mt-3 flex min-h-11 w-full items-center justify-between rounded-xl bg-stone-50 px-3 text-left text-sm dark:bg-stone-800"
      >
        <span>
          {completa ? "✅ Cubre todo lo que tu hogar necesita" : `⚠️ Lo esencial cubierto al ${Math.round(minimoEsencial)}% o más`}
        </span>
        <span className="text-stone-400">{verCobertura ? "Ocultar" : "Detalle"}</span>
      </button>
      {verCobertura && <TablaCobertura cobertura={plan.cobertura} />}
    </Tarjeta>
  );
}

function TablaCobertura({ cobertura }: { cobertura: Cobertura[] }) {
  const etiquetas = { 1: "Esencial", 2: "Importante", 3: "Opcional" } as const;
  return (
    <ul className="mt-3 flex flex-col gap-2.5">
      {cobertura.map((c) => (
        <li key={c.clave}>
          <div className="flex justify-between gap-2 text-sm">
            <span>
              {c.nombre} <span className="text-xs text-stone-400">· {etiquetas[c.prioridad]}</span>
            </span>
            <span className="tabular shrink-0 text-stone-500 dark:text-stone-400">
              {formatoCantidad(c.cubierto)} / {formatoCantidad(c.requerido)} {c.unidad}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800" aria-hidden="true">
            <div
              className={`h-full rounded-full ${c.porcentaje >= 95 ? "bg-marca-500" : c.porcentaje >= 60 ? "bg-amber-500" : "bg-red-500"}`}
              style={{ width: `${Math.min(100, c.porcentaje)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

const formatoCantidad = (n: number) => (n >= 10 ? Math.round(n).toString() : n.toFixed(1).replace(/\.0$/, ""));

function HojaLinea({
  linea,
  ajustes,
  onCerrar,
  onAplicar,
}: {
  linea: Linea | null;
  ajustes: Ajustes;
  onCerrar: () => void;
  onAplicar: (a: Ajustes) => Promise<boolean>;
}) {
  return (
    <Hoja abierta={linea !== null} onCerrar={onCerrar} titulo={linea?.nombre ?? ""}>
      {/* La key reinicia el estado interno cada vez que se abre otro producto. */}
      {linea && <ContenidoHoja key={linea.id} linea={linea} ajustes={ajustes} onCerrar={onCerrar} onAplicar={onAplicar} />}
    </Hoja>
  );
}

function ContenidoHoja({
  linea,
  ajustes,
  onCerrar,
  onAplicar,
}: {
  linea: Linea;
  ajustes: Ajustes;
  onCerrar: () => void;
  onAplicar: (a: Ajustes) => Promise<boolean>;
}) {
  const [cantidad, setCantidad] = useState(linea.paquetes);
  const [reportando, setReportando] = useState(false);

  const sinFijar = useMemo(() => {
    const { [linea.id]: _omitido, ...resto } = ajustes.fijar;
    return resto;
  }, [ajustes.fijar, linea.id]);

  const aplicar = async (nuevos: Ajustes) => {
    onCerrar();
    await onAplicar(nuevos);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-stone-500 dark:text-stone-400">
        {dinero(linea.precio_unitario)} c/u ·{" "}
        {linea.fuente_precio === "estimado"
          ? "precio estimado"
          : `precio Profeco${linea.fecha_precio ? ` al ${fechaCorta(linea.fecha_precio)}` : ""}`}
      </p>

      {!reportando ? (
        <>
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-stone-50 p-3 dark:bg-stone-800">
            <span className="font-medium">Cantidad</span>
            <Stepper etiqueta="Cantidad de paquetes" valor={cantidad} onCambio={setCantidad} />
          </div>
          <p className="tabular text-sm text-stone-500 dark:text-stone-400">
            Subtotal: {dinero(cantidad * linea.precio_unitario)}. Al cambiar la cantidad, ajustamos el resto de la lista para
            respetar tu presupuesto.
          </p>
          <Boton
            ancho
            disabled={cantidad === linea.paquetes && linea.fijado}
            onClick={() =>
              aplicar(
                cantidad === 0
                  ? { excluir_productos: [...ajustes.excluir_productos, linea.id], fijar: sinFijar }
                  : { ...ajustes, fijar: { ...ajustes.fijar, [linea.id]: cantidad } },
              )
            }
          >
            {cantidad === 0 ? "Quitar de la lista" : `Fijar ${cantidad} y recalcular`}
          </Boton>
          {linea.fijado && (
            <Boton variante="secundario" ancho onClick={() => aplicar({ ...ajustes, fijar: sinFijar })}>
              Que la app decida la cantidad
            </Boton>
          )}
          {cantidad !== 0 && (
            <Boton
              variante="peligro"
              ancho
              onClick={() => aplicar({ excluir_productos: [...ajustes.excluir_productos, linea.id], fijar: sinFijar })}
            >
              No me gusta, quitarlo
            </Boton>
          )}
          <Boton variante="texto" ancho onClick={() => setReportando(true)}>
            ¿El precio está mal? Repórtalo
          </Boton>
        </>
      ) : (
        <ReportePrecio linea={linea} onListo={onCerrar} onCancelar={() => setReportando(false)} />
      )}
    </div>
  );
}

function ReportePrecio({ linea, onListo, onCancelar }: { linea: Linea; onListo: () => void; onCancelar: () => void }) {
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
      <Campo etiqueta="¿Qué precio viste en la tienda?">
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
            placeholder="Ej. Walmart Universidad, CDMX"
            value={sucursal}
            onChange={(e) => setSucursal(e.target.value)}
          />
        )}
      </Campo>
      {error && <Aviso tono="error">{error}</Aviso>}
      <Boton type="submit" ancho disabled={!(valor > 0) || estado === "enviando"}>
        {estado === "enviando" ? "Enviando…" : "Enviar reporte"}
      </Boton>
      <Boton variante="texto" ancho onClick={onCancelar}>
        Volver
      </Boton>
    </form>
  );
}
