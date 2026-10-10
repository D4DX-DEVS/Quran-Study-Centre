// PWA registration + lightweight update-available prompt.
// vite-plugin-pwa is configured with `registerType: "autoUpdate"`, so the
// service worker refreshes in the background. When a new version is ready
// we ask the user once before swapping, preserving any in-progress work.
import { registerSW } from "virtual:pwa-register";
import { confirmDialog } from "./components/core/confirm";

const updateSW = registerSW({
  onNeedRefresh() {
    confirmDialog({ message: "A new version is available. Reload now to update?", confirmLabel: "Reload" })
      .then((ok) => ok && updateSW(true))
      .catch(() => {
        // no-op; background tabs will pick up the update on next load
      });
  },
  onOfflineReady() {
    // Intentionally silent — avoid noisy toast on every first visit.
  },
});
