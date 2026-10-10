import { HashRouter, NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ProveedorEstado, useApp } from "./estado";
import Bienvenida from "./pantallas/Bienvenida";
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
          <Route path="/" element={<Bienvenida />} />
          <Route path="/inicio" element={<Inicio />} />
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
  { ruta: "/inicio", texto: "Inicio", icono: "🏡" },
  { ruta: "/lista", texto: "Lista", icono: "📝" },
  { ruta: "/compra", texto: "Compra", icono: "🛒" },
  { ruta: "/mas", texto: "Más", icono: "⚙️" },
];

function BarraInferior() {
  const { datos } = useApp();
  const { pathname } = useLocation();
  if (!datos.hogar || !PESTANAS.some((p) => p.ruta === pathname)) return null;
  const pendientes = datos.plan ? datos.plan.lineas.length - datos.comprados.length : 0;

  return (
    <nav aria-label="Secciones" className="pb-seguro fixed inset-x-0 bottom-0 z-30 border-t border-linea bg-tarjeta/95 backdrop-blur">
      <ul className="mx-auto flex max-w-lg">
        {PESTANAS.map((p) => (
          <li key={p.ruta} className="flex-1">
            <NavLink
              to={p.ruta}
              className={({ isActive }) =>
                `relative flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-colors ${
                  isActive ? "text-nopal" : "text-suave"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`flex h-8 w-14 items-center justify-center rounded-full text-xl transition-colors ${isActive ? "bg-nopal-tenue" : ""}`} aria-hidden="true">
                    {p.icono}
                  </span>
                  {p.texto}
                  {p.ruta === "/compra" && datos.comprados.length > 0 && pendientes > 0 && (
                    <span className="tabular absolute right-[calc(50%-1.9rem)] top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rosa px-1 text-[11px] font-bold text-sobre">
                      {pendientes}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
