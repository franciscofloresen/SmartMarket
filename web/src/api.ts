import type { Ajustes, Opciones, Perfil, Plan } from "./tipos";

const TIEMPO_LIMITE_MS = 20_000;

export class ErrorApi extends Error {
  constructor(mensaje: string, readonly estado: number | null) {
    super(mensaje);
  }
}

async function pedir<T>(ruta: string, init?: RequestInit): Promise<T> {
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), TIEMPO_LIMITE_MS);
  let respuesta: Response;
  try {
    respuesta = await fetch(ruta, {
      ...init,
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

  const cuerpo = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    const detalle = typeof cuerpo?.detail === "string" ? cuerpo.detail : "Ocurrió un error inesperado.";
    throw new ErrorApi(detalle, respuesta.status);
  }
  return cuerpo as T;
}

export const api = {
  opciones: () => pedir<Opciones>("/api/opciones"),
  plan: (perfil: Perfil, ajustes: Ajustes) =>
    pedir<Plan>("/api/plan", { method: "POST", body: JSON.stringify({ perfil, ajustes }) }),
  reportarPrecio: (producto_id: string, precio_reportado: number, sucursal: string) =>
    pedir<{ ok: true }>("/api/reporte", {
      method: "POST",
      body: JSON.stringify({ tipo: "precio", producto_id, precio_reportado, sucursal }),
    }),
  comentar: (comentario: string) =>
    pedir<{ ok: true }>("/api/reporte", { method: "POST", body: JSON.stringify({ tipo: "comentario", comentario }) }),
};
