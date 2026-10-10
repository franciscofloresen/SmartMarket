// Íconos (emoji) y colores por departamento y por tipo de producto.
// No hay fotos con licencia para los productos, así que cada uno se representa con un emoji.

export interface Departamento {
  clave: string;
  nombre: string;
  emoji: string;
  /** Clases completas (Tailwind no detecta nombres armados por partes). */
  fondo: string;
  texto: string;
  barra: string;
}

// En orden aproximado de recorrido en tienda: frescos primero, limpieza y mascotas al final.
export const DEPARTAMENTOS: Departamento[] = [
  { clave: "frutas_verduras", nombre: "Frutas y verduras", emoji: "🥑", fondo: "bg-nopal-tenue", texto: "text-nopal-fuerte", barra: "bg-nopal" },
  { clave: "carnes", nombre: "Carnes y aves", emoji: "🥩", fondo: "bg-rosa-tenue", texto: "text-rosa", barra: "bg-rosa" },
  { clave: "pescados", nombre: "Pescados y mariscos", emoji: "🐟", fondo: "bg-cielo-tenue", texto: "text-cielo", barra: "bg-cielo" },
  { clave: "salchichoneria", nombre: "Salchichonería", emoji: "🌭", fondo: "bg-rosa-tenue", texto: "text-rosa", barra: "bg-rosa" },
  { clave: "lacteos_huevo", nombre: "Lácteos y huevo", emoji: "🥛", fondo: "bg-maiz-tenue", texto: "text-maiz", barra: "bg-maiz" },
  { clave: "panaderia_tortilleria", nombre: "Panadería y tortillería", emoji: "🫓", fondo: "bg-papaya-tenue", texto: "text-papaya", barra: "bg-papaya" },
  { clave: "despensa", nombre: "Despensa", emoji: "🥫", fondo: "bg-uva-tenue", texto: "text-uva", barra: "bg-uva" },
  { clave: "congelados", nombre: "Congelados", emoji: "🧊", fondo: "bg-cielo-tenue", texto: "text-cielo", barra: "bg-cielo" },
  { clave: "bebidas", nombre: "Bebidas", emoji: "🧃", fondo: "bg-papaya-tenue", texto: "text-papaya", barra: "bg-papaya" },
  { clave: "limpieza", nombre: "Limpieza", emoji: "🧽", fondo: "bg-cielo-tenue", texto: "text-cielo", barra: "bg-cielo" },
  { clave: "higiene", nombre: "Higiene personal", emoji: "🧴", fondo: "bg-uva-tenue", texto: "text-uva", barra: "bg-uva" },
  { clave: "bebe", nombre: "Bebé", emoji: "🍼", fondo: "bg-rosa-tenue", texto: "text-rosa", barra: "bg-rosa" },
  { clave: "mascotas", nombre: "Mascotas", emoji: "🐾", fondo: "bg-maiz-tenue", texto: "text-maiz", barra: "bg-maiz" },
];

const OTRO: Departamento = { clave: "otros", nombre: "Otros", emoji: "🛒", fondo: "bg-hundido", texto: "text-suave", barra: "bg-suave" };

export const departamento = (clave: string): Departamento => DEPARTAMENTOS.find((d) => d.clave === clave) ?? OTRO;

export function agruparPorDepartamento<T extends { departamento: string }>(items: T[]): [Departamento, T[]][] {
  const grupos = new Map<string, T[]>();
  for (const item of items) grupos.set(item.departamento, [...(grupos.get(item.departamento) ?? []), item]);
  const orden = [...DEPARTAMENTOS.map((d) => d.clave), ...grupos.keys()];
  return [...new Set(orden)].filter((k) => grupos.has(k)).map((k) => [departamento(k), grupos.get(k)!]);
}

