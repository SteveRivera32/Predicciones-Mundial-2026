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
import { initArenaSyncPoll, pullArenaSync } from "./arena-sync.js";
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

async function bootstrap() {
  const user = await requireAuthOrRedirect();
  if (!user) return;

  setArenaMode(true);
  bindArenaInteractionGuard();
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
  void initArenaChat().catch((err) => console.error("[arena] chat", err));
  try {
    await initArenaSyncPoll();
    setRemoteSyncActive(true);
  } catch (err) {
    console.error("[arena] sync inicial", err);
    finishBootstrap();
  }
}

void bootstrap();
