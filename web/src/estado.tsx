import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api, ErrorApi } from "./api";
import { AJUSTES_VACIOS, borrar, cargar, guardar, VACIO, type Guardado } from "./almacen";
import type { Ajustes, Opciones, Perfil } from "./tipos";

// Respaldo por si /api/opciones no responde (p. ej. sin conexión): mismos valores que la API.
const OPCIONES_RESPALDO: Opciones = {
  catalogo: {
    tienda: "Walmart Supercenter",
    productos: 0,
    precios_verificados: 0,
    fecha_precio_mas_antigua: null,
    fecha_precio_mas_reciente: null,
  },
  alergias: [
    { clave: "pescado", nombre: "Pescado" },
    { clave: "mariscos", nombre: "Mariscos" },
    { clave: "lacteos", nombre: "Lácteos" },
    { clave: "huevo", nombre: "Huevo" },
    { clave: "gluten", nombre: "Gluten (trigo)" },
    { clave: "cacahuate", nombre: "Cacahuate" },
    { clave: "nueces", nombre: "Nueces y almendras" },
    { clave: "soya", nombre: "Soya" },
    { clave: "ajonjoli", nombre: "Ajonjolí" },
  ],
  dietas: [
    { clave: "vegetariana", nombre: "Vegetariana" },
    { clave: "pescetariana", nombre: "Pescetariana" },
    { clave: "sin_cerdo", nombre: "Sin cerdo" },
  ],
  tamanos_perro: [
    { clave: "chico", nombre: "Chico (hasta 10 kg)" },
    { clave: "mediano", nombre: "Mediano (10 a 25 kg)" },
    { clave: "grande", nombre: "Grande (25 a 45 kg)" },
    { clave: "gigante", nombre: "Gigante (más de 45 kg)" },
  ],
  periodo_dias: { min: 1, max: 62, default: 30 },
};

interface ContextoApp {
  datos: Guardado;
  opciones: Opciones;
  cargando: boolean;
  error: string | null;
  limpiarError: () => void;
  /** Guarda el hogar (nuevo o editado) y genera una lista desde cero. */
  guardarHogar: (perfil: Perfil) => Promise<boolean>;
  /** Recalcula con cambios del usuario; solo los conserva si el cálculo funciona. */
  aplicarAjustes: (ajustes: Ajustes) => Promise<boolean>;
  regenerar: () => Promise<boolean>;
  alternarComprado: (id: string) => void;
  reiniciarCompra: () => void;
  restaurar: (datos: Guardado) => void;
  borrarTodo: () => void;
}

const Contexto = createContext<ContextoApp | null>(null);

export function ProveedorEstado({ children }: { children: ReactNode }) {
  const [datos, setDatos] = useState<Guardado>(cargar);
  const [opciones, setOpciones] = useState<Opciones>(OPCIONES_RESPALDO);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Si el usuario hace cambios rápidos, solo cuenta la respuesta de la última petición.
  const ultimaPeticion = useRef(0);

  useEffect(() => guardar(datos), [datos]);

  useEffect(() => {
    api.opciones().then(setOpciones).catch(() => {
      /* se queda con el respaldo */
    });
  }, []);

  const generar = useCallback(async (hogar: Perfil, ajustes: Ajustes, reiniciarCompra: boolean) => {
    const id = ++ultimaPeticion.current;
    setCargando(true);
    setError(null);
    try {
      const plan = await api.plan(hogar, ajustes);
      if (id !== ultimaPeticion.current) return false;
      const ids = new Set(plan.lineas.map((l) => l.id));
      setDatos((d) => ({
        hogar,
        ajustes,
        plan,
        planGeneradoEn: new Date().toISOString(),
        comprados: reiniciarCompra ? [] : d.comprados.filter((c) => ids.has(c)),
      }));
      return true;
    } catch (e) {
      if (id === ultimaPeticion.current) {
        setError(e instanceof ErrorApi ? e.message : "Ocurrió un error inesperado.");
      }
      return false;
    } finally {
      if (id === ultimaPeticion.current) setCargando(false);
    }
  }, []);

  const valor: ContextoApp = {
    datos,
    opciones,
    cargando,
    error,
    limpiarError: () => setError(null),
    guardarHogar: (perfil) => generar(perfil, AJUSTES_VACIOS, true),
    aplicarAjustes: (ajustes) => (datos.hogar ? generar(datos.hogar, ajustes, false) : Promise.resolve(false)),
    regenerar: () => (datos.hogar ? generar(datos.hogar, datos.ajustes, false) : Promise.resolve(false)),
    alternarComprado: (id) =>
      setDatos((d) => ({
        ...d,
        comprados: d.comprados.includes(id) ? d.comprados.filter((c) => c !== id) : [...d.comprados, id],
      })),
    reiniciarCompra: () => setDatos((d) => ({ ...d, comprados: [] })),
    restaurar: (nuevos) => setDatos(nuevos),
    borrarTodo: () => {
      borrar();
      setDatos(VACIO);
    },
  };

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useApp(): ContextoApp {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useApp debe usarse dentro de ProveedorEstado");
  return ctx;
}
