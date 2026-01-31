import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState("tamara@test.com");
    const [password, setPassword] = useState("Password123!");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        setSubmitting(true);
        try {
            await login(email.trim(), password);
            navigate("/dashboard");
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div style={{ maxWidth: 420 }}>
            <h2>Login</h2>

            <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10 }}>
                <label>
                    Email
                    <input value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%" }} />
                </label>

                <label>
                    Password
                    <input
                        value={password}
                        type="password"
                        onChange={(e) => setPassword(e.target.value)}
                        style={{ width: "100%" }}
                    />
                </label>

                {error && <div style={{ color: "crimson" }}>{error}</div>}

                <button disabled={submitting} type="submit">
                    {submitting ? "Logging in..." : "Login"}
                </button>
            </form>

            <p style={{ marginTop: 12 }}>
                Don’t have an account? <Link to="/register">Register</Link>
            </p>
        </div>
    );
}
