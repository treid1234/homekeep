import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";

const AuthContext = createContext(null);

const HK_AUTH_EVENT = "hk:auth:unauthorized"; // dispatched by api layer when it gets a 401
const HK_AUTH_NOTICE_KEY = "hk_auth_notice"; // session notice shown on login page after auto-logout

export function AuthProvider({ children }) {
    const navigate = useNavigate();

    const [token, setToken] = useState(() => localStorage.getItem("hk_token") || "");
    const [user, setUser] = useState(() => {
        const raw = localStorage.getItem("hk_user");
        try {
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    });

    // ✅ Receipts badge in NavBar (unattached inbox count)
    const [unattachedReceiptsCount, setUnattachedReceiptsCount] = useState(() => {
        const raw = localStorage.getItem("hk_unattached_count");
        const n = Number(raw);
        return Number.isFinite(n) ? n : 0;
    });

    // ✅ Remember last “attach destination” from Receipts Inbox
    // Shape: { propertyId: string, logId: string }
    const [lastRoute, setLastRoute] = useState(() => {
        const raw = localStorage.getItem("hk_last_route");
        try {
            return raw ? JSON.parse(raw) : { propertyId: "", logId: "" };
        } catch {
            return { propertyId: "", logId: "" };
        }
    });

    // Refs to avoid stale closures in event handlers
    const tokenRef = useRef(token);
    const didAutoLogoutRef = useRef(false);

    useEffect(() => {
        tokenRef.current = token;
        if (!token) didAutoLogoutRef.current = false; // reset when token is cleared
    }, [token]);

    const isAuthed = !!token;

    // Persist token
    useEffect(() => {
        if (token) localStorage.setItem("hk_token", token);
        else localStorage.removeItem("hk_token");
    }, [token]);

    // Persist user
    useEffect(() => {
        if (user) localStorage.setItem("hk_user", JSON.stringify(user));
        else localStorage.removeItem("hk_user");
    }, [user]);

    // Persist last route
    useEffect(() => {
        localStorage.setItem("hk_last_route", JSON.stringify(lastRoute || { propertyId: "", logId: "" }));
    }, [lastRoute]);

    // Persist unattached receipts count
    useEffect(() => {
        localStorage.setItem("hk_unattached_count", String(unattachedReceiptsCount || 0));
    }, [unattachedReceiptsCount]);

    function logout(options = {}) {
        const { redirectTo = "/login", notice = "" } = options || {};

        setToken("");
        setUser(null);
        setUnattachedReceiptsCount(0);

        localStorage.removeItem("hk_token");
        localStorage.removeItem("hk_user");
        localStorage.setItem("hk_unattached_count", "0");

        if (notice) {
            try {
                sessionStorage.setItem(HK_AUTH_NOTICE_KEY, notice);
            } catch {
                // no-op
            }
        }

        navigate(redirectTo);
    }

    async function refreshMe(nextToken = tokenRef.current) {
        if (!nextToken) return;
        try {
            const res = await api.me(nextToken);
            setUser(res?.data?.user || res?.data || res || null);
        } catch {
            logout({ notice: "Your session expired. Please log in again." });
        }
    }

    async function refreshUnattachedReceipts(nextToken = tokenRef.current) {
        if (!nextToken) {
            setUnattachedReceiptsCount(0);
            return;
        }

        try {
            const res = await api.listReceipts({ status: "unattached" }, nextToken);
            const list = res?.data?.receipts || [];

            if (Array.isArray(list)) {
                setUnattachedReceiptsCount(list.length);
                return;
            }

            setUnattachedReceiptsCount(0);
        } catch {
            setUnattachedReceiptsCount(0);
        }
    }

    async function login(email, password) {
        const res = await api.login({ email, password });
        const t = res?.data?.token || res?.token || "";
        if (!t) throw new Error("Login succeeded but no token returned.");

        didAutoLogoutRef.current = false;
        setToken(t);

        // Load user + receipts count right away
        await refreshMe(t);
        await refreshUnattachedReceipts(t);

        // Clear any prior notice
        try {
            sessionStorage.removeItem(HK_AUTH_NOTICE_KEY);
        } catch {
            // no-op
        }

        navigate("/dashboard");
    }

    // ✅ Boot refresh (on first load when token exists)
    useEffect(() => {
        let cancelled = false;

        async function boot() {
            const t = tokenRef.current;
            if (!t) return;

            try {
                const [meRes, receiptsRes] = await Promise.allSettled([api.me(t), api.listReceipts({ status: "unattached" }, t)]);

                if (cancelled) return;

                if (meRes.status === "fulfilled") {
                    const res = meRes.value;
                    setUser(res?.data?.user || res?.data || res || null);
                }

                if (receiptsRes.status === "fulfilled") {
                    const res = receiptsRes.value;
                    const list = res?.data?.receipts || [];
                    setUnattachedReceiptsCount(Array.isArray(list) ? list.length : 0);
                } else {
                    setUnattachedReceiptsCount(0);
                }
            } catch {
                // ignore; centralized 401 event will handle real auth failures
            }
        }

        boot();
        return () => {
            cancelled = true;
        };
    }, []);

    // ✅ Listen for central 401 events from API layer; auto-logout once
    useEffect(() => {
        function onUnauthorized(e) {
            const currentToken = tokenRef.current;

            // If already logged out, ignore
            if (!currentToken) return;

            // If we already auto-logged-out during this burst, ignore
            if (didAutoLogoutRef.current) return;
            didAutoLogoutRef.current = true;

            const detail = e?.detail || {};
            const notice =
                typeof detail.notice === "string" && detail.notice.trim()
                    ? detail.notice
                    : "Your session expired. Please log in again.";

            logout({ notice, redirectTo: "/login" });
        }

        window.addEventListener(HK_AUTH_EVENT, onUnauthorized);
        return () => window.removeEventListener(HK_AUTH_EVENT, onUnauthorized);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const value = useMemo(
        () => ({
            token,
            user,
            isAuthed,

            login,
            logout,
            refreshMe,

            // ✅ receipts badge support
            unattachedReceiptsCount,
            refreshUnattachedReceipts,

            // ✅ receipts routing convenience
            lastRoute,
            setLastRoute,
        }),
        [token, user, isAuthed, unattachedReceiptsCount, lastRoute]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
    return ctx;
}

