import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AppProvider } from "./app/AppContext";
import { App } from "./App";
import { isTauri } from "./utils/platformFile";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/print.css";

// The desktop build must ALWAYS represent its bundled assets — the PWA
// service worker is never registered (and is unregistered if present).
if (isTauri()) {
  navigator.serviceWorker?.getRegistrations?.().then((regs) => {
    regs.forEach((r) => void r.unregister());
  });
} else if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js");
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </BrowserRouter>
  </StrictMode>
);
