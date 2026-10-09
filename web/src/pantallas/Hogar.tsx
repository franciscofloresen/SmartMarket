import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Aviso, Boton, Campo, Chip, claseEntrada, Encabezado, Segmentado, Tarjeta } from "../componentes/ui";
import { useApp } from "../estado";
import { dineroEntero } from "../formato";
import type { Mascota, Miembro, Perfil, TamanoPerro } from "../tipos";

const PASOS = ["Personas", "Mascotas", "Alimentación", "Presupuesto"] as const;
const PRESUPUESTOS_RAPIDOS = [3000, 5000, 8000, 10000];
const EXCLUSIONES_SUGERIDAS = ["brócoli", "coliflor", "chile", "cerdo", "champiñones", "aguacate", "refresco"];

const PERFIL_NUEVO: Perfil = {
  nombre: "",
  presupuesto: 5000,
  periodo_dias: 30,
  miembros: [{ edad: 35, sexo: null, nombre: "" }],
  mascotas: [],
  alergias: [],
  excluir: [],
  dieta: null,
  tortillas_caseras: false,
};

export default function Hogar() {
  const { datos, opciones, guardarHogar, cargando, error } = useApp();
  const navegar = useNavigate();
  const editando = datos.hogar !== null;
  const [perfil, setPerfil] = useState<Perfil>(datos.hogar ?? PERFIL_NUEVO);
  const [paso, setPaso] = useState(0);

  const cambiar = (parcial: Partial<Perfil>) => setPerfil((p) => ({ ...p, ...parcial }));
  const edadesValidas = perfil.miembros.every((m) => Number.isInteger(m.edad) && m.edad >= 0 && m.edad <= 120);
  const puedeAvanzar = [
    perfil.miembros.length > 0 && edadesValidas,
    true,
    true,
    perfil.presupuesto > 0 && perfil.presupuesto <= 1_000_000,
  ][paso];

  async function terminar() {
    if (await guardarHogar({ ...perfil, nombre: perfil.nombre.trim() })) navegar("/lista");
  }

  return (
    <div className="min-h-dvh pb-32">
      <Encabezado
        titulo={editando ? "Editar hogar" : "Tu hogar"}
        subtitulo={`Paso ${paso + 1} de ${PASOS.length} · ${PASOS[paso]}`}
        accion={
          editando && (
            <Boton variante="texto" onClick={() => navegar(-1)}>
              Cancelar
            </Boton>
          )
        }
      />
      <div className="mx-auto h-1 max-w-lg bg-stone-200 dark:bg-stone-800" aria-hidden="true">
        <div className="h-1 bg-marca-600 transition-all" style={{ width: `${((paso + 1) / PASOS.length) * 100}%` }} />
      </div>

      <main className="mx-auto flex max-w-lg flex-col gap-4 px-4 pt-4">
        {paso === 0 && <PasoPersonas miembros={perfil.miembros} onCambio={(miembros) => cambiar({ miembros })} />}
        {paso === 1 && (
          <PasoMascotas
            mascotas={perfil.mascotas}
            tamanos={opciones.tamanos_perro}
            onCambio={(mascotas) => cambiar({ mascotas })}
          />
        )}
        {paso === 2 && <PasoAlimentacion perfil={perfil} onCambio={cambiar} />}
        {paso === 3 && <PasoPresupuesto perfil={perfil} onCambio={cambiar} />}
        {error && paso === 3 && <Aviso tono="error">{error}</Aviso>}
      </main>

      <footer className="pb-seguro fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-stone-50/95 px-4 pt-3 backdrop-blur dark:border-stone-800 dark:bg-stone-950/95">
        <div className="mx-auto flex max-w-lg gap-3">
          {paso > 0 && (
            <Boton variante="secundario" onClick={() => setPaso(paso - 1)} className="flex-1">
              Atrás
            </Boton>
          )}
          {paso < PASOS.length - 1 ? (
            <Boton onClick={() => setPaso(paso + 1)} disabled={!puedeAvanzar} className="flex-[2]">
              Siguiente
            </Boton>
          ) : (
            <Boton onClick={terminar} disabled={!puedeAvanzar || cargando} className="flex-[2]">
              {cargando ? "Calculando…" : editando ? "Guardar y recalcular" : "Generar mi lista"}
            </Boton>
          )}
        </div>
      </footer>
    </div>
  );
}

