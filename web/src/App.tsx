import { HashRouter, NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ProveedorEstado, useApp } from "./estado";
import Compra from "./pantallas/Compra";
import Hogar from "./pantallas/Hogar";
import Inicio from "./pantallas/Inicio";
import Lista from "./pantallas/Lista";
import Mas from "./pantallas/Mas";

// HashRouter: las rutas viven después de "#", así el servidor solo necesita servir index.html.
export default function App() {
  return (
    <ProveedorEstado>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/hogar" element={<Hogar />} />
          <Route path="/lista" element={<Lista />} />
          <Route path="/compra" element={<Compra />} />
          <Route path="/mas" element={<Mas />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <BarraInferior />
      </HashRouter>
    </ProveedorEstado>
  );
}

const PESTANAS = [
  { ruta: "/lista", texto: "Lista", icono: "📝" },
  { ruta: "/compra", texto: "Compra", icono: "🛒" },
  { ruta: "/mas", texto: "Más", icono: "⚙️" },
];

function BarraInferior() {
  const { datos } = useApp();
  const { pathname } = useLocation();
  if (!datos.hogar || !PESTANAS.some((p) => p.ruta === pathname)) return null;

  return (
    <nav
      aria-label="Secciones"
      className="pb-seguro fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur dark:border-stone-800 dark:bg-stone-900/95"
    >
      <ul className="mx-auto flex max-w-lg">
        {PESTANAS.map((p) => (
          <li key={p.ruta} className="flex-1">
            <NavLink
              to={p.ruta}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
                  isActive ? "text-marca-700 dark:text-marca-500" : "text-stone-500 dark:text-stone-400"
                }`
              }
            >
              <span className="text-xl" aria-hidden="true">
                {p.icono}
              </span>
              {p.texto}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
