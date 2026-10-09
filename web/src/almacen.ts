// Persistencia local: todo lo del hogar vive solo en este dispositivo.
import type { Ajustes, Perfil, Plan } from "./tipos";

const CLAVE = "smartmarket:v1";

export interface Guardado {
  hogar: Perfil | null;
  ajustes: Ajustes;
  plan: Plan | null;
  planGeneradoEn: string | null; // ISO
  comprados: string[]; // ids marcados en modo compra
}

export const AJUSTES_VACIOS: Ajustes = { excluir_productos: [], fijar: {} };

export const VACIO: Guardado = {
  hogar: null,
  ajustes: AJUSTES_VACIOS,
  plan: null,
  planGeneradoEn: null,
  comprados: [],
};

export function cargar(): Guardado {
  try {
    const crudo = localStorage.getItem(CLAVE);
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
  } catch {
    /* sin almacenamiento */
  }
}

/** Acepta datos de versiones anteriores o de un respaldo y rellena lo que falte. */
export function normalizar(datos: unknown): Guardado {
  if (!datos || typeof datos !== "object") throw new Error("Respaldo inválido");
  const d = datos as Partial<Guardado>;
  return {
    hogar: d.hogar ?? null,
    ajustes: {
      excluir_productos: d.ajustes?.excluir_productos ?? [],
      fijar: d.ajustes?.fijar ?? {},
    },
    plan: d.plan ?? null,
    planGeneradoEn: d.planGeneradoEn ?? null,
    comprados: d.comprados ?? [],
  };
}
