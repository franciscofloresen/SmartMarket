import { Link, Navigate } from "react-router-dom";
import { Burbuja } from "../componentes/ui";
import { useApp } from "../estado";

const VENTAJAS: [string, string, string, string][] = [
  ["👨‍👩‍👧‍👦", "bg-rosa-tenue", "A la medida", "Cantidades según edades, mascotas y días."],
  ["🛡️", "bg-cielo-tenue", "Sin lo que no va", "Fuera alergias y lo que no les gusta."],
  ["💰", "bg-maiz-tenue", "Dentro del presupuesto", "Con precios reales de Profeco en 6 tiendas."],
];
const FLOTANTES = ["🥑", "🍅", "🥚", "🌽", "🍌", "🧀", "🥛", "🥕"];

export default function Bienvenida() {
  const { datos } = useApp();
  if (datos.hogar) return <Navigate to="/inicio" replace />;

  return (
    <main className="pt-seguro pb-seguro mx-auto flex min-h-dvh max-w-lg flex-col px-6">
      <div className="flex flex-1 flex-col justify-center gap-7 py-8">
        <div className="relative mx-auto my-6 h-36 w-36" aria-hidden="true">
          <div className="absolute inset-0 flex animate-rebote items-center justify-center rounded-[2.5rem] bg-nopal text-8xl shadow-boton">🧺</div>
          {FLOTANTES.map((e, i) => {
            // Desfasados para que ninguno quede justo arriba o abajo, donde chocarían con el título.
            const angulo = ((i + 0.5) / FLOTANTES.length) * 2 * Math.PI;
            return (
              <span
                key={e}
                className="absolute animate-aparecer text-3xl"
                style={{
                  left: `calc(50% + ${Math.cos(angulo) * 112}px - 0.9rem)`,
                  top: `calc(50% + ${Math.sin(angulo) * 88}px - 1.1rem)`,
                  animationDelay: `${150 + i * 60}ms`,
                }}
              >
                {e}
              </span>
            );
          })}
        </div>
        <div className="text-center">
          <h1 className="text-4xl font-bold leading-[1.05]">
            Tu despensa,
            <br />
            <span className="text-nopal">a la medida</span> de tu familia
          </h1>
          <p className="mt-3 text-lg text-suave">Dinos quiénes son y cuánto quieren gastar. Nosotros armamos la lista.</p>
        </div>
        <ul className="flex flex-col gap-3">
          {VENTAJAS.map(([emoji, fondo, titulo, texto], i) => (
            <li key={titulo} className="flex animate-aparecer items-center gap-3" style={{ animationDelay: `${300 + i * 90}ms` }}>
              <Burbuja emoji={emoji} fondo={fondo} />
              <p className="leading-snug">
                <span className="font-semibold">{titulo}.</span> <span className="text-suave">{texto}</span>
              </p>
            </li>
          ))}
        </ul>
      </div>
      <Link
        to="/hogar"
        className="mb-2 flex min-h-14 items-center justify-center rounded-2xl bg-nopal font-titulo text-xl font-semibold text-white shadow-boton active:translate-y-1 active:shadow-none"
      >
        Empezar
      </Link>
      <p className="text-center text-xs text-suave">Toma 1 minuto · tus datos se quedan en este teléfono</p>
    </main>
  );
}
