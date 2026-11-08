"use client";

import { useEffect } from "react";

/** Registers the offline service worker (PWA). */
export function PWARegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    if (!window.isSecureContext) return;
    const id = window.setTimeout(() => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* offline mode is a bonus; never block the fun */
      });
    }, 1200);
    return () => window.clearTimeout(id);
  }, []);
  return null;
}
