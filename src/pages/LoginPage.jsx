import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState("tamara@test.com");
    const [password, setPassword] = useState("Password123!");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");

        const trimmedEmail = email.trim();

        if (!trimmedEmail || !password) {
            setError("Email and password are required.");
            return;
        }

        setLoading(true);
        try {
            await login(trimmedEmail, password);
            navigate("/dashboard");
        } catch (err) {
            setError(err.message || "Login failed.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="hk-container">
            <div className="hk-header">
                <div>
                    <h2 className="hk-title">Log in</h2>
                    <p className="hk-subtitle">Welcome back 👋</p>
                </div>
                <span className="hk-pill">HomeKeep</span>
            </div>

            <section className="hk-card hk-card-pad" style={{ maxWidth: 520, margin: "0 auto" }}>
                <form onSubmit={handleSubmit} className="hk-form">
                    <label className="hk-label">
                        Email
                        <input
                            className="hk-input"
                            type="email"
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
                            placeholder="••••••••"
                        />
                    </label>

                    {error && <div className="hk-error">{error}</div>}

                    <div className="hk-actions" style={{ justifyContent: "space-between" }}>
                        <button className="hk-btn" type="submit" disabled={loading}>
                            {loading ? "Logging in…" : "Log in"}
                        </button>

                        <Link className="hk-link" to="/register">
                            Need an account?
                        </Link>
                    </div>
                </form>
            </section>
        </div>
    );
}
