import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

import { initMetaPixel, trackMetaPageView } from "@/lib/metaPixel";

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
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

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
