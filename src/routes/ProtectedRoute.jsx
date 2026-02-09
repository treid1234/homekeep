import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function ProtectedRoute({ children }) {
    const { token, loading } = useAuth();
    const location = useLocation();

    // Wait for AuthContext to finish checking localStorage token + /users/me
    if (loading) {
        return <div className="hk-container">Loading…</div>;
    }

    // If no token, go login and remember where they were trying to go
    if (!token) {
        return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }

    return children;
}

