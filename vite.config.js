import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": "http://127.0.0.1:8787",
      // /ws: el cliente en dev usa sync directo a hostname:8787 (ver src/sync.js)
    },
  },
});
