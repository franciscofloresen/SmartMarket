import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api, ErrorApi } from "./api";
import { agregarAlHistorial, borrar, cargar, guardar, VACIO, type Guardado } from "./almacen";
import type { Ajustes, CompraPasada, Opciones, Perfil } from "./tipos";

// Respaldo por si /api/opciones no responde (p. ej. sin conexión): mismos valores que la API.
const OPCIONES_RESPALDO: Opciones = {
  catalogo: {
    clave: "walmart",
    tienda: "Walmart",
    estado: null,
    productos: 0,
    precios_verificados: 0,
    fecha_precio_mas_antigua: null,
    fecha_precio_mas_reciente: null,
  },
  tiendas: [
    { clave: "walmart", nombre: "Walmart", productos: 0, estados: [] },
    { clave: "bodega_aurrera", nombre: "Bodega Aurrerá", productos: 0, estados: [] },
    { clave: "soriana", nombre: "Soriana", productos: 0, estados: [] },
    { clave: "chedraui", nombre: "Chedraui", productos: 0, estados: [] },
    { clave: "la_comer", nombre: "La Comer", productos: 0, estados: [] },
    { clave: "heb", nombre: "H-E-B", productos: 0, estados: [] },
  ],
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
  niveles: [
    { clave: "ahorro", nombre: "Ahorro" },
    { clave: "equilibrado", nombre: "Equilibrado" },
    { clave: "premium", nombre: "Marcas líderes" },
  ],
  necesidades: [],
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
  /** Guarda el hogar (nuevo o editado) y genera una lista nueva, respetando los gustos guardados. */
  guardarHogar: (perfil: Perfil) => Promise<boolean>;
  /** Recalcula con cambios del usuario; solo los conserva si el cálculo funciona. */
  aplicarAjustes: (ajustes: Ajustes) => Promise<boolean>;
  /** Quita un producto y lo recuerda para no sugerirlo en listas futuras. */
  quitarProducto: (id: string) => Promise<boolean>;
  restaurarProducto: (id: string) => Promise<boolean>;
  /** Cambia de tienda conservando hogar y gustos. */
  cambiarTienda: (tienda: string) => Promise<boolean>;
  regenerar: () => Promise<boolean>;
  alternarComprado: (id: string) => void;
  reiniciarCompra: () => void;
  /** Cierra la compra actual y la manda al historial. */
  terminarCompra: (totalReal: number | null) => void;
  olvidarGustos: () => void;
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

  const generar = useCallback(
    async (hogar: Perfil, ajustes: Ajustes, opcionesDeGuardado: { reiniciarCompra?: boolean; noMeGusta?: string[] } = {}) => {
      const id = ++ultimaPeticion.current;
      setCargando(true);
      setError(null);
      try {
        const plan = await api.plan(hogar, ajustes);
        if (id !== ultimaPeticion.current) return false;
        const ids = new Set(plan.lineas.map((l) => l.id));
        setDatos((d) => ({
          ...d,
          hogar,
          ajustes,
          plan,
          planGeneradoEn: new Date().toISOString(),
          comprados: opcionesDeGuardado.reiniciarCompra ? [] : d.comprados.filter((c) => ids.has(c)),
          noMeGusta: opcionesDeGuardado.noMeGusta ?? d.noMeGusta,
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
    },
    [],
  );

  const sinFijar = (fijar: Record<string, number>, id: string) => {
    const { [id]: _quitado, ...resto } = fijar;
    return resto;
  };

  const valor: ContextoApp = {
    datos,
    opciones,
    cargando,
    error,
    limpiarError: () => setError(null),
    guardarHogar: (perfil) =>
      // Lista nueva: sin cantidades fijadas, pero conservando gustos y lo que hay en casa.
      generar(perfil, { excluir_productos: datos.noMeGusta, fijar: {}, en_casa: datos.ajustes.en_casa }, { reiniciarCompra: true }),
    aplicarAjustes: (ajustes) => (datos.hogar ? generar(datos.hogar, ajustes) : Promise.resolve(false)),
    quitarProducto: (id) => {
      if (!datos.hogar) return Promise.resolve(false);
      const noMeGusta = datos.noMeGusta.includes(id) ? datos.noMeGusta : [...datos.noMeGusta, id];
      const ajustes = {
        ...datos.ajustes,
        excluir_productos: [...new Set([...datos.ajustes.excluir_productos, id])],
        fijar: sinFijar(datos.ajustes.fijar, id),
      };
      return generar(datos.hogar, ajustes, { noMeGusta });
    },
    restaurarProducto: (id) => {
      if (!datos.hogar) return Promise.resolve(false);
      const ajustes = { ...datos.ajustes, excluir_productos: datos.ajustes.excluir_productos.filter((x) => x !== id) };
      return generar(datos.hogar, ajustes, { noMeGusta: datos.noMeGusta.filter((x) => x !== id) });
    },
    cambiarTienda: (tienda) =>
      datos.hogar
        ? // En otra tienda los productos fijados pueden no existir: se sueltan.
          generar({ ...datos.hogar, tienda }, { ...datos.ajustes, fijar: {} }, { reiniciarCompra: true })
        : Promise.resolve(false),
    regenerar: () => (datos.hogar ? generar(datos.hogar, datos.ajustes) : Promise.resolve(false)),
    alternarComprado: (id) =>
      setDatos((d) => ({
        ...d,
        comprados: d.comprados.includes(id) ? d.comprados.filter((c) => c !== id) : [...d.comprados, id],
      })),
    reiniciarCompra: () => setDatos((d) => ({ ...d, comprados: [] })),
    terminarCompra: (totalReal) =>
      setDatos((d) => {
        if (!d.plan) return d;
        const compra: CompraPasada = {
          fecha: new Date().toISOString(),
          tienda: d.plan.catalogo.tienda,
          productos: d.plan.lineas.length,
          total_estimado: d.plan.total,
          total_real: totalReal,
        };
        return { ...d, comprados: [], historial: agregarAlHistorial(d.historial, compra) };
      }),
    olvidarGustos: () => setDatos((d) => ({ ...d, noMeGusta: [] })),
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
