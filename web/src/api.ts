import type { Ajustes, Alternativa, Opciones, Perfil, Plan, ProductoResumen, TiendaComparada } from "./tipos";

const TIEMPO_LIMITE_MS = 30_000;

export class ErrorApi extends Error {
  constructor(mensaje: string, readonly estado: number | null) {
    super(mensaje);
  }
}

async function pedir<T>(ruta: string, cuerpo?: unknown): Promise<T> {
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), TIEMPO_LIMITE_MS);
  let respuesta: Response;
  try {
    respuesta = await fetch(ruta, {
      method: cuerpo === undefined ? "GET" : "POST",
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      headers: { "Content-Type": "application/json" },
      signal: control.signal,
    });
  } catch {
    throw new ErrorApi(
      navigator.onLine
        ? "No pudimos conectar con el servidor. Intenta de nuevo en un momento."
        : "Estás sin conexión. Tu última lista sigue disponible.",
      null,
    );
  } finally {
    clearTimeout(temporizador);
  }

  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    const detalle = typeof datos?.detail === "string" ? datos.detail : "Ocurrió un error inesperado.";
    throw new ErrorApi(detalle, respuesta.status);
  }
  return datos as T;
}

export const api = {
  opciones: () => pedir<Opciones>("/api/opciones"),
  plan: (perfil: Perfil, ajustes: Ajustes) => pedir<Plan>("/api/plan", { perfil, ajustes }),
  buscar: (perfil: Perfil, texto: string) =>
    pedir<{ resultados: ProductoResumen[] }>("/api/buscar", { perfil, texto }).then((r) => r.resultados),
  alternativas: (perfil: Perfil, producto_id: string, paquetes: number) =>
    pedir<{ alternativas: Alternativa[] }>("/api/alternativas", { perfil, producto_id, paquetes }).then(
      (r) => r.alternativas,
    ),
  comparar: (perfil: Perfil, ajustes: Ajustes) =>
    pedir<{ tiendas: TiendaComparada[] }>("/api/comparar", { perfil, ajustes }).then((r) => r.tiendas),
  reportarPrecio: (producto_id: string, precio_reportado: number, sucursal: string) =>
    pedir<{ ok: true }>("/api/reporte", { tipo: "precio", producto_id, precio_reportado, sucursal }),
  reportarTicket: (tienda: string, total_estimado: number, total_real: number) =>
    pedir<{ ok: true }>("/api/reporte", { tipo: "ticket", tienda, total_estimado, total_real }),
  comentar: (comentario: string) => pedir<{ ok: true }>("/api/reporte", { tipo: "comentario", comentario }),
};
