import { Link, NavLink, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

const THEME_KEY = "hk_theme"; // "light" | "dark" | "" (not set)

function getSavedTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === "dark" || saved === "light" ? saved : "";
}

function getSystemTheme() {
    const prefersDark =
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;

    return prefersDark ? "dark" : "light";
}

function applyTheme(theme) {
    const t = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = t; // <html data-theme="dark">
    return t;
}

export default function NavBar() {
    const { isAuthed, user, logout, unattachedReceiptsCount } = useAuth();
    const location = useLocation();

    // Theme:
    // - if user saved a preference, use it
    // - otherwise fall back to system preference
    const [theme, setTheme] = useState(() => {
        const saved = getSavedTheme();
        return saved || getSystemTheme();
    });

    // Always apply theme whenever it changes
    useEffect(() => {
        try {
            applyTheme(theme);
        } catch {
            // no-op
        }
    }, [theme]);

    // If user has NOT chosen a theme, follow OS changes live
    useEffect(() => {
        const saved = getSavedTheme();
        if (saved) return;

        const mql = window.matchMedia?.("(prefers-color-scheme: dark)");
        if (!mql) return;

        const onChange = (e) => {
            setTheme(e.matches ? "dark" : "light");
        };

        // Safari fallback support
        if (typeof mql.addEventListener === "function") {
            mql.addEventListener("change", onChange);
            return () => mql.removeEventListener("change", onChange);
        }

        if (typeof mql.addListener === "function") {
            mql.addListener(onChange);
            return () => mql.removeListener(onChange);
        }
    }, []);

    function toggleTheme() {
        const next = theme === "dark" ? "light" : "dark";
        setTheme(next);
        localStorage.setItem(THEME_KEY, next); // user explicitly chose
        applyTheme(next);
    }

    const linkStyle = ({ isActive }) => ({
        fontWeight: isActive ? 900 : 700,
        opacity: isActive ? 1 : 0.9,
    });

    const badge = useMemo(() => {
        if (!isAuthed) return null;

        if (!unattachedReceiptsCount) {
            return (
                <span className="hk-muted" style={{ fontSize: 12, marginLeft: 6 }}>
                    (0)
                </span>
            );
        }

        return (
            <span
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 26,
                    height: 22,
                    padding: "0 8px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 900,
                    marginLeft: 6,
                    background: "rgba(99, 102, 241, 0.14)",
                    border: "1px solid rgba(99, 102, 241, 0.28)",
                }}
                aria-label={`${unattachedReceiptsCount} unattached receipts`}
                title={`${unattachedReceiptsCount} unattached receipts`}
            >
                {unattachedReceiptsCount}
            </span>
        );
    }, [isAuthed, unattachedReceiptsCount]);

    return (
        <header
            style={{
                position: "sticky",
                top: 0,
                zIndex: 100,
                backdropFilter: "blur(10px)",
                background: "var(--hk-nav-bg, rgba(255,255,255,0.85))",
                borderBottom: "1px solid var(--hk-border, rgba(15,23,42,0.12))",
            }}
        >
            <div
                className="hk-container"
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    paddingTop: 12,
                    paddingBottom: 12,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Link
                        to={isAuthed ? "/dashboard" : "/login"}
                        style={{ fontWeight: 900, letterSpacing: 0.2 }}
                    >
                        HomeKeep
                    </Link>

                    {isAuthed ? (
                        <nav style={{ display: "flex", gap: 12, alignItems: "center" }}>
                            <NavLink to="/dashboard" style={linkStyle}>
                                Dashboard
                            </NavLink>

                            <NavLink to="/receipts" style={linkStyle}>
                                <span style={{ display: "inline-flex", alignItems: "center" }}>
                                    Receipts Inbox {badge}
                                </span>
                            </NavLink>

                            <NavLink to="/properties" style={linkStyle}>
                                Properties
                            </NavLink>
                        </nav>
                    ) : null}
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    {/* Theme toggle always visible */}
                    <button
                        type="button"
                        className="hk-toggle"
                        onClick={toggleTheme}
                        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                        title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                        style={{ fontWeight: 900 }}
                    >
                        {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
                    </button>

                    {isAuthed ? (
                        <>
                            <span className="hk-muted" style={{ fontSize: 13 }}>
                                {user?.name || user?.email || "Signed in"}
                            </span>

                            <button
                                className="hk-btn hk-btn-ghost hk-btn-sm"
                                type="button"
                                onClick={logout}
                            >
                                Log out
                            </button>
                        </>
                    ) : (
                        <>
                            {location.pathname !== "/login" ? (
                                <NavLink to="/login" style={linkStyle}>
                                    Log in
                                </NavLink>
                            ) : null}
                            {location.pathname !== "/register" ? (
                                <NavLink to="/register" style={linkStyle}>
                                    Register
                                </NavLink>
                            ) : null}
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}
