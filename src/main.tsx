import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initMetaPixel, trackMetaPageView } from "@/lib/metaPixel";

// Initialize Meta Pixel as early as possible
initMetaPixel();
trackMetaPageView();

createRoot(document.getElementById("root")!).render(<App />);
