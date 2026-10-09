import { Link, Navigate } from "react-router-dom";
import { useApp } from "../estado";

export default function Inicio() {
  const { datos } = useApp();
  if (datos.hogar) return <Navigate to="/lista" replace />;

  return (
    <main className="pt-seguro pb-seguro mx-auto flex min-h-dvh max-w-lg flex-col px-6">
      <div className="flex flex-1 flex-col justify-center gap-8 py-10">
        <img src="/icono.svg" alt="" className="h-16 w-16" />
        <div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight">Tu despensa, a la medida de tu familia.</h1>
          <p className="mt-3 text-lg text-stone-600 dark:text-stone-300">
            Dinos quiénes son y cuánto quieres gastar. Armamos la lista de Walmart con las cantidades justas.
          </p>
        </div>
        <ul className="flex flex-col gap-3 text-stone-700 dark:text-stone-200">
          {[
            ["👨‍👩‍👧‍👦", "Cantidades según edades, mascotas y días"],
            ["🚫", "Sin alergias ni alimentos que no les gustan"],
            ["💰", "Siempre dentro de tu presupuesto, con precios de Profeco"],
          ].map(([icono, texto]) => (
            <li key={texto} className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-xl shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800" aria-hidden="true">
                {icono}
              </span>
              {texto}
            </li>
          ))}
        </ul>
      </div>
      <Link
        to="/hogar"
        className="mb-2 flex min-h-14 items-center justify-center rounded-2xl bg-marca-700 text-lg font-semibold text-white active:bg-marca-800"
      >
        Empezar
      </Link>
      <p className="text-center text-xs text-stone-500 dark:text-stone-400">Beta · tus datos se quedan en este teléfono</p>
    </main>
  );
}
