import { initApp, finishBootstrap } from "./app.js";
import { initRemoteSync, startRemoteSyncCatchup } from "./sync.js";
import { setAppBootLoaderHint, dismissAppBootLoader } from "./boot-loader.js";

async function bootstrap() {
  setAppBootLoaderHint("Preparando la quiniela…");
  try {
    initApp();
    setAppBootLoaderHint("Sincronizando con el servidor…");
    const syncOk = await initRemoteSync();
    if (syncOk) startRemoteSyncCatchup();
    setAppBootLoaderHint("Preparando la interfaz…");
    finishBootstrap();
  } catch (err) {
    console.error("[pm26] bootstrap", err);
    setAppBootLoaderHint("Error al cargar. Recarga la página o inténtalo de nuevo.");
    await new Promise((resolve) => window.setTimeout(resolve, 1800));
  } finally {
    dismissAppBootLoader();
  }
}

void bootstrap();
