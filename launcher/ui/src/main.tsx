import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./design-system/tokens.css";
import "./design-system/components.css";

const root = document.getElementById("root")!;
// Splash is present in index.html; replace it once React mounts.
createRoot(root).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
