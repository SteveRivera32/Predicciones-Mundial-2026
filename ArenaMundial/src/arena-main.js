import { requireAuthOrRedirect, LOGIN_URL } from "./auth-client.js";
import {
  logout,
  saveMyPredictions,
  saveOfficialResults,
  deleteMyAccount,
  listAdminUsers,
  searchAdminUsers,
  deleteAdminUser,
  banAdminUser,
  searchPredictions,
  listArenaBackups,
  exportArenaBackup,
  restoreArenaBackupFile,
  restoreArenaBackupUpload,
} from "./api.js";
import {
  initArenaSyncPoll,
  pullArenaSync,
  markArenaBootLiteSyncDone,
} from "./arena-sync.js";
import { setRemoteSyncActive } from "@shared/remote-sync-flags.js";
import {
  setArenaMode,
  setArenaUser,
  setArenaPushHandlers,
  setArenaLogout,
  setArenaAccountApi,
  setArenaBackupApi,
  setArenaSearchPredictions,
  bindArenaInteractionGuard,
} from "@shared/arena-mode.js";
import { saveSession } from "@shared/session.js";
import { initApp, finishBootstrap } from "@shared/app.js";
import { initArenaChat } from "./arena-chat.js";

import { setAppBootLoaderHint, dismissAppBootLoader } from "@shared/boot-loader.js";

async function bootstrap() {
  setArenaMode(true);
  bindArenaInteractionGuard();
  setAppBootLoaderHint("Verificando sesión…");

  const userPromise = requireAuthOrRedirect();
  const liteSyncPromise = pullArenaSync({ lite: true })
    .then(() => {
      markArenaBootLiteSyncDone();
    })
    .catch((err) => {
      console.warn("[arena] sync lite", err);
    });

  const user = await userPromise;
  if (!user) return;

  try {
    setArenaUser({
      username: user.username,
      displayName: user.displayName,
      isAdmin: user.isAdmin,
      isPrivadas: user.isPrivadas,
    });
    saveSession({ participantId: user.username });

    setArenaPushHandlers({
      pushMyPredictions: (data) => saveMyPredictions(data).then(() => {}),
      pushOfficial: (data) => saveOfficialResults(data).then(() => {}),
    });

    setArenaLogout(() => {
      void logout()
        .catch(() => {})
        .finally(() => {
          location.href = LOGIN_URL;
        });
    });

    setArenaSearchPredictions((q) => searchPredictions(q));

    setArenaAccountApi({
      deleteMyAccount: async () => {
        await deleteMyAccount();
        location.href = LOGIN_URL;
      },
      listUsers: () => listAdminUsers().then((res) => res.users ?? []),
      searchUsers: (q) => searchAdminUsers(q).then((res) => res.users ?? []),
      deleteUser: async (username) => {
        await deleteAdminUser(username);
        await pullArenaSync();
      },
      banUser: async (username) => {
        await banAdminUser(username);
        await pullArenaSync();
      },
    });

    setArenaBackupApi({
      listBackups: () => listArenaBackups(),
      exportBackup: () => exportArenaBackup(),
      restoreBackupFile: (filename) => restoreArenaBackupFile(filename),
      restoreBackupUpload: (payload) => restoreArenaBackupUpload(payload),
    });

    initApp();
    setAppBootLoaderHint("Sincronizando tus datos…");
    await liteSyncPromise;
    setAppBootLoaderHint("Preparando la interfaz…");
    finishBootstrap();
    void initArenaChat().catch((err) => console.error("[arena] chat", err));
    setRemoteSyncActive(true);
    void initArenaSyncPoll().catch((err) => console.error("[arena] sync inicial", err));
  } catch (err) {
    console.error("[arena] bootstrap", err);
    setAppBootLoaderHint("Error al cargar. Recarga la página o inténtalo de nuevo.");
    await new Promise((resolve) => window.setTimeout(resolve, 1800));
  } finally {
    dismissAppBootLoader();
  }
}

void bootstrap();
