import { initApp } from "./app.js";
import { initRemoteSync } from "./sync.js";

void initRemoteSync().finally(() => {
  initApp();
});