function PasoPersonas({ miembros, onCambio }: { miembros: Miembro[]; onCambio: (m: Miembro[]) => void }) {
  const actualizar = (i: number, parcial: Partial<Miembro>) =>
    onCambio(miembros.map((m, j) => (j === i ? { ...m, ...parcial } : m)));
  return (
    <>
      <p className="text-stone-600 dark:text-stone-300">
        ¿Quiénes viven en casa? Con la edad calculamos cuánto come cada quien.
      </p>
      {miembros.map((m, i) => (
        <Tarjeta key={i}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">{m.nombre.trim() || `Persona ${i + 1}`}</h2>
            {miembros.length > 1 && (
              <button
                type="button"
                className="min-h-10 rounded-lg px-2 text-sm font-medium text-red-700 active:bg-red-50 dark:text-red-400"
                onClick={() => onCambio(miembros.filter((_, j) => j !== i))}
              >
                Quitar
              </button>
            )}
          </div>
          <div className="grid grid-cols-[1fr_6rem] gap-3">
            <Campo etiqueta="Nombre (opcional)">
              {(id) => (
                <input
                  id={id}
                  className={claseEntrada}
                  value={m.nombre}
                  maxLength={40}
                  placeholder={i === 0 ? "Ej. Mamá" : "Opcional"}
                  onChange={(e) => actualizar(i, { nombre: e.target.value })}
                />
              )}
            </Campo>
            <Campo etiqueta="Edad">
              {(id) => (
                <input
                  id={id}
                  className={claseEntrada}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={Number.isNaN(m.edad) ? "" : String(m.edad)}
                  onChange={(e) => actualizar(i, { edad: e.target.value === "" ? NaN : Number(e.target.value.replace(/\D/g, "")) })}
                />
              )}
            </Campo>
          </div>
          <div className="mt-3">
            <Segmentado
              etiqueta="Sexo"
              valor={m.sexo ?? "-"}
              onCambio={(v) => actualizar(i, { sexo: v === "-" ? null : v })}
              opciones={[
                { valor: "F", texto: "Mujer" },
                { valor: "M", texto: "Hombre" },
                { valor: "-", texto: "No decir" },
              ]}
            />
          </div>
        </Tarjeta>
      ))}
      <div className="grid grid-cols-2 gap-3">
        <Boton variante="secundario" onClick={() => onCambio([...miembros, { edad: 35, sexo: null, nombre: "" }])}>
          + Adulto
        </Boton>
        <Boton variante="secundario" onClick={() => onCambio([...miembros, { edad: 8, sexo: null, nombre: "" }])}>
          + Niña o niño
        </Boton>
      </div>
      <p className="text-xs text-stone-500 dark:text-stone-400">
        El sexo solo se usa para incluir productos de higiene femenina; los bebés menores de 3 años suman pañales.
      </p>
    </>
  );
}

