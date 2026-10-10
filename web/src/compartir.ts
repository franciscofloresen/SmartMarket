import { dinero, nombrePeriodo, partirNombre } from "./formato";
import { agruparPorDepartamento } from "./iconos";
import type { Perfil, Plan } from "./tipos";

/** La lista como texto para WhatsApp: por pasillo, con negritas de WhatsApp (*así*). */
export function textoDeLista(plan: Plan, hogar: Perfil): string {
  const lineas = [`🛒 *Despensa para ${nombrePeriodo(hogar.periodo_dias)}* · ${plan.catalogo.tienda}`, ""];
  for (const [depto, productos] of agruparPorDepartamento(plan.lineas)) {
    lineas.push(`${depto.emoji} *${depto.nombre}*`);
    for (const p of productos) {
      const { titulo, detalle } = partirNombre(p.nombre);
      lineas.push(`▫️ ${p.paquetes} × ${titulo}${detalle ? ` (${detalle})` : ""}`);
    }
    lineas.push("");
  }
  lineas.push(`Total estimado: *${dinero(plan.total)}*`, "Hecho con SmartMarket");
  return lineas.join("\n");
}

/** Abre el menú de compartir del teléfono; si no existe, copia la lista o abre WhatsApp. */
export async function compartirLista(plan: Plan, hogar: Perfil): Promise<"compartido" | "copiado" | "cancelado"> {
  const texto = textoDeLista(plan, hogar);
  if (navigator.share) {
    try {
      await navigator.share({ text: texto });
      return "compartido";
    } catch (e) {
      // AbortError: el usuario cerró el menú. Cualquier otro error cae a las alternativas.
      if (e instanceof DOMException && e.name === "AbortError") return "cancelado";
    }
  }
  try {
    await navigator.clipboard.writeText(texto);
    return "copiado";
  } catch {
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
    return "compartido";
  }
}
