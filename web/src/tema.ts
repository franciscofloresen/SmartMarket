// Apariencia de la app. Clara por defecto; la oscura (o seguir al sistema) se elige en "Más".
export type Tema = "claro" | "oscuro" | "auto";

const CLAVE = "smartmarket:tema";
const FONDO = { claro: "#f6f7f4", oscuro: "#0f1311" };
const sistemaOscuro = window.matchMedia("(prefers-color-scheme: dark)");

export function temaGuardado(): Tema {
  try {
    const valor = localStorage.getItem(CLAVE);
    return valor === "oscuro" || valor === "auto" ? valor : "claro";
  } catch {
    return "claro";
  }
}

/** Pone el tema en <html data-tema> (lo lee index.css) y ajusta la barra del navegador. */
export function aplicarTema(tema: Tema = temaGuardado()): void {
  const efectivo = tema === "auto" ? (sistemaOscuro.matches ? "oscuro" : "claro") : tema;
  document.documentElement.dataset.tema = efectivo;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", FONDO[efectivo]);
}

export function guardarTema(tema: Tema): void {
  try {
    localStorage.setItem(CLAVE, tema);
  } catch {
    /* sin almacenamiento: el cambio dura hasta cerrar la app */
  }
  aplicarTema(tema);
}

sistemaOscuro.addEventListener("change", () => aplicarTema());
