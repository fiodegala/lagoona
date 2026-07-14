import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

import { initMetaPixel, trackMetaPageView } from "@/lib/metaPixel";

const CHUNK_RELOAD_STORAGE_KEY = "fdg:chunk-reload-attempted";

const isDynamicImportError = (error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : String((error as { message?: unknown } | null)?.message ?? "");

  return /failed to fetch dynamically imported module|importing a module script failed|loading chunk \d+ failed|error loading dynamically imported module/i.test(
    message,
  );
};

const clearClientCaches = async () => {
  if ("caches" in window) {
    const keys = await window.caches.keys();
    await Promise.all(keys.map((key) => window.caches.delete(key)));
  }

  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }
};

const recoverFromChunkError = async () => {
  const alreadyTried = window.sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY) === "true";

  if (alreadyTried) return;

  window.sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, "true");

  try {
    await clearClientCaches();
  } finally {
    const url = new URL(window.location.href);
    url.searchParams.set("app_reload", Date.now().toString());
    window.location.replace(url.toString());
  }
};

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  void recoverFromChunkError();
});

window.addEventListener("unhandledrejection", (event) => {
  if (!isDynamicImportError(event.reason)) return;

  event.preventDefault();
  void recoverFromChunkError();
});

window.addEventListener("error", (event) => {
  if (!isDynamicImportError(event.error ?? event.message)) return;

  event.preventDefault();
  void recoverFromChunkError();
});

// Initialize Meta Pixel as early as possible
initMetaPixel();
trackMetaPageView();

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") || window.location.hostname.includes("lovableproject.com");

// Register only the notification service worker and avoid preview cache pollution
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();

      if (isPreviewHost || isInIframe) {
        await Promise.all(registrations.map((registration) => registration.unregister()));
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js", {
        updateViaCache: "none",
      });

      await registration.update();
    } catch (err) {
      console.warn("SW registration failed:", err);
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
