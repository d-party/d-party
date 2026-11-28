import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { applyTheme } from "@/styles/theme";

import { OptionsApp } from "./OptionsApp";
import "./styles.css";

applyTheme(document.documentElement);

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <StrictMode>
      <OptionsApp />
    </StrictMode>,
  );
}
