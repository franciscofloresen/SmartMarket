import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Aviso, Boton, Burbuja, Campo, Chip, claseEntrada, Segmentado, Stepper, Tarjeta } from "../componentes/ui";
import { api, ErrorApi } from "../api";
import { useApp } from "../estado";
import { dineroEntero, hayTiendaEn } from "../formato";
import { ubicar } from "../ubicacion";
import type { HogarSugerido, Mascota, Miembro, Nivel, Perfil, Sexo, TamanoPerro } from "../tipos";

const PASOS = [
  { titulo: "¿Quiénes viven en casa?", ayuda: "Con eso calculamos cuánto come cada quien." },
  { titulo: "¿Tienen mascotas?", ayuda: "Incluimos su alimento (y arena para gatos)." },
  { titulo: "¿Qué no debe llevar?", ayuda: "Alergias, dieta y lo que no les gusta." },
  { titulo: "¿Algún antojo?", ayuda: "No son necesarios, pero si los quieren, los agregamos." },
  { titulo: "¿Dónde compran?", ayuda: "Solo te mostramos tiendas que hay en tu estado." },
  { titulo: "¿Cuánto quieren gastar?", ayuda: "Armamos la lista sin pasarnos de esa cantidad." },
] as const;

const EXCLUSIONES_SUGERIDAS = ["brócoli", "coliflor", "chile", "cerdo", "champiñones", "aguacate", "refresco", "embutidos"];
const EMOJI_ALERGIA: Record<string, string> = {
  pescado: "🐟", mariscos: "🦐", lacteos: "🥛", huevo: "🥚", gluten: "🌾", cacahuate: "🥜", nueces: "🌰", soya: "🫘", ajonjoli: "⚪",
};
const ANTOJOS_VISUAL: Record<string, { emoji: string; ejemplo: string }> = {
  refrescos: { emoji: "🥤", ejemplo: "Cola, naranja, toronja…" },
  jugos: { emoji: "🧃", ejemplo: "Jugos, té frío, hidratantes" },
  botanas: { emoji: "🍟", ejemplo: "Papas, frituras, cacahuates" },
  dulces: { emoji: "🍫", ejemplo: "Barras, gansitos, donitas" },
  galletas: { emoji: "🍪", ejemplo: "Dulces y saladas" },
  postres: { emoji: "🍨", ejemplo: "Helado, flan, gelatina" },
  cerveza: { emoji: "🍺", ejemplo: "Solo para los adultos" },
};
const EMOJI_DIETA: Record<string, string> = { vegetariana: "🥗", pescetariana: "🐟", sin_cerdo: "🚫🐖" };
const NIVELES: { valor: Nivel; emoji: string; titulo: string; texto: string }[] = [
  { valor: "ahorro", emoji: "💰", titulo: "Ahorro", texto: "Lo más barato que cubre todo. Lo que sobra, te lo quedas." },
  { valor: "equilibrado", emoji: "⚖️", titulo: "Equilibrado", texto: "Usa parte de lo que sobra en mejores marcas." },
  { valor: "premium", emoji: "⭐", titulo: "Marcas líderes", texto: "Aprovecha todo el presupuesto en las mejores marcas." },
];

// Tipos de persona del asistente: un toque agrega a alguien con una edad representativa.
interface Clase {
  clave: string;
  emoji: string;
  nombre: string;
  rango: string;
  edad: number;
  sexo: Sexo | null;
  es: (m: Miembro) => boolean;
}
const CLASES: Clase[] = [
  { clave: "bebe", emoji: "👶", nombre: "Bebé", rango: "0 a 2 años", edad: 1, sexo: null, es: (m) => m.edad <= 2 },
  { clave: "nino", emoji: "🧒", nombre: "Niña o niño", rango: "3 a 12", edad: 8, sexo: null, es: (m) => m.edad >= 3 && m.edad <= 12 },
  { clave: "adolescente", emoji: "🧑‍🎓", nombre: "Adolescente", rango: "13 a 17", edad: 15, sexo: null, es: (m) => m.edad >= 13 && m.edad <= 17 },
  { clave: "mujer", emoji: "👩", nombre: "Mujer", rango: "18 a 59", edad: 35, sexo: "F", es: (m) => m.edad >= 18 && m.edad <= 59 && m.sexo === "F" },
  { clave: "hombre", emoji: "👨", nombre: "Hombre", rango: "18 a 59", edad: 35, sexo: "M", es: (m) => m.edad >= 18 && m.edad <= 59 && m.sexo !== "F" },
  { clave: "mayor", emoji: "🧓", nombre: "Adulto mayor", rango: "60 o más", edad: 68, sexo: null, es: (m) => m.edad >= 60 },
];
const claseDe = (m: Miembro) => CLASES.find((c) => c.es(m)) ?? CLASES[4];

