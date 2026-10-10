import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { compartirLista } from "../compartir";
import { HojaComparar, HojaEnCasa } from "../componentes/hojas";
import { Anillo, Aviso, Boton, Cargando, Tarjeta } from "../componentes/ui";
import { useApp } from "../estado";
import { dinero, dineroEntero, fechaCorta, nombrePeriodo } from "../formato";
import { agruparPorDepartamento } from "../iconos";

export default function Inicio() {
  const { datos, cargando, error, regenerar } = useApp();
  const navegar = useNavigate();
  const [hoja, setHoja] = useState<"comparar" | "en_casa" | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const { hogar, plan, comprados, historial } = datos;
  if (!hogar) return <Navigate to="/" replace />;

  const personas = hogar.miembros.length;
  const saludo = hogar.nombre ? `¡Hola, ${hogar.nombre}!` : "¡Hola!";

  return (
    <div className="pb-28">
      {cargando && <Cargando texto="Armando tu lista…" />}
      <header className="pt-seguro px-4 pb-2">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-bold leading-tight">{saludo}</h1>
            <p className="truncate text-sm text-suave">
              {personas} {personas === 1 ? "persona" : "personas"}
              {hogar.mascotas.length > 0 && ` · ${hogar.mascotas.length} ${hogar.mascotas.length === 1 ? "mascota" : "mascotas"}`} · para{" "}
              {nombrePeriodo(hogar.periodo_dias)}
            </p>
          </div>
          <Link to="/hogar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tarjeta text-xl shadow-suave active:scale-90" aria-label="Editar hogar">
            ✏️
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-lg flex-col gap-4 px-4 pt-2">
        {error && <Aviso tono="error">{error}</Aviso>}
        {aviso && <Aviso>{aviso}</Aviso>}

        {!plan ? (
          <Tarjeta className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="text-5xl" aria-hidden="true">
              🧺
            </span>
            <p>Tu lista necesita actualizarse.</p>
            <Boton onClick={() => regenerar()}>Armar mi despensa</Boton>
          </Tarjeta>
        ) : (
          <>
            <Tarjeta className="animate-aparecer">
              <div className="flex items-center gap-4">
                <Anillo porcentaje={(plan.total / plan.presupuesto) * 100} etiqueta="Uso del presupuesto">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-suave">Total</span>
                  <span className="tabular font-titulo text-2xl font-bold leading-none">{dineroEntero(plan.total)}</span>
                  <span className="tabular text-[11px] text-suave">de {dineroEntero(plan.presupuesto)}</span>
                </Anillo>
                <div className="min-w-0 flex-1">
                  <p className="font-titulo text-xl font-semibold leading-tight">{plan.catalogo.tienda}</p>
                  <p className="text-sm text-suave">
                    {plan.lineas.length} productos{plan.catalogo.estado ? ` · ${plan.catalogo.estado}` : ""}
                  </p>
                  <p className="mt-2 inline-block rounded-full bg-nopal-tenue px-3 py-1 text-sm font-bold text-nopal-fuerte">
                    Te sobran {dineroEntero(plan.sobrante)}
                  </p>
                  <p className="mt-1 text-sm">
                    {plan.cobertura.every((c) => c.porcentaje >= 95) ? "✅ Cubre todo" : "⚠️ No alcanza para todo"}
                  </p>
                </div>
              </div>
              <GastoPorDepartamento />
            </Tarjeta>

            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/lista"
                className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-tarjeta font-titulo text-lg font-semibold ring-2 ring-linea active:bg-hundido"
              >
                📝 Ver lista
              </Link>
              <Link
                to="/compra"
                className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-nopal font-titulo text-lg font-semibold text-white shadow-boton active:translate-y-1 active:shadow-none"
              >
                🛒 {comprados.length > 0 ? `Seguir (${comprados.length}/${plan.lineas.length})` : "Ir de compras"}
              </Link>
            </div>

            {plan.consejos.map((c) => (
              <Aviso key={c} tono="consejo">
                {c}
              </Aviso>
            ))}

            <div className="grid grid-cols-3 gap-3">
              <Atajo emoji="🏪" fondo="bg-cielo-tenue" texto="Comparar tiendas" onClick={() => setHoja("comparar")} />
              <Atajo emoji="🏠" fondo="bg-maiz-tenue" texto="Ya tengo en casa" onClick={() => setHoja("en_casa")} />
              <Atajo
                emoji="📤"
                fondo="bg-rosa-tenue"
                texto="Compartir lista"
                onClick={async () => {
                  if ((await compartirLista(plan, hogar)) === "copiado") setAviso("Lista copiada. Pégala en WhatsApp o donde quieras.");
                }}
              />
            </div>

            {historial.length > 0 && (
              <Tarjeta>
                <div className="flex items-baseline justify-between">
                  <h2 className="text-lg font-semibold">Última compra</h2>
                  <button type="button" className="min-h-10 text-sm font-semibold text-nopal" onClick={() => navegar("/mas")}>
                    Ver historial
                  </button>
                </div>
                <p className="text-sm text-suave">
                  {fechaCorta(historial[0].fecha)} · {historial[0].tienda} ·{" "}
                  {historial[0].total_real !== null ? `pagaste ${dinero(historial[0].total_real)}` : `estimado ${dinero(historial[0].total_estimado)}`}
                </p>
              </Tarjeta>
            )}
          </>
        )}
      </main>

      <HojaComparar abierta={hoja === "comparar"} onCerrar={() => setHoja(null)} />
      <HojaEnCasa abierta={hoja === "en_casa"} onCerrar={() => setHoja(null)} />
    </div>
  );
}

function Atajo({ emoji, fondo, texto, onClick }: { emoji: string; fondo: string; texto: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex min-h-24 flex-col items-center justify-center gap-1 rounded-3xl p-2 text-center active:scale-95 ${fondo}`}>
      <span className="text-3xl" aria-hidden="true">
        {emoji}
      </span>
      <span className="text-xs font-semibold leading-tight">{texto}</span>
    </button>
  );
}

/** Barra apilada con lo que se gasta en cada departamento. */
function GastoPorDepartamento() {
  const { datos } = useApp();
  const plan = datos.plan!;
  const grupos = agruparPorDepartamento(plan.lineas)
    .map(([d, lineas]) => ({ d, total: lineas.reduce((s, l) => s + l.subtotal, 0) }))
    .sort((a, b) => b.total - a.total);
  const principales = grupos.slice(0, 4);
  const otros = grupos.slice(4).reduce((s, g) => s + g.total, 0);

  return (
    <div className="mt-4">
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Gasto por departamento">
        {grupos.map(({ d, total }) => (
          <div key={d.clave} className={d.barra} style={{ width: `${(total / plan.total) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-suave">
        {principales.map(({ d, total }) => (
          <li key={d.clave} className="flex items-center gap-1">
            <span className={`h-2.5 w-2.5 rounded-full ${d.barra}`} aria-hidden="true" />
            {d.nombre.split(" ")[0]} <span className="tabular font-semibold text-tinta">{dineroEntero(total)}</span>
          </li>
        ))}
        {otros > 0 && (
          <li>
            Otros <span className="tabular font-semibold text-tinta">{dineroEntero(otros)}</span>
          </li>
        )}
      </ul>
    </div>
  );
}
