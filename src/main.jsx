import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import "./styles/homekeep.css";

// Apply theme BEFORE React renders (prevents flicker)
(function initTheme() {
  try {
    const saved = localStorage.getItem("hk_theme");
    const prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;

    const theme = saved === "dark" || saved === "light" ? saved : prefersDark ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
  } catch {
    // no-op
  }
})();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