const PERFIL_NUEVO: Perfil = {
  nombre: "",
  presupuesto: 6000,
  periodo_dias: 30,
  miembros: [],
  mascotas: [],
  alergias: [],
  excluir: [],
  dieta: null,
  tortillas_caseras: false,
  tienda: "walmart",
  estado: null,
  nivel: "equilibrado",
  antojos: [],
};

export default function Hogar() {
  const { datos, opciones, guardarHogar, cargando, error } = useApp();
  const navegar = useNavigate();
  const editando = datos.hogar !== null;
  const [perfil, setPerfil] = useState<Perfil>(datos.hogar ?? PERFIL_NUEVO);
  const [paso, setPaso] = useState(0);
  // Cada paso empieza arriba, aunque el anterior se haya quedado desplazado.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [paso]);

  const cambiar = (parcial: Partial<Perfil>) => setPerfil((p) => ({ ...p, ...parcial }));
  const edadesValidas = perfil.miembros.every((m) => Number.isInteger(m.edad) && m.edad >= 0 && m.edad <= 120);
  const puedeAvanzar = [
    perfil.miembros.length > 0 && edadesValidas,
    true,
    true,
    true,
    true,
    perfil.presupuesto > 0 && perfil.presupuesto <= 1_000_000,
  ][paso];
  const ultimo = paso === PASOS.length - 1;

  async function terminar() {
    if (await guardarHogar({ ...perfil, nombre: perfil.nombre.trim() })) navegar("/inicio");
  }

  return (
    <div className="min-h-dvh pb-32">
      <header className="pt-seguro sticky top-0 z-20 bg-fondo/90 px-4 pb-3 backdrop-blur">
        <div className="mx-auto max-w-lg">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex flex-1 gap-1.5" aria-label={`Paso ${paso + 1} de ${PASOS.length}`} role="img">
              {PASOS.map((_, i) => (
                <span key={i} className={`h-2 flex-1 rounded-full transition-colors duration-300 ${i <= paso ? "bg-nopal" : "bg-linea"}`} />
              ))}
            </div>
            {editando && (
              <button type="button" className="min-h-10 px-1 text-sm font-semibold text-suave" onClick={() => navegar(-1)}>
                Cancelar
              </button>
            )}
          </div>
          <h1 key={paso} className="animate-aparecer text-3xl font-bold leading-tight">
            {PASOS[paso].titulo}
          </h1>
          <p className="text-suave">{PASOS[paso].ayuda}</p>
        </div>
      </header>

      <main key={paso} className="mx-auto flex max-w-lg animate-aparecer flex-col gap-4 px-4 pt-2">
        {paso === 0 && opciones.ia && <ConTusPalabras onEntendido={(s) => cambiar(aplicarSugerencia(perfil, s))} />}
        {paso === 0 && <PasoPersonas miembros={perfil.miembros} onCambio={(miembros) => cambiar({ miembros })} />}
        {paso === 1 && <PasoMascotas mascotas={perfil.mascotas} onCambio={(mascotas) => cambiar({ mascotas })} />}
        {paso === 2 && <PasoAlimentacion perfil={perfil} onCambio={cambiar} />}
        {paso === 3 && <PasoAntojos antojos={perfil.antojos} onCambio={(antojos) => cambiar({ antojos })} />}
        {paso === 4 && <PasoTienda perfil={perfil} onCambio={cambiar} />}
        {paso === 5 && <PasoPresupuesto perfil={perfil} onCambio={cambiar} />}
        {error && ultimo && <Aviso tono="error">{error}</Aviso>}
      </main>

      <footer className="pb-seguro fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-fondo via-fondo to-transparent px-4 pt-6">
        <div className="mx-auto flex max-w-lg gap-3">
          {paso > 0 && (
            <Boton variante="secundario" onClick={() => setPaso(paso - 1)} aria-label="Paso anterior">
              ←
            </Boton>
          )}
          {ultimo ? (
            <Boton onClick={terminar} disabled={!puedeAvanzar || cargando} className="flex-1">
              {cargando ? "Calculando…" : editando ? "Guardar y recalcular" : "Armar mi despensa ✨"}
            </Boton>
          ) : (
            <Boton onClick={() => setPaso(paso + 1)} disabled={!puedeAvanzar} className="flex-1">
              {paso === 0 && perfil.miembros.length === 0 ? "Agrega al menos una persona" : "Siguiente"}
            </Boton>
          )}
        </div>
      </footer>
    </div>
  );
}

