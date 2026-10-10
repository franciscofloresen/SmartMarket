import { useEffect, useId, useMemo, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variante = "primario" | "secundario" | "peligro" | "texto";

const VARIANTES: Record<Variante, string> = {
  // El primario se "hunde" al presionarlo: pierde la sombra sólida y baja 4px.
  primario:
    "bg-nopal text-sobre shadow-boton active:translate-y-1 active:shadow-none disabled:bg-linea disabled:text-suave disabled:shadow-none disabled:translate-y-0",
  secundario: "bg-tarjeta text-tinta ring-2 ring-linea active:bg-hundido disabled:opacity-50",
  peligro: "bg-tarjeta text-rosa ring-2 ring-rosa-tenue active:bg-rosa-tenue",
  texto: "text-nopal active:bg-nopal-tenue",
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
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 font-titulo text-lg font-semibold transition-[transform,box-shadow,background-color] duration-100 disabled:cursor-not-allowed ${VARIANTES[variante]} ${ancho ? "w-full" : ""} ${className}`}
      {...props}
    />
  );
}

export function Tarjeta({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl bg-tarjeta p-4 shadow-suave ring-1 ring-linea/60 ${className}`}>{children}</section>;
}

/** Emoji dentro de un círculo de color. */
export function Burbuja({ emoji, fondo = "bg-hundido", tam = "md" }: { emoji: string; fondo?: string; tam?: "sm" | "md" | "lg" }) {
  const tamanos = { sm: "h-9 w-9 text-lg", md: "h-11 w-11 text-2xl", lg: "h-16 w-16 text-4xl" };
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-2xl ${fondo} ${tamanos[tam]}`} aria-hidden="true">
      {emoji}
    </span>
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
      className={`min-h-11 rounded-full px-4 text-sm font-semibold transition-colors active:scale-95 ${
        activo ? "bg-nopal text-sobre" : "bg-tarjeta text-tinta ring-2 ring-linea"
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
    <div role="radiogroup" aria-label={etiqueta} className="flex rounded-2xl bg-hundido p-1">
      {opciones.map((o) => (
        <button
          key={String(o.valor)}
          type="button"
          role="radio"
          aria-checked={o.valor === valor}
          onClick={() => onCambio(o.valor)}
          className={`min-h-11 flex-1 rounded-xl px-2 text-sm font-semibold transition-colors ${
            o.valor === valor ? "bg-nopal text-sobre shadow-sm" : "text-suave"
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
  compacto = false,
}: {
  valor: number;
  onCambio: (v: number) => void;
  min?: number;
  max?: number;
  etiqueta: string;
  compacto?: boolean;
}) {
  const lado = compacto ? "h-10 w-10 text-xl" : "h-12 w-12 text-2xl";
  const boton = `flex ${lado} items-center justify-center rounded-full font-bold transition-transform active:scale-90 disabled:opacity-30`;
  return (
    <div className="flex items-center gap-2" role="group" aria-label={etiqueta}>
      <button
        type="button"
        className={`${boton} bg-hundido text-tinta`}
        aria-label={`Menos ${etiqueta}`}
        disabled={valor <= min}
        onClick={() => onCambio(valor - 1)}
      >
        −
      </button>
      <span key={valor} className={`tabular ${compacto ? "w-7 text-xl" : "w-10 text-2xl"} animate-rebote text-center font-titulo font-bold`} aria-live="polite">
        {valor}
      </span>
      <button
        type="button"
        className={`${boton} bg-nopal text-sobre`}
        aria-label={`Más ${etiqueta}`}
        disabled={valor >= max}
        onClick={() => onCambio(valor + 1)}
      >
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
      <label htmlFor={id} className="text-sm font-semibold text-suave">
        {etiqueta}
      </label>
      {children(id)}
      {ayuda && <p className="text-xs text-suave">{ayuda}</p>}
    </div>
  );
}

export const claseEntrada =
  "min-h-12 w-full rounded-2xl bg-tarjeta px-4 ring-2 ring-linea placeholder:text-suave/70 focus:ring-nopal focus:outline-none";

export function Aviso({ tono = "info", children }: { tono?: "info" | "alerta" | "error" | "consejo"; children: ReactNode }) {
  const tonos = {
    info: "bg-nopal-tenue",
    alerta: "bg-maiz-tenue",
    error: "bg-rosa-tenue",
    consejo: "bg-uva-tenue",
  };
  const iconos = { info: "✅", alerta: "⚠️", error: "😕", consejo: "💡" };
  return (
    <div role={tono === "error" ? "alert" : "status"} className={`flex animate-aparecer gap-3 rounded-2xl p-3 text-sm ${tonos[tono]}`}>
      <span aria-hidden="true">{iconos[tono]}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Hoja inferior. Se cierra con el fondo, con Escape o con el botón. */
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
      <div className="absolute inset-0 animate-desvanecer bg-black/50" onClick={onCerrar} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className="pb-seguro relative flex max-h-[92dvh] w-full max-w-lg animate-subir flex-col rounded-t-[2rem] bg-fondo shadow-xl"
      >
        <div className="shrink-0 px-5 pt-3">
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-linea" aria-hidden="true" />
          <div className="flex items-start justify-between gap-3">
            <h2 id={idTitulo} className="text-2xl font-bold leading-tight">
              {titulo}
            </h2>
            <button
              type="button"
              onClick={onCerrar}
              className="-mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-hundido text-xl text-suave active:scale-90"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2 pt-3">{children}</div>
      </div>
    </div>
  );
}

export function Cargando({ texto }: { texto: string }) {
  return (
    <div className="fixed inset-0 z-50 flex animate-desvanecer items-center justify-center bg-fondo/70 backdrop-blur-sm" role="status">
      <div className="flex flex-col items-center gap-3 rounded-3xl bg-tarjeta px-8 py-6 shadow-suave">
        <span className="animate-bounce text-5xl" aria-hidden="true">
          🛒
        </span>
        <span className="font-titulo text-lg font-semibold">{texto}</span>
      </div>
    </div>
  );
}

export function Encabezado({ titulo, subtitulo, accion }: { titulo: string; subtitulo?: string; accion?: ReactNode }) {
  return (
    <header className="pt-seguro sticky top-0 z-20 bg-fondo/90 px-4 pb-2 backdrop-blur">
      <div className="mx-auto flex max-w-lg items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-bold leading-tight">{titulo}</h1>
          {subtitulo && <p className="truncate text-sm text-suave">{subtitulo}</p>}
        </div>
        {accion}
      </div>
    </header>
  );
}

/** Anillo de progreso (0 a 100) con contenido al centro. */
export function Anillo({
  porcentaje,
  tam = 132,
  grosor = 14,
  color = "rgb(var(--nopal))",
  children,
  etiqueta,
}: {
  porcentaje: number;
  tam?: number;
  grosor?: number;
  color?: string;
  children?: ReactNode;
  etiqueta: string;
}) {
  const radio = (tam - grosor) / 2;
  const circunferencia = 2 * Math.PI * radio;
  const avance = Math.max(0, Math.min(100, porcentaje));
  return (
    <div
      className="relative shrink-0"
      style={{ width: tam, height: tam }}
      role="progressbar"
      aria-label={etiqueta}
      aria-valuenow={Math.round(avance)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg width={tam} height={tam} className="-rotate-90">
        <circle cx={tam / 2} cy={tam / 2} r={radio} fill="none" stroke="rgb(var(--hundido))" strokeWidth={grosor} />
        <circle
          cx={tam / 2}
          cy={tam / 2}
          r={radio}
          fill="none"
          stroke={color}
          strokeWidth={grosor}
          strokeLinecap="round"
          strokeDasharray={circunferencia}
          strokeDashoffset={circunferencia * (1 - avance / 100)}
          style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

const COLORES_CONFETI = ["var(--nopal)", "var(--maiz)", "var(--rosa)", "var(--papaya)", "var(--cielo)", "var(--uva)"];

/** Lluvia de confeti decorativa; con "reducir movimiento" casi no se ve. */
export function Confeti({ piezas = 60 }: { piezas?: number }) {
  const lista = useMemo(
    () =>
      Array.from({ length: piezas }, (_, i) => ({
        izquierda: Math.random() * 100,
        dx: `${(Math.random() - 0.5) * 30}vw`,
        giro: `${(Math.random() - 0.5) * 1080}deg`,
        duracion: `${1.6 + Math.random() * 1.4}s`,
        espera: `${Math.random() * 0.5}s`,
        color: COLORES_CONFETI[i % COLORES_CONFETI.length],
        redondo: i % 3 === 0,
      })),
    [piezas],
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {lista.map((p, i) => (
        <span
          key={i}
          className={`absolute -top-4 h-3 w-2 animate-confeti ${p.redondo ? "rounded-full" : "rounded-sm"}`}
          style={
            {
              left: `${p.izquierda}%`,
              backgroundColor: `rgb(${p.color})`,
              "--dx": p.dx,
              "--giro": p.giro,
              "--duracion": p.duracion,
              "--espera": p.espera,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
