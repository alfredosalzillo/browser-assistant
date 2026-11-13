import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { SiteThemeProvider } from "./siteTheme";

const root = document.getElementById("root");

if (root) {
  createRoot(root).render(
    <StrictMode>
      <SiteThemeProvider>
        <App />
      </SiteThemeProvider>
    </StrictMode>,
  );
}
