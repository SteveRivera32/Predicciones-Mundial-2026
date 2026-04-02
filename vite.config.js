import { defineConfig } from "vite";

/**
 * Proxy de /api y /ws al proceso `npm run server` (8787).
 * Así móviles en la LAN solo abren http://TU_IP:5173 y el WebSocket también va por Vite.
 * Si el proxy WS falla en tu entorno, define VITE_WS_DIRECT=true y abre el puerto 8787 al firewall.
 */
export default defineConfig({
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
      "/ws": {
        target: "http://127.0.0.1:8787",
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
