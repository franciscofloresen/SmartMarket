// Persistencia local: todo lo del hogar vive solo en este dispositivo.
import type { Ajustes, CompraPasada, Perfil, Plan } from "./tipos";

const CLAVE = "smartmarket:v2";
const CLAVE_ANTERIOR = "smartmarket:v1";
const MAX_HISTORIAL = 24;

export interface Guardado {
  hogar: Perfil | null;
  ajustes: Ajustes;
  plan: Plan | null;
  planGeneradoEn: string | null; // ISO
  comprados: string[]; // ids marcados en modo compra
  /** Productos que el usuario quitó alguna vez; no se vuelven a sugerir en listas nuevas. */
  noMeGusta: string[];
  historial: CompraPasada[];
}

export const AJUSTES_VACIOS: Ajustes = { excluir_productos: [], fijar: {}, en_casa: {} };

export const VACIO: Guardado = {
  hogar: null,
  ajustes: AJUSTES_VACIOS,
  plan: null,
  planGeneradoEn: null,
  comprados: [],
  noMeGusta: [],
  historial: [],
};

export function cargar(): Guardado {
  try {
    const crudo = localStorage.getItem(CLAVE) ?? localStorage.getItem(CLAVE_ANTERIOR);
    return crudo ? normalizar(JSON.parse(crudo)) : VACIO;
  } catch {
    return VACIO;
  }
}

export function guardar(estado: Guardado): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(estado));
  } catch {
    // Modo privado o almacenamiento lleno: la app sigue funcionando en memoria.
  }
}

export function borrar(): void {
  try {
    localStorage.removeItem(CLAVE);
    localStorage.removeItem(CLAVE_ANTERIOR);
  } catch {
    /* sin almacenamiento */
  }
}

/** Acepta datos de versiones anteriores o de un respaldo y rellena lo que falte. */
export function normalizar(datos: unknown): Guardado {
  if (!datos || typeof datos !== "object") throw new Error("Respaldo inválido");
  const d = datos as Partial<Guardado>;
  const hogar = d.hogar
    ? {
        ...d.hogar,
        tienda: d.hogar.tienda ?? "walmart",
        estado: d.hogar.estado ?? null,
        nivel: d.hogar.nivel ?? "equilibrado",
        antojos: d.hogar.antojos ?? [],
      }
    : null;
  // Un plan guardado con el formato anterior no trae los campos nuevos: se descarta y se regenera.
  const plan = d.plan && Array.isArray(d.plan.consejos) ? d.plan : null;
  return {
    hogar,
    ajustes: {
      excluir_productos: d.ajustes?.excluir_productos ?? [],
      fijar: plan ? (d.ajustes?.fijar ?? {}) : {},
      en_casa: d.ajustes?.en_casa ?? {},
    },
    plan,
    planGeneradoEn: plan ? (d.planGeneradoEn ?? null) : null,
    comprados: plan ? (d.comprados ?? []) : [],
    noMeGusta: d.noMeGusta ?? [],
    historial: (d.historial ?? []).slice(0, MAX_HISTORIAL),
  };
}

export function agregarAlHistorial(historial: CompraPasada[], compra: CompraPasada): CompraPasada[] {
  return [compra, ...historial].slice(0, MAX_HISTORIAL);
}
