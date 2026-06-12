import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const allowedHosts = [
  "tivotabo.com",
  "www.tivotabo.com",
  ".tivotabo.com",
  "168.228.192.202",
];

/** @type {import('vite').Plugin} */
function arenaDevFallback() {
  return {
    name: "arena-dev-fallback",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        const q = req.url?.includes("?") ? "?" + req.url.split("?").slice(1).join("?") : "";
        if (url === "/" || url === "") {
          res.statusCode = 302;
          res.setHeader("Location", `/ArenaMundial/login/${q}`);
          res.end();
          return;
        }
        if (
          url === "/ArenaMundial" ||
          url === "/ArenaMundial/" ||
          url === "/ArenaMundial/login" ||
          url === "/ArenaMundial/login/"
        ) {
          req.url = `/ArenaMundial/login/index.html${q}`;
        } else if (url === "/ArenaMundial/app" || url === "/ArenaMundial/app/") {
          req.url = `/ArenaMundial/app/index.html${q}`;
        }
        next();
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  root: __dirname,
  base: "/ArenaMundial/",
  plugins: command === "serve" ? [arenaDevFallback()] : [],
  resolve: {
    alias: {
      "@shared": path.resolve(rootDir, "src"),
    },
  },
  build: {
    outDir: path.resolve(rootDir, "dist-arena/ArenaMundial"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        login: path.resolve(__dirname, "login/index.html"),
        app: path.resolve(__dirname, "app/index.html"),
      },
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  server: {
    port: 5174,
    host: true,
    allowedHosts,
    open: "/ArenaMundial/login/index.html",
    proxy: {
      "/api/arena": {
        target: "http://127.0.0.1:8788",
        changeOrigin: true,
      },
    },
  },
}));
