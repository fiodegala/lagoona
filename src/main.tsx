import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initMetaPixel, trackMetaPageView } from "@/lib/metaPixel";

// Initialize Meta Pixel as early as possible
initMetaPixel();
trackMetaPageView();

// Register custom service worker for push notifications
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((err) => {
    console.warn('SW registration failed:', err);
  });
}

createRoot(document.getElementById("root")!).render(<App />);
