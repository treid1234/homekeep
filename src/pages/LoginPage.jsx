import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext.jsx";

export default function LoginPage() {
    const navigate = useNavigate();
    const { setSession } = useAuth();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(e) {
        e.preventDefault(); // ✅ prevents page refresh
        setError("");

        const eTrim = email.trim();
        if (!eTrim || !password) {
            setError("Email and password are required.");
            return;
        }

        setBusy(true);
        try {
            const { user, token } = await api.login(eTrim, password);

            // ✅ Store session in context/localStorage (see AuthContext below)
            setSession({ user, token });

            // ✅ Navigate somewhere after login
            navigate("/dashboard");
        } catch (err) {
            // ✅ Do NOT clear the fields on error
            setError(err?.message || "Login failed.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="hk-container" style={{ maxWidth: 520 }}>
            <div className="hk-header">
                <div>
                    <h2 className="hk-title">Log in</h2>
                    <p className="hk-subtitle">Welcome back to HomeKeep.</p>
                </div>
            </div>

            <section className="hk-card hk-card-pad">
                <form onSubmit={handleSubmit} className="hk-form">
                    <label className="hk-label">
                        Email
                        <input
                            className="hk-input"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                        />
                    </label>

                    <label className="hk-label">
                        Password
                        <input
                            className="hk-input"
                            type="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Your password"
                        />
                    </label>

                    {error ? <div className="hk-error">{error}</div> : null}

                    <div className="hk-actions" style={{ justifyContent: "space-between" }}>
                        <button className="hk-btn" type="submit" disabled={busy}>
                            {busy ? "Logging in…" : "Log in"}
                        </button>

                        <Link className="hk-link" to="/register">
                            Need an account? Register →
                        </Link>
                    </div>
                </form>
            </section>
        </div>
    );
}
