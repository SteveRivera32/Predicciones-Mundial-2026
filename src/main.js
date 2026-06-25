import { initApp, finishBootstrap } from "./app.js";
import { initRemoteSync, startRemoteSyncCatchup } from "./sync.js";

initApp();
void initRemoteSync().then((ok) => {
  if (ok) startRemoteSyncCatchup();
  else finishBootstrap();
});
