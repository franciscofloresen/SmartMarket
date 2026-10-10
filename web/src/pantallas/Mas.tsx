import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ErrorApi } from "../api";
import { normalizar } from "../almacen";
import { Aviso, Boton, Burbuja, claseEntrada, Encabezado, Tarjeta } from "../componentes/ui";
import { useApp } from "../estado";
import { dinero, dineroEntero, fechaCorta, nombrePeriodo } from "../formato";

export default function Mas() {
  const { datos, opciones, restaurar, borrarTodo, olvidarGustos, regenerar } = useApp();
  const navegar = useNavigate();
  const archivo = useRef<HTMLInputElement>(null);
  const [mensaje, setMensaje] = useState<{ tono: "info" | "error"; texto: string } | null>(null);
  const { hogar, historial, noMeGusta } = datos;

  function descargarRespaldo() {
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smartmarket-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function cargarRespaldo(f: File) {
    try {
      restaurar(normalizar(JSON.parse(await f.text())));
      setMensaje({ tono: "info", texto: "Respaldo restaurado." });
    } catch {
      setMensaje({ tono: "error", texto: "Ese archivo no es un respaldo válido de SmartMarket." });
    }
  }

  return (
    <div className="pb-28">
      <Encabezado titulo="Más" />
      <main className="mx-auto flex max-w-lg flex-col gap-4 px-4 pt-2">
        {mensaje && <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>}

        {hogar && (
          <Tarjeta>
            <div className="flex items-center gap-3">
              <Burbuja emoji="🏡" fondo="bg-nopal-tenue" tam="lg" />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-xl font-semibold">{hogar.nombre || "Mi hogar"}</h2>
                <p className="text-sm text-suave">
                  {hogar.miembros.length} {hogar.miembros.length === 1 ? "persona" : "personas"}
                  {hogar.mascotas.length > 0 && ` · ${hogar.mascotas.length} ${hogar.mascotas.length === 1 ? "mascota" : "mascotas"}`} ·{" "}
                  {dineroEntero(hogar.presupuesto)} para {nombrePeriodo(hogar.periodo_dias)}
                </p>
                <p className="text-sm text-suave">
                  {opciones.tiendas.find((t) => t.clave === hogar.tienda)?.nombre ?? hogar.tienda}
                  {hogar.estado && ` · ${hogar.estado}`} · {opciones.niveles.find((n) => n.clave === hogar.nivel)?.nombre.toLowerCase() ?? hogar.nivel}
                </p>
              </div>
            </div>
            {(hogar.alergias.length > 0 || hogar.excluir.length > 0 || hogar.dieta) && (
              <p className="mt-3 text-sm text-suave">
                {[
                  hogar.alergias.length > 0 &&
                    `Alergias: ${hogar.alergias.map((a) => opciones.alergias.find((o) => o.clave === a)?.nombre ?? a).join(", ")}`,
                  hogar.dieta && `Dieta ${opciones.dietas.find((d) => d.clave === hogar.dieta)?.nombre.toLowerCase() ?? hogar.dieta}`,
                  hogar.excluir.length > 0 && `Sin ${hogar.excluir.join(", ")}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            <Link
              to="/hogar"
              className="mt-3 flex min-h-12 items-center justify-center rounded-2xl font-titulo text-lg font-semibold ring-2 ring-linea active:bg-hundido"
            >
              ✏️ Editar hogar
            </Link>
          </Tarjeta>
        )}

        {noMeGusta.length > 0 && (
          <Tarjeta>
            <h2 className="text-lg font-semibold">👎 Tus gustos</h2>
            <p className="mt-1 text-sm text-suave">
              Recordamos {noMeGusta.length} {noMeGusta.length === 1 ? "producto que quitaste" : "productos que quitaste"} para no volver a
              sugerirlos.
            </p>
            <Boton
              variante="secundario"
              className="mt-3"
              onClick={() => {
                if (window.confirm("¿Olvidar los productos que quitaste? Podrán volver a aparecer en tus listas.")) {
                  olvidarGustos();
                  setMensaje({ tono: "info", texto: "Listo. En tu próxima lista podrán aparecer de nuevo." });
                }
              }}
            >
              Olvidar mis gustos
            </Boton>
          </Tarjeta>
        )}

        <Tarjeta>
          <h2 className="text-lg font-semibold">🧾 Historial de compras</h2>
          {historial.length === 0 ? (
            <p className="mt-1 text-sm text-suave">Cuando termines una compra aparecerá aquí, con lo que estimamos y lo que pagaste.</p>
          ) : (
            <ul className="mt-2 flex flex-col divide-y divide-linea/60">
              {historial.map((c) => {
                const diferencia = c.total_real !== null ? c.total_real - c.total_estimado : null;
                return (
                  <li key={c.fecha} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {fechaCorta(c.fecha)} · {c.tienda}
                      </p>
                      <p className="text-xs text-suave">
                        {c.productos} productos · estimado {dinero(c.total_estimado)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="tabular font-titulo text-lg font-semibold">{dinero(c.total_real ?? c.total_estimado)}</p>
                      {diferencia !== null && (
                        <p className={`tabular text-xs font-semibold ${Math.abs(diferencia) <= c.total_estimado * 0.05 ? "text-nopal" : "text-papaya"}`}>
                          {diferencia >= 0 ? "+" : "−"}
                          {dinero(Math.abs(diferencia))} vs. estimado
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Tarjeta>

        <Comentario />

        <Tarjeta>
          <h2 className="text-lg font-semibold">📲 Instálala en tu iPhone</h2>
          <ol className="mt-2 list-decimal pl-5 text-sm leading-relaxed text-suave">
            <li>Abre esta página en Safari.</li>
            <li>
              Toca el botón Compartir <span aria-hidden="true">(□↑)</span>.
            </li>
            <li>Elige “Agregar a pantalla de inicio”.</li>
          </ol>
          <p className="mt-2 text-xs text-suave">Así se abre como app, funciona sin conexión en la tienda y Safari no borra tus datos.</p>
        </Tarjeta>

        <Tarjeta>
          <h2 className="text-lg font-semibold">💾 Respaldo</h2>
          <p className="mt-1 text-sm text-suave">Guarda tu hogar, lista e historial en un archivo, por si cambias de teléfono.</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Boton variante="secundario" onClick={descargarRespaldo} disabled={!hogar}>
              Descargar
            </Boton>
            <Boton variante="secundario" onClick={() => archivo.current?.click()}>
              Restaurar
            </Boton>
          </div>
          <input
            ref={archivo}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void cargarRespaldo(f);
              e.target.value = "";
            }}
          />
        </Tarjeta>

        {hogar && (
          <Boton variante="secundario" ancho onClick={() => regenerar().then((ok) => ok && navegar("/lista"))}>
            🔄 Recalcular mi lista con precios actuales
          </Boton>
        )}
        <Boton
          variante="peligro"
          ancho
          onClick={() => {
            if (window.confirm("Se borrarán tu hogar, tu lista y tu historial de este teléfono. ¿Continuar?")) {
              borrarTodo();
              navegar("/");
            }
          }}
        >
          Borrar mis datos
        </Boton>

        <p className="px-1 text-center text-xs text-suave">
          SmartMarket beta
          {opciones.catalogo.productos > 0 && ` · ${opciones.tiendas.length} tiendas · precios de Profeco`}
          {opciones.catalogo.fecha_precio_mas_reciente && ` al ${fechaCorta(opciones.catalogo.fecha_precio_mas_reciente)}`}
        </p>
      </main>
    </div>
  );
}

function Comentario() {
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<"editando" | "enviando" | "enviado">("editando");
  const [error, setError] = useState<string | null>(null);

  return (
    <Tarjeta>
      <h2 className="text-lg font-semibold">💬 ¿Qué te pareció?</h2>
      <p className="mt-1 text-sm text-suave">Estamos en beta: cualquier comentario nos ayuda.</p>
      {estado === "enviado" ? (
        <div className="mt-3">
          <Aviso>¡Gracias por tu comentario!</Aviso>
        </div>
      ) : (
        <form
          className="mt-3 flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setEstado("enviando");
            setError(null);
            try {
              await api.comentar(texto.trim());
              setEstado("enviado");
              setTexto("");
            } catch (err) {
              setError(err instanceof ErrorApi ? err.message : "No se pudo enviar.");
              setEstado("editando");
            }
          }}
        >
          <textarea
            className={`${claseEntrada} min-h-24 py-3`}
            maxLength={1000}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Ej. Me faltó tal producto, las cantidades de fruta son muchas…"
            aria-label="Comentario"
          />
          {error && <Aviso tono="error">{error}</Aviso>}
          <Boton type="submit" variante="secundario" disabled={!texto.trim() || estado === "enviando"}>
            {estado === "enviando" ? "Enviando…" : "Enviar comentario"}
          </Boton>
        </form>
      )}
    </Tarjeta>
  );
}
