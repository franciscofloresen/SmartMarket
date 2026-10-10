const PESOS = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const PESOS_ENTEROS = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

export const dinero = (valor: number) => PESOS.format(valor);
export const dineroEntero = (valor: number) => PESOS_ENTEROS.format(valor);

export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return "";
  const fecha = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return fecha.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

export const cantidad = (n: number) => (n >= 10 ? Math.round(n).toString() : n.toFixed(1).replace(/\.0$/, ""));

/** "Frijol Great Value · Bolsa 900 g, negro" -> título y detalle por separado. */
export function partirNombre(nombre: string): { titulo: string; detalle: string } {
  const [titulo, ...resto] = nombre.split(" · ");
  return { titulo, detalle: resto.join(" · ") };
}

/** ¿La tienda tiene sucursales en el estado? Sin estado, o sin datos de presencia, se asume que sí. */
export function hayTiendaEn(tienda: { presencia?: string[] }, estado: string | null): boolean {
  return !estado || !tienda.presencia?.length || tienda.presencia.includes(estado);
}

export function nombrePeriodo(dias: number): string {
  return dias === 30 ? "el mes" : dias === 15 ? "la quincena" : dias === 7 ? "la semana" : `${dias} días`;
}
