import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ErrorApi } from "../api";
import { normalizar } from "../almacen";
import { Aviso, Boton, claseEntrada, Encabezado, Tarjeta } from "../componentes/ui";
import { useApp } from "../estado";
import { dineroEntero, fechaCorta } from "../formato";

export default function Mas() {
  const { datos, opciones, restaurar, borrarTodo } = useApp();
  const navegar = useNavigate();
  const archivo = useRef<HTMLInputElement>(null);
  const [mensaje, setMensaje] = useState<{ tono: "info" | "error"; texto: string } | null>(null);
  const hogar = datos.hogar;

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
      <main className="mx-auto flex max-w-lg flex-col gap-4 px-4 pt-4">
        {mensaje && <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>}

        {hogar && (
          <Tarjeta>
            <h2 className="font-semibold">{hogar.nombre || "Mi hogar"}</h2>
            <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
              {hogar.miembros.length} {hogar.miembros.length === 1 ? "persona" : "personas"}
              {hogar.mascotas.length > 0 && ` · ${hogar.mascotas.length} ${hogar.mascotas.length === 1 ? "mascota" : "mascotas"}`} ·{" "}
              {dineroEntero(hogar.presupuesto)} para {hogar.periodo_dias} días
            </p>
            {(hogar.alergias.length > 0 || hogar.excluir.length > 0 || hogar.dieta) && (
              <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
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
              className="mt-3 flex min-h-12 items-center justify-center rounded-xl font-semibold text-marca-700 ring-1 ring-stone-300 active:bg-stone-100 dark:text-marca-500 dark:ring-stone-700"
            >
              Editar hogar
            </Link>
          </Tarjeta>
        )}

        <Comentario />

        <Tarjeta>
          <h2 className="font-semibold">Instálala en tu iPhone</h2>
          <ol className="mt-2 list-decimal pl-5 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
            <li>Abre esta página en Safari.</li>
            <li>
              Toca el botón Compartir <span aria-hidden="true">(□↑)</span>.
            </li>
            <li>Elige “Agregar a pantalla de inicio”.</li>
          </ol>
          <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
            Así se abre como app, funciona sin conexión en la tienda y Safari no borra tus datos.
          </p>
        </Tarjeta>

        <Tarjeta>
          <h2 className="font-semibold">Respaldo</h2>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">Guarda tu hogar y tu lista en un archivo, por si cambias de teléfono.</p>
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
              if (f) cargarRespaldo(f);
              e.target.value = "";
            }}
          />
        </Tarjeta>

        <Boton
          variante="peligro"
          ancho
          onClick={() => {
            if (window.confirm("Se borrarán tu hogar y tu lista de este teléfono. ¿Continuar?")) {
              borrarTodo();
              navegar("/");
            }
          }}
        >
          Borrar mis datos
        </Boton>

        <p className="px-1 text-center text-xs text-stone-500 dark:text-stone-400">
          SmartMarket beta · {opciones.catalogo.tienda}
          {opciones.catalogo.productos > 0 &&
            ` · ${opciones.catalogo.productos} productos, ${opciones.catalogo.precios_verificados} con precio de Profeco`}
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
      <h2 className="font-semibold">¿Qué te pareció?</h2>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">Estamos en beta: cualquier comentario nos ayuda.</p>
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
            className={`${claseEntrada} min-h-24 py-2`}
            maxLength={1000}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Ej. Me faltó tal producto, las cantidades de fruta son muchas…"
            aria-label="Comentario"
          />
          {error && <Aviso tono="error">{error}</Aviso>}
          <Boton type="submit" disabled={!texto.trim() || estado === "enviando"}>
            {estado === "enviando" ? "Enviando…" : "Enviar comentario"}
          </Boton>
        </form>
      )}
    </Tarjeta>
  );
}
