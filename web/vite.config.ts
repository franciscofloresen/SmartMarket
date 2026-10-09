import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// En desarrollo, /api se reenvía al servidor FastAPI local; así el iPhone en la misma
// red solo necesita abrir http://<ip-de-la-mac>:5173.
const API_DEV = process.env.API_DEV ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icono.svg", "apple-touch-icon.png"],
      manifest: {
        name: "SmartMarket · Despensa inteligente",
        short_name: "SmartMarket",
        description: "Tu despensa del mes, ajustada a tu familia y tu presupuesto.",
        lang: "es-MX",
        start_url: "/",
        display: "standalone",
        background_color: "#f6f7f4",
        theme_color: "#15803d",
        icons: [
          { src: "icono-192.png", sizes: "192x192", type: "image/png" },
          { src: "icono-512.png", sizes: "512x512", type: "image/png" },
          { src: "icono-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // La app abre sin conexión (útil dentro de la tienda); la API siempre va a la red.
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  server: { proxy: { "/api": API_DEV } },
  preview: { proxy: { "/api": API_DEV } },
});
