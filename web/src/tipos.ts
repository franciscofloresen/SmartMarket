// Tipos que reflejan la API (api/app.py). Si cambias la API, actualiza aquí.

export type Sexo = "F" | "M";
export type TipoMascota = "perro" | "gato";
export type TamanoPerro = "chico" | "mediano" | "grande" | "gigante";

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
}

export interface Ajustes {
  excluir_productos: string[];
  fijar: Record<string, number>;
}

export interface Linea {
  id: string;
  nombre: string;
  departamento: string;
  necesidad: string;
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
}

export interface InfoCatalogo {
  tienda: string;
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
  catalogo: InfoCatalogo;
}

export interface Opcion {
  clave: string;
  nombre: string;
}

export interface Opciones {
  catalogo: InfoCatalogo;
  alergias: Opcion[];
  dietas: Opcion[];
  tamanos_perro: Opcion[];
  periodo_dias: { min: number; max: number; default: number };
}
