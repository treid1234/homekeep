// src/components/NavBar.jsx
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useEffect, useMemo, useState } from "react";

function setTheme(next) {
    const root = document.documentElement; // <html>
    root.setAttribute("data-theme", next);
    localStorage.setItem("hk_theme", next);
}

function getInitialTheme() {
    const saved = localStorage.getItem("hk_theme");
    if (saved === "dark" || saved === "light") return saved;
    return "light";
}

export default function NavBar() {
    const { isAuthed, logout } = useAuth();
    const loc = useLocation();

    const [theme, setThemeState] = useState(() => getInitialTheme());

    useEffect(() => {
        setTheme(theme);
    }, [theme]);

    const links = useMemo(() => {
        if (!isAuthed) return [];
        return [
            { to: "/dashboard", label: "Dashboard" },
            { to: "/properties", label: "Properties" },
            { to: "/receipts", label: "Receipts Inbox" },
        ];
    }, [isAuthed]);

    return (
        <div
            style={{
                position: "sticky",
                top: 0,
                zIndex: 20,
                backdropFilter: "blur(10px)",
                background: "var(--hk-nav-bg, rgba(255,255,255,0.8))",
                borderBottom: "1px solid var(--hk-border, rgba(15,23,42,0.12))",
            }}
        >
            <div
                className="hk-container"
                style={{
                    paddingTop: 10,
                    paddingBottom: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                }}
            >
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <Link to={isAuthed ? "/dashboard" : "/login"} style={{ fontWeight: 900 }}>
                        HomeKeep
                    </Link>

                    {isAuthed ? (
                        <nav style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                            {links.map((l) => {
                                const active = loc.pathname === l.to || loc.pathname.startsWith(l.to + "/");
                                return (
                                    <Link
                                        key={l.to}
                                        to={l.to}
                                        style={{
                                            fontWeight: 800,
                                            padding: "6px 10px",
                                            borderRadius: 999,
                                            border: active ? "1px solid rgba(14,165,164,0.35)" : "1px solid transparent",
                                            background: active ? "rgba(14,165,164,0.10)" : "transparent",
                                        }}
                                    >
                                        {l.label}
                                    </Link>
                                );
                            })}
                        </nav>
                    ) : null}
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <button
                        className="hk-toggle"
                        type="button"
                        onClick={() => setThemeState((t) => (t === "dark" ? "light" : "dark"))}
                        aria-label="Toggle light/dark mode"
                        title="Toggle theme"
                    >
                        {theme === "dark" ? "🌙 Dark" : "☀️ Light"}
                    </button>

                    {isAuthed ? (
                        <button className="hk-btn hk-btn-ghost hk-btn-sm" type="button" onClick={logout}>
                            Logout
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
