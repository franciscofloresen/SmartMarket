import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "../api";
import { Anillo, Boton, Burbuja, Campo, claseEntrada, Confeti, Encabezado, Hoja, Tarjeta } from "../componentes/ui";
import { useApp } from "../estado";
import { dinero, partirNombre } from "../formato";
import { agruparPorDepartamento, iconoProducto } from "../iconos";

export default function Compra() {
  const { datos, alternarComprado, reiniciarCompra, terminarCompra } = useApp();
  const navegar = useNavigate();
  const [cerrando, setCerrando] = useState(false);
  const [pagado, setPagado] = useState("");
  const { hogar, plan, comprados } = datos;
  if (!hogar) return <Navigate to="/" replace />;

  if (!plan || plan.lineas.length === 0) {
    return (
      <div className="pb-28">
        <Encabezado titulo="De compras" />
        <main className="mx-auto max-w-lg px-4 pt-4">
          <Tarjeta className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="text-5xl" aria-hidden="true">
              🛒
            </span>
            <p>Primero arma tu lista.</p>
            <Link to="/lista" className="font-semibold text-nopal underline">
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
  const completa = hechos.length === plan.lineas.length;
  const totalReal = Number(pagado.replace(/[^\d.]/g, ""));

  function terminar(real: number | null) {
    if (real !== null) void api.reportarTicket(plan!.catalogo.clave, plan!.total, real).catch(() => undefined);
    terminarCompra(real);
    setCerrando(false);
    navegar("/inicio");
  }

  return (
    <div className="pb-44">
      {completa && <Confeti />}
      <Encabezado
        titulo="De compras"
        subtitulo={plan.catalogo.tienda}
        accion={
          hechos.length > 0 && (
            <button
              type="button"
              className="mb-1 min-h-10 px-2 text-sm font-semibold text-suave"
              onClick={() => window.confirm("¿Desmarcar todos los productos?") && reiniciarCompra()}
            >
              Reiniciar
            </button>
          )
        }
      />
      <main className="mx-auto flex max-w-lg flex-col gap-4 px-4 pt-2">
        <Tarjeta className="flex items-center gap-4">
          <Anillo porcentaje={(hechos.length / plan.lineas.length) * 100} tam={96} grosor={11} etiqueta="Avance de la compra">
            <span className="tabular font-titulo text-2xl font-bold leading-none">{hechos.length}</span>
            <span className="tabular text-xs text-suave">de {plan.lineas.length}</span>
          </Anillo>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-suave">En el carrito</p>
            <p className="tabular font-titulo text-3xl font-bold leading-none">{dinero(gastado)}</p>
            <p className="tabular mt-1 text-sm text-suave">de {dinero(plan.total)} estimados</p>
            {completa && <p className="mt-1 animate-rebote font-semibold text-nopal">🎉 ¡Listo, tienes todo!</p>}
          </div>
        </Tarjeta>

        {agruparPorDepartamento(plan.lineas).map(([d, lineas]) => {
          const pendientes = lineas.filter((l) => !marcados.has(l.id)).length;
          return (
            <section key={d.clave}>
              <div className="mb-2 flex items-center gap-2 px-1">
                <Burbuja emoji={d.emoji} fondo={d.fondo} tam="sm" />
                <h2 className="flex-1 text-xl font-semibold">{d.nombre}</h2>
                <span className={`text-sm font-semibold ${pendientes === 0 ? "text-nopal" : "text-suave"}`}>
                  {pendientes === 0 ? "✓ completo" : `faltan ${pendientes}`}
                </span>
              </div>
              <ul className="overflow-hidden rounded-3xl bg-tarjeta shadow-suave">
                {lineas.map((l, i) => {
                  const hecho = marcados.has(l.id);
                  const { titulo, detalle } = partirNombre(l.nombre);
                  return (
                    <li key={l.id} className={i > 0 ? "border-t border-linea/60" : ""}>
                      <label className="flex min-h-16 cursor-pointer items-center gap-3 px-3 py-2.5 active:bg-hundido">
                        <input type="checkbox" className="peer sr-only" checked={hecho} onChange={() => alternarComprado(l.id)} />
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-lg font-bold transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-nopal ${
                            hecho ? "border-nopal bg-nopal text-sobre" : "border-linea text-transparent"
                          }`}
                          aria-hidden="true"
                        >
                          <span key={String(hecho)} className={hecho ? "animate-rebote" : ""}>
                            ✓
                          </span>
                        </span>
                        <span className={`text-2xl transition-opacity ${hecho ? "opacity-40" : ""}`} aria-hidden="true">
                          {iconoProducto(l)}
                        </span>
                        <span className={`min-w-0 flex-1 transition-opacity ${hecho ? "opacity-40" : ""}`}>
                          <span className={`block font-semibold leading-snug ${hecho ? "line-through" : ""}`}>
                            <span className="tabular">{l.paquetes} ×</span> {titulo}
                          </span>
                          <span className="block truncate text-xs text-suave">{detalle}</span>
                        </span>
                        <span className={`tabular shrink-0 text-sm font-semibold ${hecho ? "opacity-40" : ""}`}>{dinero(l.subtotal)}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </main>

      {hechos.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 px-4">
          <div className="mx-auto max-w-lg">
            <Boton ancho variante={completa ? "primario" : "secundario"} className="min-h-14 shadow-suave" onClick={() => setCerrando(true)}>
              {completa ? "Terminar compra 🎉" : "Terminar compra"}
            </Boton>
          </div>
        </div>
      )}

      <Hoja abierta={cerrando} onCerrar={() => setCerrando(false)} titulo="¿Cuánto pagaste en caja?">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-suave">
            Nosotros estimamos {dinero(plan.total)}. Con tu ticket medimos qué tan precisos somos y guardamos la compra en tu historial.
          </p>
          <Campo etiqueta="Total del ticket (opcional)">
            {(id) => (
              <input
                id={id}
                className={`${claseEntrada} tabular text-xl font-semibold`}
                inputMode="decimal"
                placeholder={plan.total.toFixed(2)}
                value={pagado}
                onChange={(e) => setPagado(e.target.value.replace(/[^\d.,]/g, "").replace(",", "."))}
              />
            )}
          </Campo>
          <Boton ancho disabled={!(totalReal > 0)} onClick={() => terminar(totalReal)}>
            Guardar compra
          </Boton>
          <Boton variante="texto" ancho onClick={() => terminar(null)}>
            Terminar sin anotar el total
          </Boton>
        </div>
      </Hoja>
    </div>
  );
}
