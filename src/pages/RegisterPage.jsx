import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function RegisterPage() {
    const { register } = useAuth();
    const navigate = useNavigate();

    const [name, setName] = useState("Tamara Reid");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");

        if (!name.trim() || !email.trim() || !password) {
            setError("Please fill out all fields.");
            return;
        }

        setSubmitting(true);
        try {
            await register(name.trim(), email.trim(), password);
            navigate("/dashboard");
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div style={{ maxWidth: 420 }}>
            <h2>Register</h2>

            <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10 }}>
                <label>
                    Name
                    <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%" }} />
                </label>

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
                    {submitting ? "Creating account..." : "Create account"}
                </button>
            </form>

            <p style={{ marginTop: 12 }}>
                Already have an account? <Link to="/login">Login</Link>
            </p>
        </div>
    );
}
