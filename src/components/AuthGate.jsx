import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

export default function AuthGate({ children }) {
    const { token, isAuthed, refreshMe, refreshUnattachedReceipts } = useAuth();
    const [booting, setBooting] = useState(true);

    useEffect(() => {
        let alive = true;

        async function boot() {
            try {
                // If token exists (page refresh), load user + badge count before showing app
                if (token) {
                    await refreshMe(token);
                    await refreshUnattachedReceipts(token);
                }
            } finally {
                if (alive) setBooting(false);
            }
        }

        boot();
        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // If logged out, no need to gate
    if (!isAuthed) return children;

    // If logged in, hold UI until hydration completes
    if (booting) {
        return (
            <div className="hk-container" style={{ paddingTop: 24 }}>
                <div className="hk-card hk-card-pad">
                    <div className="hk-muted">Loading your session…</div>
                </div>
            </div>
        );
    }

    return children;
}