/** Mezcla lo que la IA entendió con el perfil: solo pisa lo que la persona sí mencionó. */
function aplicarSugerencia(perfil: Perfil, s: HogarSugerido): Partial<Perfil> {
  return {
    miembros: s.miembros.length > 0 ? s.miembros : perfil.miembros,
    mascotas: s.mascotas.length > 0 ? s.mascotas.map((m) => ({ ...m, nombre: "" })) : perfil.mascotas,
    alergias: [...new Set([...perfil.alergias, ...s.alergias])],
    excluir: [...new Set([...perfil.excluir, ...s.excluir])],
    dieta: s.dieta ?? perfil.dieta,
    presupuesto: s.presupuesto ?? perfil.presupuesto,
    periodo_dias: s.periodo_dias ?? perfil.periodo_dias,
    tienda: s.tienda ?? perfil.tienda,
    estado: s.estado ?? perfil.estado,
    nivel: s.nivel ?? perfil.nivel,
    tortillas_caseras: s.tortillas_caseras ?? perfil.tortillas_caseras,
  };
}

function ConTusPalabras({ onEntendido }: { onEntendido: (s: HogarSugerido) => void }) {
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<"editando" | "pensando">("editando");
  const [resultado, setResultado] = useState<HogarSugerido | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function enviar() {
    setEstado("pensando");
    setError(null);
    try {
      const sugerido = await api.iaHogar(texto.trim());
      setResultado(sugerido);
      onEntendido(sugerido);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : "No se pudo interpretar.");
    } finally {
      setEstado("editando");
    }
  }

  return (
    <Tarjeta className="bg-uva-tenue">
      <h2 className="text-xl font-semibold">✨ Cuéntanos con tus palabras</h2>
      <p className="mb-3 text-sm text-suave">Opcional: escribe quiénes son y llenamos el formulario por ti. Después lo revisas.</p>
      <textarea
        className={`${claseEntrada} min-h-24 py-3`}
        maxLength={1500}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Ej. Somos mi esposo y yo, dos hijos de 7 y 10 y un perro mediano. Mi hija es alérgica al pescado. Tenemos 10 mil al mes."
        aria-label="Describe tu hogar"
      />
      {error && (
        <div className="mt-3">
          <Aviso tono="error">{error}</Aviso>
        </div>
      )}
      {resultado && (
        <div className="mt-3">
          <Aviso>
            <p>{resultado.resumen}</p>
            {resultado.falta.length > 0 && <p className="mt-1 text-suave">Nos falta: {resultado.falta.join(", ")}.</p>}
            <p className="mt-1 font-semibold">Revisa los datos en los siguientes pasos.</p>
          </Aviso>
        </div>
      )}
      <Boton variante="secundario" ancho className="mt-3" disabled={texto.trim().length < 5 || estado === "pensando"} onClick={enviar}>
        {estado === "pensando" ? "Leyendo…" : "Llenar por mí"}
      </Boton>
    </Tarjeta>
  );
}

