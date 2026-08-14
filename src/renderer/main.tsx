import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { installBrowserApiIfNeeded } from "./browserApi";
import "./index.css";

installBrowserApiIfNeeded();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
