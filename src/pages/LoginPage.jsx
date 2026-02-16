import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const HK_AUTH_NOTICE_KEY = "hk_auth_notice";

export default function LoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthed, login } = useAuth();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const nextPath = useMemo(() => {
        const from = location.state?.from;
        return typeof from === "string" && from.trim() ? from : "/dashboard";
    }, [location.state]);

    // If already authed, bounce
    useEffect(() => {
        if (isAuthed) navigate("/dashboard", { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthed]);

    // Pull session-expired notice (set by AuthContext auto-logout)
    useEffect(() => {
        try {
            const msg = sessionStorage.getItem(HK_AUTH_NOTICE_KEY) || "";
            if (msg) {
                setNotice(msg);
                sessionStorage.removeItem(HK_AUTH_NOTICE_KEY);
            }
        } catch {
            // no-op
        }
    }, []);

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");

        const cleanEmail = email.trim();
        const cleanPassword = password;

        if (!cleanEmail || !cleanPassword) {
            setError("Email and password are required.");
            return;
        }

        setSubmitting(true);
        try {
            await login(cleanEmail, cleanPassword);

            // AuthProvider currently navigates to /dashboard; we override with “return to” after login.
            // Using replace avoids back button going to /login.
            navigate(nextPath, { replace: true });
        } catch (err) {
            setError(err?.message || "Login failed.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="hk-container" style={{ maxWidth: 520 }}>
            <div className="hk-card hk-card-pad">
                <h2 className="hk-title" style={{ marginBottom: 6 }}>
                    Log in
                </h2>
                <p className="hk-muted" style={{ marginTop: 0, marginBottom: 16 }}>
                    Enter your credentials to access HomeKeep.
                </p>

                {notice ? (
                    <div className="hk-banner" style={{ marginBottom: 12 }}>
                        {notice}
                    </div>
                ) : null}

                {error ? (
                    <div className="hk-error" style={{ marginBottom: 12 }}>
                        {error}
                    </div>
                ) : null}

                <form className="hk-form" onSubmit={handleSubmit}>
                    <label className="hk-label">
                        Email
                        <input
                            className="hk-input"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                            placeholder="you@example.com"
                        />
                    </label>

                    <label className="hk-label">
                        Password
                        <input
                            className="hk-input"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                            placeholder="••••••••"
                        />
                    </label>

                    <div className="hk-actions" style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                        <button className="hk-btn" type="submit" disabled={submitting}>
                            {submitting ? "Signing in…" : "Log in"}
                        </button>
                    </div>
                </form>

                <div className="hk-muted" style={{ marginTop: 14, fontSize: 13 }}>
                    Don’t have an account?{" "}
                    <Link className="hk-link" to="/register" state={{ from: nextPath }}>
                        Create one
                    </Link>
                </div>
            </div>
        </div>
    );
}
