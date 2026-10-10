import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { compartirLista } from "../compartir";
import { HojaBuscar, HojaComparar, HojaEnCasa, HojaMenu, HojaPedir, HojaProducto } from "../componentes/hojas";
import { Aviso, Boton, Burbuja, Cargando, Encabezado, Tarjeta } from "../componentes/ui";
import { useApp } from "../estado";
import { cantidad, dinero, dineroEntero, fechaCorta, nombrePeriodo, partirNombre } from "../formato";
import { agruparPorDepartamento, iconoProducto } from "../iconos";
import type { Cobertura, Linea, Plan } from "../tipos";

const MOTIVO_QUITADO = "quitado por ti";
type HojaAbierta = "buscar" | "en_casa" | "comparar" | "pedir" | "menu" | null;

export default function Lista() {
  const { datos, opciones, cargando, error, limpiarError, restaurarProducto, regenerar } = useApp();
  const [seleccionada, setSeleccionada] = useState<Linea | null>(null);
  const [hoja, setHoja] = useState<HojaAbierta>(null);
  const [filtro, setFiltro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const { hogar, plan } = datos;

  if (!hogar) return <Navigate to="/" replace />;

  const quitados = plan?.excluidos.filter((e) => e.motivo === MOTIVO_QUITADO) ?? [];
  const porRestriccion = plan?.excluidos.filter((e) => e.motivo !== MOTIVO_QUITADO) ?? [];
  const grupos = plan ? agruparPorDepartamento(plan.lineas) : [];
  const visibles = filtro ? grupos.filter(([d]) => d.clave === filtro) : grupos;
  const enCasa = Object.keys(datos.ajustes.en_casa).length;

  async function compartir() {
    if (!plan) return;
    const resultado = await compartirLista(plan, hogar!);
    if (resultado === "copiado") setAviso("Lista copiada. Pégala en WhatsApp o donde quieras.");
  }

  return (
    <div className="pb-44">
      <Encabezado
        titulo="Tu despensa"
        subtitulo={plan ? `${plan.catalogo.tienda}${plan.catalogo.estado ? ` · ${plan.catalogo.estado}` : ""} · para ${nombrePeriodo(hogar.periodo_dias)}` : undefined}
        accion={
          plan && (
            <button
              type="button"
              onClick={() => setHoja("buscar")}
              className="mb-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-nopal text-2xl font-bold text-sobre shadow-boton active:translate-y-1 active:shadow-none"
              aria-label="Agregar un producto"
            >
              +
            </button>
          )
        }
      />
      {cargando && <Cargando texto="Armando tu lista…" />}

      <main className="mx-auto flex max-w-lg flex-col gap-4 px-4 pt-2">
        {error && (
          <Aviso tono="error">
            <p>{error}</p>
            <div className="mt-2 flex gap-4">
              <button type="button" className="font-semibold underline" onClick={() => regenerar()}>
                Reintentar
              </button>
              <button type="button" className="underline" onClick={limpiarError}>
                Cerrar
              </button>
            </div>
          </Aviso>
        )}
        {aviso && <Aviso>{aviso}</Aviso>}

        {!plan ? (
          <Tarjeta className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="text-5xl" aria-hidden="true">
              🧺
            </span>
            <p>Aún no hay lista para este hogar.</p>
            <Boton onClick={() => regenerar()}>Armar mi despensa</Boton>
          </Tarjeta>
        ) : (
          <>
            <Resumen plan={plan} />

            <div className="sin-barra -mx-4 flex gap-2 overflow-x-auto px-4">
              {opciones.ia && <Accion emoji="✨" texto="Pedir un cambio" onClick={() => setHoja("pedir")} />}
              {opciones.ia && <Accion emoji="🍳" texto="Menú de la semana" onClick={() => setHoja("menu")} />}
              <Accion emoji="🏠" texto={enCasa ? `En casa (${enCasa})` : "Ya tengo en casa"} onClick={() => setHoja("en_casa")} />
              <Accion emoji="🏪" texto="Comparar tiendas" onClick={() => setHoja("comparar")} />
              <Accion emoji="📤" texto="Compartir" onClick={compartir} />
            </div>

            {plan.consejos.map((c) => (
              <Aviso key={c} tono="consejo">
                {c}
              </Aviso>
            ))}
            {plan.notas.map((n) => (
              <Aviso key={n} tono="alerta">
                {n}
              </Aviso>
            ))}

            {grupos.length > 1 && (
              <div className="sin-barra -mx-4 flex gap-2 overflow-x-auto px-4" role="tablist" aria-label="Filtrar por departamento">
                <FiltroDepto activo={filtro === null} onClick={() => setFiltro(null)} texto={`Todo · ${plan.lineas.length}`} />
                {grupos.map(([d, lineas]) => (
                  <FiltroDepto
                    key={d.clave}
                    activo={filtro === d.clave}
                    onClick={() => setFiltro(filtro === d.clave ? null : d.clave)}
                    texto={`${d.emoji} ${d.nombre.split(" ")[0]} · ${lineas.length}`}
                  />
                ))}
              </div>
            )}

            {visibles.map(([d, lineas]) => (
              <section key={d.clave} aria-labelledby={`dep-${d.clave}`} className="animate-aparecer">
                <div className="mb-2 flex items-center gap-2 px-1">
                  <Burbuja emoji={d.emoji} fondo={d.fondo} tam="sm" />
                  <h2 id={`dep-${d.clave}`} className="flex-1 text-xl font-semibold">
                    {d.nombre}
                  </h2>
                  <span className="tabular text-sm font-semibold text-suave">{dinero(lineas.reduce((s, l) => s + l.subtotal, 0))}</span>
                </div>
                <ul className="overflow-hidden rounded-3xl bg-tarjeta shadow-suave">
                  {lineas.map((l, i) => (
                    <li key={l.id} className={i > 0 ? "border-t border-linea/60" : ""}>
                      <Fila linea={l} fondo={d.fondo} onClick={() => setSeleccionada(l)} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            {quitados.length > 0 && (
              <Tarjeta>
                <h2 className="mb-1 text-lg font-semibold">👎 Quitados por ti</h2>
                <ul className="flex flex-col">
                  {quitados.map((q) => (
                    <li key={q.id} className="flex min-h-11 items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-sm text-suave">{partirNombre(q.nombre).titulo}</span>
                      <button type="button" className="min-h-10 shrink-0 px-2 text-sm font-semibold text-nopal" onClick={() => restaurarProducto(q.id)}>
                        Restaurar
                      </button>
                    </li>
                  ))}
                </ul>
              </Tarjeta>
            )}

            {porRestriccion.length > 0 && (
              <details className="rounded-3xl bg-tarjeta p-4 shadow-suave">
                <summary className="min-h-8 cursor-pointer font-semibold">
                  🛡️ {porRestriccion.length} productos descartados por tus restricciones
                </summary>
                <ul className="mt-2 flex flex-col gap-1 text-sm text-suave">
                  {porRestriccion.slice(0, 60).map((e) => (
                    <li key={e.id}>
                      {partirNombre(e.nombre).titulo} <span className="opacity-70">· {e.motivo}</span>
                    </li>
                  ))}
                  {porRestriccion.length > 60 && <li>…y {porRestriccion.length - 60} más.</li>}
                </ul>
                {hogar.alergias.length > 0 && (
                  <p className="mt-3 text-xs">⚠️ Revisa siempre la etiqueta: nuestra información de alérgenos puede no estar completa.</p>
                )}
              </details>
            )}

            <p className="px-1 text-center text-xs text-suave">
              Precios de referencia de Profeco
              {plan.catalogo.fecha_precio_mas_reciente && ` al ${fechaCorta(plan.catalogo.fecha_precio_mas_reciente)}`}. Pueden variar por
              sucursal; los marcados como estimados no están verificados.
            </p>
          </>
        )}
      </main>

      {plan && plan.lineas.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 px-4">
          <Link
            to="/compra"
            className="mx-auto flex min-h-14 max-w-lg items-center justify-center gap-2 rounded-2xl bg-nopal font-titulo text-xl font-semibold text-sobre shadow-boton active:translate-y-1 active:shadow-none"
          >
            Ir de compras 🛒
          </Link>
        </div>
      )}

      <HojaProducto linea={seleccionada} onCerrar={() => setSeleccionada(null)} />
      <HojaBuscar abierta={hoja === "buscar"} onCerrar={() => setHoja(null)} />
      <HojaEnCasa abierta={hoja === "en_casa"} onCerrar={() => setHoja(null)} />
      <HojaComparar abierta={hoja === "comparar"} onCerrar={() => setHoja(null)} />
      <HojaPedir abierta={hoja === "pedir"} onCerrar={() => setHoja(null)} />
      <HojaMenu abierta={hoja === "menu"} onCerrar={() => setHoja(null)} />
    </div>
  );
}

function Accion({ emoji, texto, onClick }: { emoji: string; texto: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-tarjeta px-4 text-sm font-semibold shadow-suave active:scale-95"
    >
      <span aria-hidden="true">{emoji}</span>
      {texto}
    </button>
  );
}

function FiltroDepto({ activo, texto, onClick }: { activo: boolean; texto: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={activo}
      onClick={onClick}
      className={`min-h-10 shrink-0 rounded-full px-3.5 text-sm font-semibold transition-colors ${
        activo ? "bg-tinta text-fondo" : "bg-hundido text-suave"
      }`}
    >
      {texto}
    </button>
  );
}

function Fila({ linea: l, fondo, onClick }: { linea: Linea; fondo: string; onClick: () => void }) {
  const { titulo, detalle } = partirNombre(l.nombre);
  return (
    <button type="button" onClick={onClick} className="flex min-h-16 w-full items-center gap-3 px-3 py-2.5 text-left active:bg-hundido">
      <span className="relative">
        <Burbuja emoji={iconoProducto(l)} fondo={fondo} />
        <span className="tabular absolute -bottom-1 -right-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-tinta px-1 text-xs font-bold text-fondo">
          {l.paquetes}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-snug">{titulo}</span>
        <span className="block truncate text-xs text-suave">{detalle}</span>
        {(l.fijado || l.visitas > 1 || l.fuente_precio === "estimado") && (
          <span className="mt-0.5 flex flex-wrap gap-1">
            {l.fijado && <Etiqueta clase="bg-nopal-tenue text-nopal-fuerte">📌 fijado</Etiqueta>}
            {l.visitas > 1 && <Etiqueta clase="bg-cielo-tenue text-cielo">🗓️ en {l.visitas} visitas</Etiqueta>}
            {l.fuente_precio === "estimado" && <Etiqueta clase="bg-maiz-tenue text-tinta">precio estimado</Etiqueta>}
          </span>
        )}
      </span>
      <span className="tabular shrink-0 text-right font-titulo text-lg font-semibold">{dinero(l.subtotal)}</span>
    </button>
  );
}

function Etiqueta({ clase, children }: { clase: string; children: React.ReactNode }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${clase}`}>{children}</span>;
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
          <p className="text-sm font-semibold text-suave">Total estimado</p>
          <p className="tabular font-titulo text-4xl font-bold leading-none">{dinero(plan.total)}</p>
        </div>
        <p className="tabular text-right text-sm text-suave">
          de {dineroEntero(plan.presupuesto)}
          <br />
          <span className="font-bold text-nopal">te sobran {dineroEntero(plan.sobrante)}</span>
        </p>
      </div>
      <div
        className="mt-3 h-3 overflow-hidden rounded-full bg-hundido"
        role="progressbar"
        aria-label="Uso del presupuesto"
        aria-valuenow={Math.round(uso)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-nopal" style={{ width: `${uso}%`, transition: "width 500ms cubic-bezier(0.22, 1, 0.36, 1)" }} />
      </div>
      <button
        type="button"
        onClick={() => setVerCobertura(!verCobertura)}
        aria-expanded={verCobertura}
        className={`mt-3 flex min-h-11 w-full items-center justify-between gap-2 rounded-2xl px-3 text-left text-sm font-semibold ${
          completa ? "bg-nopal-tenue" : "bg-maiz-tenue"
        }`}
      >
        <span>{completa ? "✅ Cubre todo lo que tu hogar necesita" : `⚠️ Lo esencial queda cubierto al ${Math.round(minimoEsencial)}% o más`}</span>
        <span className="shrink-0 text-suave">{verCobertura ? "Ocultar" : "¿Por qué?"}</span>
      </button>
      {verCobertura && <TablaCobertura cobertura={plan.cobertura} />}
    </Tarjeta>
  );
}

function TablaCobertura({ cobertura }: { cobertura: Cobertura[] }) {
  return (
    <ul className="mt-3 flex animate-aparecer flex-col gap-3">
      {cobertura.map((c) => (
        <li key={c.clave}>
          <div className="flex justify-between gap-2 text-sm">
            <span className="font-semibold">{c.nombre}</span>
            <span className="tabular shrink-0 text-suave">
              {cantidad(c.cubierto)} / {cantidad(c.requerido)} {c.unidad}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-hundido" aria-hidden="true">
            <div
              className={`h-full rounded-full ${c.porcentaje >= 95 ? "bg-nopal" : c.porcentaje >= 60 ? "bg-maiz" : "bg-rosa"}`}
              style={{ width: `${Math.min(100, c.porcentaje)}%` }}
            />
          </div>
          {(c.explicacion || c.en_casa > 0) && (
            <p className="mt-0.5 text-xs text-suave">
              {c.explicacion}
              {c.en_casa > 0 && ` · ya tienes ${Math.round(c.en_casa * 100)}% en casa`}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
