import { useEffect, useId, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variante = "primario" | "secundario" | "peligro" | "texto";

const VARIANTES: Record<Variante, string> = {
  primario: "bg-marca-700 text-white active:bg-marca-800 disabled:bg-stone-300 dark:disabled:bg-stone-700",
  secundario:
    "bg-white text-stone-900 ring-1 ring-stone-300 active:bg-stone-100 dark:bg-stone-900 dark:text-stone-100 dark:ring-stone-700 dark:active:bg-stone-800",
  peligro: "bg-white text-red-700 ring-1 ring-red-200 active:bg-red-50 dark:bg-stone-900 dark:text-red-400 dark:ring-red-900",
  texto: "text-marca-700 active:bg-marca-50 dark:text-marca-500 dark:active:bg-stone-800",
};

export function Boton({
  variante = "primario",
  ancho = false,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; ancho?: boolean }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold transition-colors disabled:cursor-not-allowed ${VARIANTES[variante]} ${ancho ? "w-full" : ""} ${className}`}
      {...props}
    />
  );
}

export function Tarjeta({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800 ${className}`}>
      {children}
    </section>
  );
}

export function Chip({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={`min-h-10 rounded-full px-4 text-sm font-medium ring-1 transition-colors ${
        activo
          ? "bg-marca-700 text-white ring-marca-700"
          : "bg-white text-stone-700 ring-stone-300 dark:bg-stone-900 dark:text-stone-200 dark:ring-stone-700"
      }`}
    >
      {children}
    </button>
  );
}

export function Segmentado<T extends string | number>({
  opciones,
  valor,
  onCambio,
  etiqueta,
}: {
  opciones: { valor: T; texto: string }[];
  valor: T;
  onCambio: (v: T) => void;
  etiqueta: string;
}) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="flex rounded-xl bg-stone-100 p-1 dark:bg-stone-800">
      {opciones.map((o) => (
        <button
          key={String(o.valor)}
          type="button"
          role="radio"
          aria-checked={o.valor === valor}
          onClick={() => onCambio(o.valor)}
          className={`min-h-10 flex-1 rounded-lg px-2 text-sm font-medium transition-colors ${
            o.valor === valor
              ? "bg-white text-stone-900 shadow-sm dark:bg-marca-700 dark:text-white"
              : "text-stone-600 dark:text-stone-300"
          }`}
        >
          {o.texto}
        </button>
      ))}
    </div>
  );
}

export function Stepper({
  valor,
  onCambio,
  min = 0,
  max = 99,
  etiqueta,
}: {
  valor: number;
  onCambio: (v: number) => void;
  min?: number;
  max?: number;
  etiqueta: string;
}) {
  const boton =
    "flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100 text-2xl font-semibold active:bg-stone-200 disabled:opacity-40 dark:bg-stone-800";
  return (
    <div className="flex items-center gap-3" role="group" aria-label={etiqueta}>
      <button type="button" className={boton} aria-label="Menos" disabled={valor <= min} onClick={() => onCambio(valor - 1)}>
        −
      </button>
      <span className="tabular w-10 text-center text-2xl font-semibold" aria-live="polite">
        {valor}
      </span>
      <button type="button" className={boton} aria-label="Más" disabled={valor >= max} onClick={() => onCambio(valor + 1)}>
        +
      </button>
    </div>
  );
}

export function Campo({
  etiqueta,
  ayuda,
  children,
}: {
  etiqueta: string;
  ayuda?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-stone-700 dark:text-stone-300">
        {etiqueta}
      </label>
      {children(id)}
      {ayuda && <p className="text-xs text-stone-500 dark:text-stone-400">{ayuda}</p>}
    </div>
  );
}

export const claseEntrada =
  "min-h-12 w-full rounded-xl bg-white px-3 ring-1 ring-stone-300 placeholder:text-stone-400 focus:ring-2 focus:ring-marca-600 dark:bg-stone-900 dark:ring-stone-700";

export function Aviso({ tono = "info", children }: { tono?: "info" | "alerta" | "error"; children: ReactNode }) {
  const tonos = {
    info: "bg-marca-50 text-marca-900 ring-marca-200 dark:bg-marca-900/30 dark:text-marca-100 dark:ring-marca-800",
    alerta: "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-100 dark:ring-amber-800",
    error: "bg-red-50 text-red-900 ring-red-200 dark:bg-red-900/30 dark:text-red-100 dark:ring-red-800",
  };
  return (
    <div role={tono === "error" ? "alert" : "status"} className={`rounded-xl p-3 text-sm ring-1 ${tonos[tono]}`}>
      {children}
    </div>
  );
}

/** Hoja inferior estilo iOS. Se cierra con el fondo, con Escape o con el botón. */
export function Hoja({
  abierta,
  onCerrar,
  titulo,
  children,
}: {
  abierta: boolean;
  onCerrar: () => void;
  titulo: string;
  children: ReactNode;
}) {
  const idTitulo = useId();
  useEffect(() => {
    if (!abierta) return;
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    document.addEventListener("keydown", alTeclear);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = overflow;
    };
  }, [abierta, onCerrar]);

  if (!abierta) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCerrar} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className="pb-seguro relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white px-4 pt-3 shadow-xl dark:bg-stone-900"
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-stone-300 dark:bg-stone-700" aria-hidden="true" />
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id={idTitulo} className="text-lg font-semibold leading-snug">
            {titulo}
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            className="-mr-2 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-2xl text-stone-500 active:bg-stone-100 dark:active:bg-stone-800"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Cargando({ texto }: { texto: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-50/70 backdrop-blur-sm dark:bg-stone-950/70" role="status">
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-6 py-5 shadow-lg dark:bg-stone-900">
        <span className="h-8 w-8 animate-spin rounded-full border-4 border-marca-200 border-t-marca-700" aria-hidden="true" />
        <span className="text-sm font-medium">{texto}</span>
      </div>
    </div>
  );
}

export function Encabezado({ titulo, subtitulo, accion }: { titulo: string; subtitulo?: string; accion?: ReactNode }) {
  return (
    <header className="pt-seguro sticky top-0 z-20 border-b border-stone-200 bg-stone-50/90 px-4 pb-3 backdrop-blur dark:border-stone-800 dark:bg-stone-950/90">
      <div className="mx-auto flex max-w-lg items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">{titulo}</h1>
          {subtitulo && <p className="truncate text-sm text-stone-500 dark:text-stone-400">{subtitulo}</p>}
        </div>
        {accion}
      </div>
    </header>
  );
}
