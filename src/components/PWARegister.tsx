"use client";

import { useEffect } from "react";

/**
 * Registers the offline service worker and keeps the installed app fresh:
 * when a new version is waiting it is activated immediately and the app
 * reloads once, so kids always run the latest build without doing anything.
 */
export function PWARegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    if (!window.isSecureContext) return;

    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        // pick up a waiting worker right away
        if (reg.waiting && navigator.serviceWorker.controller) {
          reg.waiting.postMessage("SKIP_WAITING");
        }
        reg.addEventListener("updatefound", () => {
          const next = reg.installing;
          if (!next) return;
          next.addEventListener("statechange", () => {
            if (next.state === "installed" && navigator.serviceWorker.controller) {
              next.postMessage("SKIP_WAITING");
            }
          });
        });
        navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
        // look for updates whenever the kid comes back to the tab
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") void reg.update().catch(() => {});
        });
      } catch {
        /* offline mode is a bonus; never block the fun */
      }
    };

    const id = window.setTimeout(() => void register(), 800);
    return () => window.clearTimeout(id);
  }, []);
  return null;
}