function PasoPersonas({ miembros, onCambio }: { miembros: Miembro[]; onCambio: (m: Miembro[]) => void }) {
  const [detalle, setDetalle] = useState(false);
  const cuenta = (c: Clase) => miembros.filter((m) => claseDe(m) === c).length;

  function ajustar(c: Clase, nuevo: number) {
    const actual = cuenta(c);
    if (nuevo > actual) {
      onCambio([...miembros, { edad: c.edad, sexo: c.sexo, nombre: "" }]);
    } else {
      // Quita a la última persona de ese tipo.
      const indice = miembros.map((m, i) => (claseDe(m) === c ? i : -1)).filter((i) => i >= 0).pop();
      onCambio(miembros.filter((_, i) => i !== indice));
    }
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {CLASES.map((c) => {
          const n = cuenta(c);
          return (
            <div
              key={c.clave}
              className={`flex flex-col items-center gap-2 rounded-3xl p-3 text-center transition-colors ${
                n > 0 ? "bg-nopal-tenue ring-2 ring-nopal" : "bg-tarjeta shadow-suave ring-1 ring-linea"
              }`}
            >
              <span className="text-4xl" aria-hidden="true">
                {c.emoji}
              </span>
              <div className="leading-tight">
                <p className="font-titulo text-lg font-semibold">{c.nombre}</p>
                <p className="text-xs text-suave">{c.rango}</p>
              </div>
              <Stepper compacto etiqueta={c.nombre} valor={n} max={10} onCambio={(v) => ajustar(c, v)} />
            </div>
          );
        })}
      </div>

      {miembros.length > 0 && (
        <Tarjeta>
          <button
            type="button"
            className="flex min-h-10 w-full items-center justify-between text-left font-semibold"
            aria-expanded={detalle}
            onClick={() => setDetalle(!detalle)}
          >
            <span>
              {miembros.length} {miembros.length === 1 ? "persona" : "personas"} · ajustar edades
            </span>
            <span className={`text-suave transition-transform ${detalle ? "rotate-180" : ""}`} aria-hidden="true">
              ⌄
            </span>
          </button>
          {detalle && (
            <ul className="mt-2 flex flex-col gap-3">
              {miembros.map((m, i) => {
                const c = claseDe(m);
                const actualizar = (parcial: Partial<Miembro>) => onCambio(miembros.map((x, j) => (j === i ? { ...x, ...parcial } : x)));
                return (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-2xl" aria-hidden="true">
                      {c.emoji}
                    </span>
                    <input
                      className={`${claseEntrada} min-w-0 flex-1`}
                      value={m.nombre}
                      maxLength={40}
                      placeholder="Nombre (opcional)"
                      aria-label={`Nombre de ${c.nombre.toLowerCase()} ${i + 1}`}
                      onChange={(e) => actualizar({ nombre: e.target.value })}
                    />
                    <input
                      className={`${claseEntrada} tabular w-16 px-2 text-center`}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      aria-label={`Edad de ${m.nombre || c.nombre.toLowerCase()}`}
                      value={Number.isNaN(m.edad) ? "" : String(m.edad)}
                      onChange={(e) => actualizar({ edad: e.target.value === "" ? NaN : Number(e.target.value.replace(/\D/g, "")) })}
                    />
                    {(m.edad >= 12 || Number.isNaN(m.edad)) && (
                      <button
                        type="button"
                        className="h-12 w-12 shrink-0 rounded-2xl bg-hundido text-xl"
                        aria-label={`Sexo: ${m.sexo === "F" ? "mujer" : m.sexo === "M" ? "hombre" : "sin indicar"}. Toca para cambiar`}
                        onClick={() => actualizar({ sexo: m.sexo === "F" ? "M" : m.sexo === "M" ? null : "F" })}
                      >
                        {m.sexo === "F" ? "♀" : m.sexo === "M" ? "♂" : "·"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-2 text-xs text-suave">
            El sexo (♀/♂) solo sirve para incluir productos de higiene femenina. Los menores de 3 años suman pañales.
          </p>
        </Tarjeta>
      )}
    </>
  );
}

function PasoMascotas({ mascotas, onCambio }: { mascotas: Mascota[]; onCambio: (m: Mascota[]) => void }) {
  const tipos: { emoji: string; nombre: string; ayuda: string; tipo: Mascota["tipo"]; tamano: TamanoPerro }[] = [
    { emoji: "🐕", nombre: "Perro chico", ayuda: "hasta 10 kg", tipo: "perro", tamano: "chico" },
    { emoji: "🦮", nombre: "Perro mediano", ayuda: "10 a 25 kg", tipo: "perro", tamano: "mediano" },
    { emoji: "🐕‍🦺", nombre: "Perro grande", ayuda: "25 a 45 kg", tipo: "perro", tamano: "grande" },
    { emoji: "🐈", nombre: "Gato", ayuda: "con arena", tipo: "gato", tamano: "mediano" },
  ];
  const es = (m: Mascota, t: (typeof tipos)[number]) => m.tipo === t.tipo && (t.tipo === "gato" || m.tamano === t.tamano || (t.tamano === "grande" && m.tamano === "gigante"));

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {tipos.map((t) => {
          const n = mascotas.filter((m) => es(m, t)).length;
          return (
            <div
              key={t.nombre}
              className={`flex flex-col items-center gap-2 rounded-3xl p-3 text-center transition-colors ${
                n > 0 ? "bg-nopal-tenue ring-2 ring-nopal" : "bg-tarjeta shadow-suave ring-1 ring-linea"
              }`}
            >
              <span className="text-4xl" aria-hidden="true">
                {t.emoji}
              </span>
              <div className="leading-tight">
                <p className="font-titulo text-lg font-semibold">{t.nombre}</p>
                <p className="text-xs text-suave">{t.ayuda}</p>
              </div>
              <Stepper
                compacto
                etiqueta={t.nombre}
                valor={n}
                max={6}
                onCambio={(v) => {
                  if (v > n) return onCambio([...mascotas, { tipo: t.tipo, tamano: t.tamano, nombre: "" }]);
                  const indice = mascotas.map((m, i) => (es(m, t) ? i : -1)).filter((i) => i >= 0).pop();
                  onCambio(mascotas.filter((_, i) => i !== indice));
                }}
              />
            </div>
          );
        })}
      </div>
      {mascotas.length === 0 && <p className="text-center text-suave">¿Sin mascotas? Sigue al siguiente paso.</p>}
    </>
  );
}

function PasoAlimentacion({ perfil, onCambio }: { perfil: Perfil; onCambio: (p: Partial<Perfil>) => void }) {
  const { opciones } = useApp();
  const [texto, setTexto] = useState("");
  const alternar = (lista: string[], valor: string) => (lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor]);
  const agregarExclusion = (valor: string) => {
    const limpio = valor.trim().toLowerCase();
    if (limpio && !perfil.excluir.includes(limpio) && perfil.excluir.length < 30) onCambio({ excluir: [...perfil.excluir, limpio] });
    setTexto("");
  };

  return (
    <>
      <Tarjeta>
        <h2 className="text-xl font-semibold">Alergias</h2>
        <p className="mb-3 text-sm text-suave">Quitamos todo lo que las contenga o pueda contenerlas.</p>
        <div className="flex flex-wrap gap-2">
          {opciones.alergias.map((a) => (
            <Chip key={a.clave} activo={perfil.alergias.includes(a.clave)} onClick={() => onCambio({ alergias: alternar(perfil.alergias, a.clave) })}>
              {EMOJI_ALERGIA[a.clave] ?? "⚠️"} {a.nombre}
            </Chip>
          ))}
        </div>
        {perfil.alergias.length > 0 && (
          <div className="mt-3">
            <Aviso tono="alerta">Revisa siempre la etiqueta: nuestra información de alérgenos puede no estar completa.</Aviso>
          </div>
        )}
      </Tarjeta>

      <Tarjeta>
        <h2 className="mb-3 text-xl font-semibold">Dieta</h2>
        <div className="flex flex-wrap gap-2">
          <Chip activo={perfil.dieta === null} onClick={() => onCambio({ dieta: null })}>
            🍽️ Comemos de todo
          </Chip>
          {opciones.dietas.map((d) => (
            <Chip key={d.clave} activo={perfil.dieta === d.clave} onClick={() => onCambio({ dieta: d.clave })}>
              {EMOJI_DIETA[d.clave] ?? "🥗"} {d.nombre}
            </Chip>
          ))}
        </div>
      </Tarjeta>

      <Tarjeta>
        <h2 className="text-xl font-semibold">No nos gusta</h2>
        <p className="mb-3 text-sm text-suave">Toca una sugerencia o escribe otro alimento.</p>
        <div className="flex flex-wrap gap-2">
          {perfil.excluir.map((x) => (
            <button
              key={x}
              type="button"
              className="min-h-11 animate-rebote rounded-full bg-rosa px-4 text-sm font-semibold text-sobre"
              onClick={() => onCambio({ excluir: perfil.excluir.filter((y) => y !== x) })}
              aria-label={`Quitar ${x}`}
            >
              🚫 {x} ×
            </button>
          ))}
          {EXCLUSIONES_SUGERIDAS.filter((s) => !perfil.excluir.includes(s)).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => agregarExclusion(s)}
              className="min-h-11 rounded-full border-2 border-dashed border-linea px-4 text-sm font-medium text-suave active:scale-95"
            >
              + {s}
            </button>
          ))}
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            agregarExclusion(texto);
          }}
        >
          <input
            className={claseEntrada}
            value={texto}
            maxLength={40}
            placeholder="Otro alimento…"
            aria-label="Otro alimento que no les gusta"
            onChange={(e) => setTexto(e.target.value)}
          />
          <Boton type="submit" variante="secundario" disabled={!texto.trim()}>
            Agregar
          </Boton>
        </form>
      </Tarjeta>

      <Tarjeta>
        <label className="flex min-h-12 cursor-pointer items-center gap-3">
          <Burbuja emoji="🫓" fondo="bg-maiz-tenue" />
          <span className="flex-1">
            <span className="block font-semibold">Hacemos tortillas en casa</span>
            <span className="text-sm text-suave">Llevamos harina de maíz en vez de tortilla hecha.</span>
          </span>
          <input
            type="checkbox"
            className="h-7 w-7 shrink-0 accent-[rgb(var(--nopal))]"
            checked={perfil.tortillas_caseras}
            onChange={(e) => onCambio({ tortillas_caseras: e.target.checked })}
          />
        </label>
      </Tarjeta>
    </>
  );
}

function PasoAntojos({ antojos, onCambio }: { antojos: string[]; onCambio: (a: string[]) => void }) {
  const { opciones } = useApp();
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {opciones.antojos.map((a) => {
          const activo = antojos.includes(a.clave);
          const visual = ANTOJOS_VISUAL[a.clave] ?? { emoji: "🍬", ejemplo: "" };
          return (
            <button
              key={a.clave}
              type="button"
              aria-pressed={activo}
              onClick={() => onCambio(activo ? antojos.filter((x) => x !== a.clave) : [...antojos, a.clave])}
              className={`relative flex min-h-32 flex-col items-center justify-center gap-1 rounded-3xl p-3 text-center transition-colors active:scale-95 ${
                activo ? "bg-nopal-tenue ring-2 ring-nopal" : "bg-tarjeta shadow-suave ring-1 ring-linea"
              }`}
            >
              {activo && (
                <span className="absolute right-3 top-3 flex h-6 w-6 animate-rebote items-center justify-center rounded-full bg-nopal text-sm font-bold text-sobre" aria-hidden="true">
                  ✓
                </span>
              )}
              <span className="text-4xl" aria-hidden="true">
                {visual.emoji}
              </span>
              <span className="font-titulo text-lg font-semibold leading-tight">{a.nombre}</span>
              <span className="text-xs text-suave">{visual.ejemplo}</span>
            </button>
          );
        })}
      </div>
      <p className="text-center text-sm text-suave">
        {antojos.length === 0
          ? "¿Ninguno? Sigue al siguiente paso."
          : "Si el presupuesto no alcanza, es lo primero que recortamos. Luego puedes cambiar cantidades en tu lista."}
      </p>
    </>
  );
}

function PasoTienda({ perfil, onCambio }: { perfil: Perfil; onCambio: (p: Partial<Perfil>) => void }) {
  const { opciones } = useApp();
  const [ubicando, setUbicando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tono: "info" | "alerta"; texto: string } | null>(null);
  // Sin conexión no llega la lista completa: se usan los estados que conozcan las tiendas.
  const estados = opciones.estados.length
    ? opciones.estados
    : [...new Set(opciones.tiendas.flatMap((t) => t.estados))].sort((a, b) => a.localeCompare(b, "es"));
  const cercanas = opciones.tiendas.filter((t) => hayTiendaEn(t, perfil.estado));
  const lejanas = opciones.tiendas.filter((t) => !hayTiendaEn(t, perfil.estado));
  const tienda = opciones.tiendas.find((t) => t.clave === perfil.tienda);
  const sinPreciosLocales = perfil.estado !== null && tienda !== undefined && tienda.estados.length > 0 && !tienda.estados.includes(perfil.estado);

  // Si la tienda elegida no existe en el estado nuevo, se pasa a la primera que sí.
  function elegirEstado(estado: string | null) {
    const disponibles = opciones.tiendas.filter((t) => hayTiendaEn(t, estado));
    const sigue = disponibles.some((t) => t.clave === perfil.tienda);
    onCambio({ estado, tienda: sigue || disponibles.length === 0 ? perfil.tienda : disponibles[0].clave });
  }

  async function usarUbicacion() {
    setUbicando(true);
    setMensaje(null);
    try {
      const lugar = await ubicar();
      if (estados.includes(lugar.estado)) {
        elegirEstado(lugar.estado);
        setMensaje({ tono: "info", texto: `Estás cerca de ${lugar.ciudad}, ${lugar.estado}.` });
      } else {
        setMensaje({ tono: "alerta", texto: "No reconocimos tu estado. Elígelo de la lista." });
      }
    } catch (e) {
      setMensaje({ tono: "alerta", texto: e instanceof Error ? e.message : "No pudimos obtener tu ubicación." });
    } finally {
      setUbicando(false);
    }
  }

  return (
    <>
      <Tarjeta>
        <Campo etiqueta="¿En qué estado vives?" ayuda="Tu ubicación no sale de tu teléfono: solo guardamos el estado.">
          {(id) => (
            <select id={id} className={claseEntrada} value={perfil.estado ?? ""} onChange={(e) => elegirEstado(e.target.value || null)}>
              <option value="">Sin estado (precio nacional)</option>
              {estados.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Boton variante="secundario" ancho className="mt-3" disabled={ubicando} onClick={usarUbicacion}>
          {ubicando ? "Buscando…" : "📍 Usar mi ubicación"}
        </Boton>
        {mensaje && (
          <div className="mt-3">
            <Aviso tono={mensaje.tono}>{mensaje.texto}</Aviso>
          </div>
        )}
      </Tarjeta>

      <div>
        <h2 className="mb-2 px-1 text-xl font-semibold">{perfil.estado ? `Tiendas en ${perfil.estado}` : "Elige tu tienda"}</h2>
        <div className="grid grid-cols-2 gap-3">
          {cercanas.map((t) => {
            const activa = t.clave === perfil.tienda;
            return (
              <button
                key={t.clave}
                type="button"
                aria-pressed={activa}
                onClick={() => onCambio({ tienda: t.clave })}
                className={`flex min-h-24 flex-col items-start justify-between rounded-3xl p-4 text-left transition-colors active:scale-95 ${
                  activa ? "bg-nopal-tenue ring-2 ring-nopal" : "bg-tarjeta shadow-suave ring-1 ring-linea"
                }`}
              >
                <span className="flex w-full items-start justify-between gap-2">
                  <span className="font-titulo text-xl font-bold leading-tight">{t.nombre}</span>
                  {activa && (
                    <span className="flex h-6 w-6 shrink-0 animate-rebote items-center justify-center rounded-full bg-nopal text-sm font-bold text-sobre" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </span>
                <span className="text-xs text-suave">{t.productos > 0 ? `${t.productos.toLocaleString("es-MX")} productos` : " "}</span>
              </button>
            );
          })}
        </div>
        {lejanas.length > 0 && (
          <p className="mt-3 px-1 text-sm text-suave">
            Sin sucursales en {perfil.estado}: {lejanas.map((t) => t.nombre).join(", ")}.
          </p>
        )}
        {sinPreciosLocales && (
          <div className="mt-3">
            <Aviso tono="alerta">
              Profeco no registró precios de {tienda.nombre} en {perfil.estado}; usaremos su promedio nacional.
            </Aviso>
          </div>
        )}
        <p className="mt-3 text-center text-sm text-suave">Después podrás comparar cuánto cuesta tu despensa en cada una.</p>
      </div>
    </>
  );
}

function PasoPresupuesto({ perfil, onCambio }: { perfil: Perfil; onCambio: (p: Partial<Perfil>) => void }) {
  const personas = Math.max(1, perfil.miembros.length);
  const porSemana = (perfil.presupuesto / perfil.periodo_dias) * 7;
  const maximo = Math.max(20000, Math.ceil(perfil.presupuesto / 5000) * 5000);

  return (
    <>
      <Tarjeta className="text-center">
        <label htmlFor="presupuesto" className="text-sm font-semibold text-suave">
          Presupuesto para {perfil.periodo_dias === 30 ? "el mes" : perfil.periodo_dias === 15 ? "la quincena" : "la semana"}
        </label>
        <div className="relative mx-auto my-1 flex items-center justify-center">
          <span className="font-titulo text-3xl font-bold text-suave">$</span>
          <input
            id="presupuesto"
            className="tabular w-48 bg-transparent text-center font-titulo font-bold text-tinta focus:outline-none"
            style={{ fontSize: "3.25rem", lineHeight: 1.1 }}
            inputMode="numeric"
            pattern="[0-9]*"
            value={perfil.presupuesto ? perfil.presupuesto.toLocaleString("es-MX") : ""}
            onChange={(e) => onCambio({ presupuesto: Number(e.target.value.replace(/\D/g, "").slice(0, 7)) })}
          />
        </div>
        <input
          type="range"
          className="deslizador mt-2"
          min={500}
          max={maximo}
          step={250}
          value={Math.min(perfil.presupuesto, maximo)}
          aria-label="Presupuesto"
          onChange={(e) => onCambio({ presupuesto: Number(e.target.value) })}
        />
        <p className="mt-3 text-sm text-suave">
          ≈ {dineroEntero(porSemana)} por semana · {dineroEntero(porSemana / personas)} por persona
        </p>
      </Tarjeta>

      <Tarjeta>
        <h2 className="mb-3 text-xl font-semibold">¿Para cuántos días?</h2>
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

      <div>
        <h2 className="mb-2 px-1 text-xl font-semibold">¿Qué marcas prefieres?</h2>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Nivel de marcas">
          {NIVELES.map((n) => {
            const activo = perfil.nivel === n.valor;
            return (
              <button
                key={n.valor}
                type="button"
                role="radio"
                aria-checked={activo}
                onClick={() => onCambio({ nivel: n.valor })}
                className={`flex items-center gap-3 rounded-3xl p-3 text-left transition-colors active:scale-[0.98] ${
                  activo ? "bg-nopal-tenue ring-2 ring-nopal" : "bg-tarjeta shadow-suave ring-1 ring-linea"
                }`}
              >
                <Burbuja emoji={n.emoji} fondo={activo ? "bg-tarjeta" : "bg-hundido"} />
                <span className="flex-1">
                  <span className="block font-titulo text-lg font-semibold leading-tight">{n.titulo}</span>
                  <span className="text-sm text-suave">{n.texto}</span>
                </span>
                {activo && (
                  <span className="text-xl text-nopal" aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

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

      <p className="px-1 text-center text-xs text-suave">
        🔒 Tus datos se guardan solo en este teléfono. Para calcular la lista los enviamos a nuestro servidor, que no los almacena.
      </p>
    </>
  );
}
