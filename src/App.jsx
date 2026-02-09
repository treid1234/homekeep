import { Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import PropertiesPage from "./pages/PropertiesPage.jsx";
import MaintenancePage from "./pages/MaintenancePage.jsx";

import ProtectedRoute from "./routes/ProtectedRoute.jsx";
import { useAuth } from "./context/AuthContext.jsx";

export default function App() {
  const { user, logout } = useAuth();
  const location = useLocation();

  // ----- Theme toggle -----
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("homekeep_theme");
    return saved === "dark" || saved === "light" ? saved : "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("homekeep_theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  // ----- Active link -----
  const isActive = (path) => location.pathname === path;

  // ----- Theme-aware inline styles (fallbacks if CSS variables are missing) -----
  const styles = useMemo(() => {
    return {
      topbar: {
        width: "100%",
        position: "sticky",
        top: 0,
        zIndex: 50,

        // visible in light mode + still nice in dark mode
        background: "var(--hk-nav-bg, rgba(255,255,255,0.85))",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid var(--hk-border, rgba(0,0,0,0.10))",
      },

      inner: {
        maxWidth: 1100,
        margin: "0 auto",
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      },

      logo: {
        margin: 0,
        fontSize: 20,
        fontWeight: 900,
        letterSpacing: "-0.02em",
        whiteSpace: "nowrap",
        color: "var(--hk-text, #111827)",
      },

      nav: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        flexWrap: "wrap",
      },

      linkBase: {
        textDecoration: "none",
        padding: "9px 12px",
        borderRadius: 999,
        fontWeight: 750,
        fontSize: 14,
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,

        color: "var(--hk-text, #111827)",
        background: "var(--hk-nav-pill, rgba(17,24,39,0.06))",
        border: "1px solid var(--hk-border, rgba(0,0,0,0.12))",
        transition: "transform 120ms ease, background 120ms ease, border-color 120ms ease",
      },

      linkActive: {
        background: "var(--hk-nav-pill-active, rgba(99,102,241,0.14))",
        border: "1px solid var(--hk-nav-pill-active-border, rgba(99,102,241,0.35))",
      },

      button: {
        cursor: "pointer",
        appearance: "none",
        outline: "none",
      },

      themeBtn: {
        padding: "9px 12px",
        borderRadius: 999,
        fontWeight: 800,
        fontSize: 14,
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,

        color: "var(--hk-text, #111827)",
        background: "var(--hk-nav-pill, rgba(17,24,39,0.06))",
        border: "1px solid var(--hk-border, rgba(0,0,0,0.12))",
        cursor: "pointer",
      },

      main: {
        maxWidth: 1100,
        margin: "0 auto",
        padding: "24px 16px",
      },
    };
  }, []);

  const navLinkStyle = (path) => ({
    ...styles.linkBase,
    ...(isActive(path) ? styles.linkActive : null),
  });

  return (
    <>
      {/* ===== Top Navigation ===== */}
      <header style={styles.topbar}>
        <div style={styles.inner}>
          <h1 style={styles.logo}>HomeKeep</h1>

          <nav style={styles.nav}>
            {/* Left group */}
            <Link to="/properties" style={navLinkStyle("/properties")}>
              Properties
            </Link>

            {user ? (
              <>
                <Link to="/dashboard" style={navLinkStyle("/dashboard")}>
                  Dashboard
                </Link>

                {/* Theme toggle */}
                <button
                  type="button"
                  onClick={toggleTheme}
                  style={{ ...styles.themeBtn, ...styles.button }}
                  aria-label="Toggle dark mode"
                  title="Toggle theme"
                >
                  {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
                </button>

                <button
                  type="button"
                  onClick={logout}
                  style={{ ...styles.themeBtn, ...styles.button }}
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" style={navLinkStyle("/login")}>
                  Login
                </Link>
                <Link to="/register" style={navLinkStyle("/register")}>
                  Register
                </Link>

                {/* Theme toggle also available when logged out */}
                <button
                  type="button"
                  onClick={toggleTheme}
                  style={{ ...styles.themeBtn, ...styles.button }}
                  aria-label="Toggle dark mode"
                  title="Toggle theme"
                >
                  {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
                </button>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* ===== Page Content ===== */}
      <main style={styles.main}>
        <Routes>
          <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/properties"
            element={
              <ProtectedRoute>
                <PropertiesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/properties/:propertyId/maintenance"
            element={
              <ProtectedRoute>
                <MaintenancePage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<div>Not found</div>} />
        </Routes>
      </main>
    </>
  );
}

