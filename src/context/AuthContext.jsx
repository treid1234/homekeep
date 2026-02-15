import { createContext, useContext, useMemo, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [token, setToken] = useState(() => localStorage.getItem("hk_token") || "");
    const [user, setUser] = useState(() => {
        const raw = localStorage.getItem("hk_user");
        try {
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    });

    function setSession({ user: nextUser, token: nextToken }) {
        const t = nextToken || "";
        setToken(t);
        setUser(nextUser || null);

        if (t) localStorage.setItem("hk_token", t);
        else localStorage.removeItem("hk_token");

        if (nextUser) localStorage.setItem("hk_user", JSON.stringify(nextUser));
        else localStorage.removeItem("hk_user");
    }

    function logout() {
        setSession({ user: null, token: "" });
    }

    const value = useMemo(
        () => ({ token, user, setSession, logout }),
        [token, user]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
    return ctx;
}
