import { Link, Navigate } from "react-router-dom";
import { Boton, Encabezado, Tarjeta } from "../componentes/ui";
import { useApp } from "../estado";
import { agruparPorDepartamento, dinero } from "../formato";

export default function Compra() {
  const { datos, alternarComprado, reiniciarCompra } = useApp();
  const { hogar, plan, comprados } = datos;
  if (!hogar) return <Navigate to="/" replace />;

  if (!plan || plan.lineas.length === 0) {
    return (
      <div className="pb-28">
        <Encabezado titulo="De compras" />
        <main className="mx-auto max-w-lg px-4 pt-4">
          <Tarjeta className="text-center">
            <p className="mb-3">Primero genera tu lista.</p>
            <Link to="/lista" className="font-semibold text-marca-700 underline">
              Ir a mi lista
            </Link>
          </Tarjeta>
        </main>
      </div>
    );
  }

  const marcados = new Set(comprados);
  const hechos = plan.lineas.filter((l) => marcados.has(l.id));
  const gastado = hechos.reduce((s, l) => s + l.subtotal, 0);
  const avance = (hechos.length / plan.lineas.length) * 100;

  return (
    <div className="pb-28">
      <Encabezado
        titulo="De compras"
        subtitulo={`${hechos.length} de ${plan.lineas.length} productos`}
        accion={
          hechos.length > 0 && (
            <Boton
              variante="texto"
              className="min-h-10 px-2 text-sm"
              onClick={() => window.confirm("¿Desmarcar todos los productos?") && reiniciarCompra()}
            >
              Reiniciar
            </Boton>
          )
        }
      />
      <main className="mx-auto flex max-w-lg flex-col gap-4 px-4 pt-4">
        <Tarjeta>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-stone-500 dark:text-stone-400">En el carrito</span>
            <span className="tabular text-sm text-stone-500 dark:text-stone-400">de {dinero(plan.total)}</span>
          </div>
          <p className="tabular text-2xl font-bold">{dinero(gastado)}</p>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800" aria-hidden="true">
            <div className="h-full rounded-full bg-marca-600 transition-all" style={{ width: `${avance}%` }} />
          </div>
          {hechos.length === plan.lineas.length && <p className="mt-3 font-semibold text-marca-700 dark:text-marca-500">🎉 ¡Listo! Tienes todo.</p>}
        </Tarjeta>

        {agruparPorDepartamento(plan.lineas).map(([departamento, lineas]) => (
          <section key={departamento}>
            <h2 className="mb-2 px-1 text-sm font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
              {departamento}
            </h2>
            <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200 dark:divide-stone-800 dark:bg-stone-900 dark:ring-stone-800">
              {lineas.map((l) => {
                const hecho = marcados.has(l.id);
                return (
                  <li key={l.id}>
                    <label className="flex min-h-16 cursor-pointer items-center gap-3 px-4 py-3 active:bg-stone-50 dark:active:bg-stone-800">
                      <input
                        type="checkbox"
                        className="h-7 w-7 shrink-0 accent-marca-700"
                        checked={hecho}
                        onChange={() => alternarComprado(l.id)}
                      />
                      <span className={`min-w-0 flex-1 ${hecho ? "text-stone-400 line-through dark:text-stone-500" : ""}`}>
                        <span className="font-semibold">{l.paquetes} ×</span> {l.nombre}
                      </span>
                      <span className={`tabular shrink-0 text-sm ${hecho ? "text-stone-400" : "text-stone-600 dark:text-stone-300"}`}>
                        {dinero(l.subtotal)}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
}
