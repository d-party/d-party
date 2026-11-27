import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { applyTheme } from "@/styles/theme";

import { PopupApp } from "./PopupApp";
import "./styles.css";

applyTheme(document.documentElement);

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <StrictMode>
      <PopupApp />
    </StrictMode>,
  );
}
