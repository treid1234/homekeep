import { useEffect, useState } from "react";

export default function ThemeToggle() {
    const [theme, setTheme] = useState(() => localStorage.getItem("hk_theme") || "light");

    useEffect(() => {
        if (theme === "dark") document.documentElement.setAttribute("data-theme", "dark");
        else document.documentElement.removeAttribute("data-theme");

        localStorage.setItem("hk_theme", theme);
    }, [theme]);

    return (
        <button
            type="button"
            className="hk-btn hk-btn-ghost"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            aria-label="Toggle dark mode"
            title="Toggle dark mode"
        >
            {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
        </button>
    );
}
