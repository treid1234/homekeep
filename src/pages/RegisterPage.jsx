import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext.jsx";

export default function RegisterPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthed, login } = useAuth();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const nextPath = useMemo(() => {
        const from = location.state?.from;
        return typeof from === "string" && from.trim() ? from : "/dashboard";
    }, [location.state]);

    // If already authed, bounce
    useEffect(() => {
        if (isAuthed) navigate("/dashboard", { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthed]);

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");

        const cleanName = name.trim();
        const cleanEmail = email.trim();

        if (!cleanName || !cleanEmail || !password) {
            setError("Name, email, and password are required.");
            return;
        }

        setSubmitting(true);
        try {
            await api.register({ name: cleanName, email: cleanEmail, password });

            // Auto-login after register (keeps your UX smooth)
            await login(cleanEmail, password);

            navigate(nextPath, { replace: true });
        } catch (err) {
            setError(err?.message || "Registration failed.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="hk-container" style={{ maxWidth: 520 }}>
            <div className="hk-card hk-card-pad">
                <h2 className="hk-title" style={{ marginBottom: 6 }}>
                    Create account
                </h2>
                <p className="hk-muted" style={{ marginTop: 0, marginBottom: 16 }}>
                    Create an account to start tracking maintenance and receipts.
                </p>

                {error ? (
                    <div className="hk-error" style={{ marginBottom: 12 }}>
                        {error}
                    </div>
                ) : null}

                <form className="hk-form" onSubmit={handleSubmit}>
                    <label className="hk-label">
                        Name
                        <input className="hk-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
                    </label>

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
                            autoComplete="new-password"
                            placeholder="Create a password"
                        />
                    </label>

                    <div className="hk-actions" style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                        <button className="hk-btn" type="submit" disabled={submitting}>
                            {submitting ? "Creating…" : "Create account"}
                        </button>
                    </div>
                </form>

                <div className="hk-muted" style={{ marginTop: 14, fontSize: 13 }}>
                    Already have an account?{" "}
                    <Link className="hk-link" to="/login" state={{ from: nextPath }}>
                        Log in
                    </Link>
                </div>
            </div>
        </div>
    );
}
