const PESOS = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const PESOS_ENTEROS = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

export const dinero = (valor: number) => PESOS.format(valor);
export const dineroEntero = (valor: number) => PESOS_ENTEROS.format(valor);

export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return "";
  const fecha = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return fecha.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

// Orden aproximado de recorrido en tienda: frescos primero, limpieza y mascotas al final.
export const DEPARTAMENTOS: [string, string][] = [
  ["frutas_verduras", "Frutas y verduras"],
  ["carnes", "Carnes y aves"],
  ["lacteos_huevo", "Lácteos y huevo"],
  ["panaderia_tortilleria", "Panadería y tortillería"],
  ["despensa", "Despensa"],
  ["congelados", "Congelados"],
  ["bebidas", "Bebidas"],
  ["limpieza", "Limpieza"],
  ["higiene", "Higiene personal"],
  ["bebe", "Bebé"],
  ["mascotas", "Mascotas"],
];

export function agruparPorDepartamento<T extends { departamento: string }>(items: T[]): [string, T[]][] {
  const grupos = new Map<string, T[]>();
  for (const item of items) {
    grupos.set(item.departamento, [...(grupos.get(item.departamento) ?? []), item]);
  }
  const conocidos = DEPARTAMENTOS.filter(([clave]) => grupos.has(clave)).map(
    ([clave, nombre]) => [nombre, grupos.get(clave)!] as [string, T[]],
  );
  const otros = [...grupos.keys()]
    .filter((k) => !DEPARTAMENTOS.some(([clave]) => clave === k))
    .map((k) => [k, grupos.get(k)!] as [string, T[]]);
  return [...conocidos, ...otros];
}
