// Tipos que reflejan la API (api/app.py). Si cambias la API, actualiza aquí.

export type Sexo = "F" | "M";
export type TipoMascota = "perro" | "gato";
export type TamanoPerro = "chico" | "mediano" | "grande" | "gigante";
export type Nivel = "ahorro" | "equilibrado" | "premium";

export interface Miembro {
  edad: number;
  sexo: Sexo | null;
  nombre: string;
}

export interface Mascota {
  tipo: TipoMascota;
  tamano: TamanoPerro;
  nombre: string;
}

export interface Perfil {
  nombre: string;
  presupuesto: number;
  periodo_dias: number;
  miembros: Miembro[];
  mascotas: Mascota[];
  alergias: string[];
  excluir: string[];
  dieta: string | null;
  tortillas_caseras: boolean;
  tienda: string;
  estado: string | null;
  nivel: Nivel;
}

export interface Ajustes {
  excluir_productos: string[];
  fijar: Record<string, number>;
  /** necesidad -> fracción que ya hay en casa (0 a 1) */
  en_casa: Record<string, number>;
}

export interface Linea {
  id: string;
  nombre: string;
  departamento: string;
  necesidad: string;
  tipo: string;
  nivel: string;
  contenido: number;
  unidad: string;
  paquetes: number;
  precio_unitario: number;
  subtotal: number;
  visitas: number;
  fijado: boolean;
  fuente_precio: string;
  fecha_precio: string;
}

export interface Cobertura {
  clave: string;
  nombre: string;
  unidad: string;
  prioridad: 1 | 2 | 3;
  requerido: number;
  cubierto: number;
  porcentaje: number;
  explicacion: string;
  en_casa: number;
}

export interface InfoCatalogo {
  clave: string;
  tienda: string;
  estado: string | null;
  productos: number;
  precios_verificados: number;
  fecha_precio_mas_antigua: string | null;
  fecha_precio_mas_reciente: string | null;
}

export interface Plan {
  presupuesto: number;
  total: number;
  sobrante: number;
  lineas: Linea[];
  cobertura: Cobertura[];
  excluidos: { id: string; nombre: string; motivo: string }[];
  notas: string[];
  consejos: string[];
  costo_completo: number | null;
  catalogo: InfoCatalogo;
}

export interface Opcion {
  clave: string;
  nombre: string;
}

export interface Tienda extends Opcion {
  productos: number;
  estados: string[];
}

export interface Opciones {
  catalogo: InfoCatalogo;
  tiendas: Tienda[];
  alergias: Opcion[];
  dietas: Opcion[];
  niveles: Opcion[];
  necesidades: Opcion[];
  tamanos_perro: Opcion[];
  periodo_dias: { min: number; max: number; default: number };
  /** true si el servidor tiene configurada la IA */
  ia?: boolean;
}

export interface ProductoResumen {
  id: string;
  nombre: string;
  departamento: string;
  necesidad: string;
  categoria: string;
  tipo: string;
  nivel: string;
  contenido: number;
  unidad: string;
  precio: number;
  precio_por_unidad: number;
  fuente_precio: string;
  compatible: boolean;
  motivo: string | null;
}

export interface Alternativa extends ProductoResumen {
  paquetes_equivalentes: number;
  diferencia: number;
  mismo_tipo: boolean;
}

export interface TiendaComparada {
  clave: string;
  tienda: string;
  total: number;
  productos: number;
  cobertura_completa: boolean;
  cobertura_esencial_minima: number;
  actual: boolean;
}

/** Una compra terminada, para el historial. */
export interface CompraPasada {
  fecha: string; // ISO
  tienda: string;
  productos: number;
  total_estimado: number;
  total_real: number | null;
}