function PasoMascotas({
  mascotas,
  tamanos,
  onCambio,
}: {
  mascotas: Mascota[];
  tamanos: { clave: string; nombre: string }[];
  onCambio: (m: Mascota[]) => void;
}) {
  return (
    <>
      <p className="text-stone-600 dark:text-stone-300">¿Tienen mascotas? Incluimos su alimento (y arena para gatos).</p>
      {mascotas.length === 0 && (
        <Tarjeta className="text-center text-stone-500 dark:text-stone-400">Sin mascotas. Puedes seguir al siguiente paso.</Tarjeta>
      )}
      {mascotas.map((m, i) => (
        <Tarjeta key={i}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">{m.tipo === "perro" ? "🐕 Perro" : "🐈 Gato"}</h2>
            <button
              type="button"
              className="min-h-10 rounded-lg px-2 text-sm font-medium text-red-700 active:bg-red-50 dark:text-red-400"
              onClick={() => onCambio(mascotas.filter((_, j) => j !== i))}
            >
              Quitar
            </button>
          </div>
          {m.tipo === "perro" && (
            <Campo etiqueta="Tamaño">
              {(id) => (
                <select
                  id={id}
                  className={claseEntrada}
                  value={m.tamano}
                  onChange={(e) =>
                    onCambio(mascotas.map((x, j) => (j === i ? { ...x, tamano: e.target.value as TamanoPerro } : x)))
                  }
                >
                  {tamanos.map((t) => (
                    <option key={t.clave} value={t.clave}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
          )}
        </Tarjeta>
      ))}
      <div className="grid grid-cols-2 gap-3">
        <Boton variante="secundario" onClick={() => onCambio([...mascotas, { tipo: "perro", tamano: "mediano", nombre: "" }])}>
          + Perro
        </Boton>
        <Boton variante="secundario" onClick={() => onCambio([...mascotas, { tipo: "gato", tamano: "mediano", nombre: "" }])}>
          + Gato
        </Boton>
      </div>
    </>
  );
}

function PasoAlimentacion({ perfil, onCambio }: { perfil: Perfil; onCambio: (p: Partial<Perfil>) => void }) {
  const { opciones } = useApp();
  const [texto, setTexto] = useState("");
  const alternar = (lista: string[], valor: string) =>
    lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor];
  const agregarExclusion = (valor: string) => {
    const limpio = valor.trim().toLowerCase();
    if (limpio && !perfil.excluir.includes(limpio) && perfil.excluir.length < 30) {
      onCambio({ excluir: [...perfil.excluir, limpio] });
    }
    setTexto("");
  };

  return (
    <>
      <Tarjeta>
        <h2 className="font-semibold">Alergias</h2>
        <p className="mb-3 text-sm text-stone-500 dark:text-stone-400">Quitamos todo producto que las contenga.</p>
        <div className="flex flex-wrap gap-2">
          {opciones.alergias.map((a) => (
            <Chip
              key={a.clave}
              activo={perfil.alergias.includes(a.clave)}
              onClick={() => onCambio({ alergias: alternar(perfil.alergias, a.clave) })}
            >
              {a.nombre}
            </Chip>
          ))}
        </div>
        {perfil.alergias.length > 0 && (
          <p className="mt-3 text-xs text-amber-800 dark:text-amber-300">
            ⚠ Revisa siempre la etiqueta: nuestra información de alérgenos puede no estar completa.
          </p>
        )}
      </Tarjeta>

      <Tarjeta>
        <h2 className="mb-3 font-semibold">Dieta</h2>
        <div className="flex flex-wrap gap-2">
          <Chip activo={perfil.dieta === null} onClick={() => onCambio({ dieta: null })}>
            Sin restricción
          </Chip>
          {opciones.dietas.map((d) => (
            <Chip key={d.clave} activo={perfil.dieta === d.clave} onClick={() => onCambio({ dieta: d.clave })}>
              {d.nombre}
            </Chip>
          ))}
        </div>
      </Tarjeta>

      <Tarjeta>
        <h2 className="font-semibold">Alimentos que no quieren</h2>
        <p className="mb-3 text-sm text-stone-500 dark:text-stone-400">Escribe uno y presiona Agregar.</p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            agregarExclusion(texto);
          }}
        >
          <input
            className={claseEntrada}
            value={texto}
            maxLength={40}
            placeholder="Ej. brócoli"
            aria-label="Alimento a excluir"
            onChange={(e) => setTexto(e.target.value)}
          />
          <Boton type="submit" variante="secundario" disabled={!texto.trim()}>
            Agregar
          </Boton>
        </form>
        {perfil.excluir.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {perfil.excluir.map((x) => (
              <li key={x}>
                <button
                  type="button"
                  className="min-h-10 rounded-full bg-stone-800 px-4 text-sm font-medium text-white dark:bg-stone-200 dark:text-stone-900"
                  onClick={() => onCambio({ excluir: perfil.excluir.filter((y) => y !== x) })}
                  aria-label={`Quitar ${x}`}
                >
                  {x} ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {EXCLUSIONES_SUGERIDAS.filter((s) => !perfil.excluir.includes(s)).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => agregarExclusion(s)}
              className="min-h-9 rounded-full px-3 text-sm text-stone-600 border border-dashed border-stone-300 dark:text-stone-300 dark:border-stone-700"
            >
              + {s}
            </button>
          ))}
        </div>
      </Tarjeta>

      <Tarjeta>
        <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4">
          <span>
            <span className="block font-semibold">Hacemos tortillas en casa</span>
            <span className="text-sm text-stone-500 dark:text-stone-400">Incluye harina de maíz en lugar de tortilla hecha.</span>
          </span>
          <input
            type="checkbox"
            className="h-6 w-6 shrink-0 accent-marca-700"
            checked={perfil.tortillas_caseras}
            onChange={(e) => onCambio({ tortillas_caseras: e.target.checked })}
          />
        </label>
      </Tarjeta>
    </>
  );
}

function PasoPresupuesto({ perfil, onCambio }: { perfil: Perfil; onCambio: (p: Partial<Perfil>) => void }) {
  return (
    <>
      <Tarjeta>
        <Campo etiqueta="¿Cuánto quieres gastar?" ayuda="Armamos la lista para no pasarnos de esta cantidad.">
          {(id) => (
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-500">$</span>
              <input
                id={id}
                className={`${claseEntrada} tabular pl-7 text-lg font-semibold`}
                inputMode="numeric"
                pattern="[0-9]*"
                value={perfil.presupuesto ? String(perfil.presupuesto) : ""}
                onChange={(e) => onCambio({ presupuesto: Number(e.target.value.replace(/\D/g, "")) })}
              />
            </div>
          )}
        </Campo>
        <div className="mt-3 flex flex-wrap gap-2">
          {PRESUPUESTOS_RAPIDOS.map((p) => (
            <Chip key={p} activo={perfil.presupuesto === p} onClick={() => onCambio({ presupuesto: p })}>
              {dineroEntero(p)}
            </Chip>
          ))}
        </div>
      </Tarjeta>

      <Tarjeta>
        <h2 className="mb-3 font-semibold">¿Para cuántos días?</h2>
        <Segmentado
          etiqueta="Periodo"
          valor={perfil.periodo_dias}
          onCambio={(periodo_dias) => onCambio({ periodo_dias })}
          opciones={[
            { valor: 7, texto: "Semana" },
            { valor: 15, texto: "Quincena" },
            { valor: 30, texto: "Mes" },
          ]}
        />
      </Tarjeta>

      <Tarjeta>
        <Campo etiqueta="Nombre del hogar (opcional)">
          {(id) => (
            <input
              id={id}
              className={claseEntrada}
              value={perfil.nombre}
              maxLength={60}
              placeholder="Ej. Familia López"
              onChange={(e) => onCambio({ nombre: e.target.value })}
            />
          )}
        </Campo>
      </Tarjeta>

      <p className="px-1 text-xs text-stone-500 dark:text-stone-400">
        Tus datos se guardan solo en este teléfono. Para calcular la lista los enviamos a nuestro servidor, que no los
        almacena.
      </p>
    </>
  );
}
