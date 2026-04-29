import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { logger } from "./common/logger";

const container = document.getElementById("root");

if (container) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
} else {
  logger.error("Root container '#root' was not found. Skipping render bootstrap.");
}
