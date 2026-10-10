/** @type {import('tailwindcss').Config} */
// Los colores semánticos (fondo, tarjeta, tinta...) salen de variables CSS que cambian con
// el modo claro/oscuro en index.css; así los componentes no repiten variantes "dark:".
const v = (nombre) => `rgb(var(--${nombre}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        fondo: v("fondo"),
        tarjeta: v("tarjeta"),
        hundido: v("hundido"),
        linea: v("linea"),
        tinta: v("tinta"),
        suave: v("suave"),
        // Texto encima de un color sólido (botones, insignias).
        sobre: v("sobre"),
        nopal: { DEFAULT: v("nopal"), fuerte: v("nopal-fuerte"), tenue: v("nopal-tenue") },
        maiz: { DEFAULT: v("maiz"), tenue: v("maiz-tenue") },
        rosa: { DEFAULT: v("rosa"), tenue: v("rosa-tenue") },
        papaya: { DEFAULT: v("papaya"), tenue: v("papaya-tenue") },
        cielo: { DEFAULT: v("cielo"), tenue: v("cielo-tenue") },
        uva: { DEFAULT: v("uva"), tenue: v("uva-tenue") },
      },
      fontFamily: {
        titulo: ['"Baloo 2 Variable"', "ui-rounded", "system-ui", "sans-serif"],
      },
      boxShadow: {
        // Sombra "sólida" que da sensación de botón físico.
        boton: "0 3px 0 0 rgb(var(--nopal-fuerte))",
        suave: "0 1px 2px 0 rgb(var(--sombra) / 0.05), 0 10px 24px -14px rgb(var(--sombra) / 0.18)",
      },
      keyframes: {
        aparecer: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "none" } },
        subir: { from: { transform: "translateY(100%)" }, to: { transform: "none" } },
        desvanecer: { from: { opacity: "0" }, to: { opacity: "1" } },
        rebote: { "0%": { transform: "scale(0.6)" }, "60%": { transform: "scale(1.15)" }, "100%": { transform: "scale(1)" } },
        confeti: {
          "0%": { transform: "translate3d(0,0,0) rotate(0)", opacity: "1" },
          "100%": { transform: "translate3d(var(--dx), 105vh, 0) rotate(var(--giro))", opacity: "0.9" },
        },
      },
      animation: {
        aparecer: "aparecer 240ms cubic-bezier(0.22, 1, 0.36, 1) both",
        subir: "subir 280ms cubic-bezier(0.22, 1, 0.36, 1) both",
        desvanecer: "desvanecer 180ms ease-out both",
        rebote: "rebote 320ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
        confeti: "confeti var(--duracion) cubic-bezier(0.2, 0.6, 0.4, 1) var(--espera) both",
      },
    },
  },
  plugins: [],
};
