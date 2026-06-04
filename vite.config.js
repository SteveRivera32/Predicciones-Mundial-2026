import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Producción: quiniela en /PrediccionesMundial/, landing en / (public/).
 * Desarrollo: base / para que localhost:5173/ y /PrediccionesMundial/ funcionen.
 */
const allowedHosts = [
  "tivotabo.com",
  "www.tivotabo.com",
  ".tivotabo.com",
  "168.228.192.202",
];

/** @type {import('vite').Plugin} */
function quinielaDevFallback() {
  return {
    name: "quiniela-dev-fallback",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (url === "/" || url === "") {
          req.url = "/index.html";
        } else if (url === "/PrediccionesMundial" || url === "/PrediccionesMundial/") {
          req.url = "/PrediccionesMundial/index.html";
        }
        next();
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/PrediccionesMundial/" : "/",
  plugins: command === "serve" ? [quinielaDevFallback()] : [],
  build: {
    rollupOptions: {
      input: path.resolve(__dirname, "PrediccionesMundial/index.html"),
      output: {
        entryFileNames: "PrediccionesMundial/assets/[name]-[hash].js",
        chunkFileNames: "PrediccionesMundial/assets/[name]-[hash].js",
        assetFileNames: "PrediccionesMundial/assets/[name]-[hash][extname]",
      },
    },
  },
  server: {
    port: 5173,
    host: true,
    allowedHosts,
    open: "/",
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
  preview: {
    host: true,
    allowedHosts,
  },
}));