// Primera coincidencia gana: de lo más específico a lo más general.
const POR_PALABRA: [RegExp, string][] = [
  [/pollo/, "🍗"], [/pavo/, "🦃"], [/tocino/, "🥓"], [/salchicha/, "🌭"], [/jamon|mortadela|queso de puerco/, "🍖"],
  [/chorizo|longaniza/, "🌭"], [/\bres\b|ternera|cerdo/, "🥩"], [/camaron|langost/, "🦐"], [/pulpo|calamar/, "🦑"],
  [/almeja|jaiba|callo/, "🦀"], [/atun|sardina|pescado|tilapia|mojarra|salmon|basa|surimi/, "🐟"],
  [/huevo/, "🥚"], [/mantequilla|margarina|manteca/, "🧈"], [/queso/, "🧀"], [/yogur|yoghurt/, "🥣"],
  [/helado/, "🍨"], [/leche|lacteo|crema\b|bebida de (almendra|soya|avena)/, "🥛"],
  [/frijol|lenteja|garbanzo|haba|alubia|soya/, "🫘"], [/arroz/, "🍚"], [/pasta|fideo|spaghetti/, "🍝"],
  [/hot cakes/, "🥞"], [/avena|cereal|granola/, "🥣"], [/tostada/, "🌮"], [/tortilla|harina de maiz/, "🫓"],
  [/pan dulce|pastel/, "🧁"], [/\bpan\b|bolillo/, "🍞"],
  [/platano/, "🍌"], [/manzana|peron/, "🍎"], [/naranja|mandarina|toronja/, "🍊"], [/limon|\blima\b/, "🍋"],
  [/sandia/, "🍉"], [/pina/, "🍍"], [/melon/, "🍈"], [/mango|papaya|mamey/, "🥭"], [/uva/, "🍇"], [/fresa/, "🍓"],
  [/pera/, "🍐"], [/durazno|ciruela/, "🍑"], [/kiwi/, "🥝"], [/guayaba|tuna|granada|guanabana/, "🍏"],
  [/aguacate/, "🥑"], [/jitomate|tomate|catsup/, "🍅"], [/cebolla/, "🧅"], [/\bajo\b/, "🧄"], [/papas? fritas|botana|frituras/, "🍟"],
  [/papa/, "🥔"], [/zanahoria/, "🥕"], [/chile|picante/, "🌶️"], [/brocoli|coliflor|mezcla|combinado|guarnicion/, "🥦"],
  [/lechuga|espinaca|acelga|\bcol\b|cilantro|verdolaga|apio|romerito/, "🥬"], [/pepino|calabac|chayote/, "🥒"],
  [/palomero|palomitas/, "🍿"], [/elote|maiz/, "🌽"], [/champinon/, "🍄"], [/pimiento/, "🫑"], [/nopal/, "🌵"],
  [/ejote|chicharo|betabel|rabano|jicama|alcachofa/, "🥗"],
  [/oliva|aceituna/, "🫒"], [/aceite/, "🫙"], [/miel|mermelada|cajeta/, "🍯"], [/cacahuate|nuez|almendra|avellana|girasol/, "🥜"],
  [/azucar|endulzante/, "🍬"], [/cafe/, "☕"], [/chocolate/, "🍫"], [/\bte\b/, "🍵"], [/\bsal\b/, "🧂"],
  [/consome|mole/, "🍲"], [/pimienta|comino|oregano|laurel|canela|especia|tomillo|curcuma|vainilla/, "🌿"],
  [/galleta/, "🍪"], [/gelatina|flan/, "🍮"], [/cerveza/, "🍺"], [/alcohol/, "🥃"], [/refresco/, "🥤"],
  [/agua/, "💧"], [/jugo|bebida/, "🧃"], [/panal/, "🧷"], [/papel|servilleta|servitoalla|toallitas/, "🧻"],
  [/toallas femeninas|tampon|pantiprotector/, "🌸"], [/pasta dental|cepillo dental/, "🪥"], [/jabon/, "🧼"],
  [/bolsas/, "🗑️"], [/perro/, "🐕"], [/gato|arena/, "🐈"], [/detergente|suavizante|limpiador|cloro|blanqueador|lavatrastes|desinfectante/, "🧽"],
  [/mayonesa|mostaza|salsa|vinagre|enlatado|lata|almibar|pure/, "🥫"],
];

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const cache = new Map<string, string>();

/** Emoji que representa un producto, según su tipo y nombre; si no hay, el de su departamento. */
export function iconoProducto(p: { tipo?: string; nombre: string; departamento: string }): string {
  const clave = `${p.tipo ?? ""}|${p.nombre}`;
  let icono = cache.get(clave);
  if (!icono) {
    const texto = sinAcentos(`${p.tipo ?? ""} ${p.nombre.split("·")[0]}`);
    icono = POR_PALABRA.find(([patron]) => patron.test(texto))?.[1] ?? departamento(p.departamento).emoji;
    cache.set(clave, icono);
  }
  return icono;
}
