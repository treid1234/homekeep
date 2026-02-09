import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [token, setToken] = useState(() => localStorage.getItem("homekeep_token") || "");
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    async function loadMe(currentToken) {
        if (!currentToken) {
            setUser(null);
            setLoading(false);
            return;
        }

        try {
            const res = await api.me(currentToken);
            // api.me returns { success, data: { user } }
            const payload = res?.data ? res.data : res;
            const data = payload?.data ? payload.data : payload;
            setUser(data?.user || null);
        } catch {
            localStorage.removeItem("homekeep_token");
            setToken("");
            setUser(null);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadMe(token);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function login(email, password) {
        const { user, token: newToken } = await api.login({ email, password });

        localStorage.setItem("homekeep_token", newToken);
        setToken(newToken);
        setUser(user);
    }

    // REGISTER
    async function register(name, email, password) {
        const { user, token: newToken } = await api.register({ name, email, password });

        localStorage.setItem("homekeep_token", newToken);
        setToken(newToken);
        setUser(user);
    }

    // LOGOUT
    function logout() {
        localStorage.removeItem("homekeep_token");
        setToken("");
        setUser(null);
    }

    const value = useMemo(
        () => ({ token, user, loading, login, register, logout }),
        [token, user, loading]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
    return ctx;
}
