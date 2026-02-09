import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext.jsx";
import { Link } from "react-router-dom";
import EmptyState from "../components/EmptyState.jsx";

export default function DashboardPage() {
    const { token } = useAuth();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [summary, setSummary] = useState(null);
    const [upcoming, setUpcoming] = useState([]);
    const [overdue, setOverdue] = useState([]);

    function unwrap(res) {
        const body = res?.data ? res.data : res; // supports fetch wrapper or axios-like
        if (!body) return null;
        if (typeof body === "object" && body.data && typeof body.data === "object") return body.data;
        return body;
    }

    async function load() {
        setLoading(true);
        setError("");

        try {
            // Load summary first (critical)
            const summaryRes = await api.dashboardSummary(token);
            const summaryPayload = unwrap(summaryRes);
            setSummary(summaryPayload);

            // Reminders are optional (don’t break dashboard)
            try {
                const remindersRes = await api.getUpcomingReminders(30, token);
                const remindersPayload = unwrap(remindersRes) || {};
                setUpcoming(remindersPayload.upcoming || []);
                setOverdue(remindersPayload.overdue || []);
            } catch {
                setUpcoming([]);
                setOverdue([]);
            }
        } catch (err) {
            setError(err.message || "Failed to load dashboard.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const sparkValues = useMemo(() => {
        const arr = summary?.dailySpend || [];
        return arr.map((d) => Number(d.total) || 0);
    }, [summary]);

    const monthSpend = summary?.totals?.month;
    const yearSpend = summary?.totals?.year;
    const recentLogs = summary?.recentLogs || [];

    if (loading) return <div className="hk-container">Loading dashboard…</div>;
    if (error) return <div className="hk-container hk-error">{error}</div>;

    return (
        <div className="hk-container">
            <div className="hk-header">
                <div>
                    <h2 className="hk-title">Dashboard</h2>
                    <p className="hk-subtitle">A snapshot of spend + recent activity.</p>
                </div>
                <button className="hk-btn hk-btn-ghost" type="button" onClick={load}>
                    Refresh
                </button>
            </div>

            <div className="hk-grid">
                <StatCard label="This Month" value={formatMoney(monthSpend)} />
                <StatCard label="This Year" value={formatMoney(yearSpend)} />
                <StatCard label="Recent Logs" value={`${recentLogs.length}`} />
                <div className="hk-card hk-card-pad">
                    <div className="hk-row">
                        <div>
                            <div className="hk-muted" style={{ fontSize: 13, fontWeight: 800 }}>Last 30 Days Trend</div>
                            <div style={{ fontSize: 22, fontWeight: 900 }}>{formatMoney(sparkValues.reduce((a, b) => a + b, 0))}</div>
                        </div>
                        <span className="hk-pill">Trend</span>
                    </div>
                    <div className="hk-divider" />
                    <Sparkline values={sparkValues} />
                </div>
            </div>

            <section className="hk-card hk-card-pad">
                <div className="hk-row">
                    <h3 className="hk-section-title">Recent Logs</h3>
                    <span className="hk-pill">Latest 5</span>
                </div>

                {recentLogs.length === 0 ? (
                    <EmptyState
                        variant="dashboard"
                        title="No maintenance logs yet"
                        message="Create your first maintenance entry from a property, then you’ll see recent activity here."
                    />
                ) : (
                    <ul className="hk-list" style={{ marginTop: 10 }}>
                        {recentLogs.slice(0, 5).map((log) => (
                            <li key={log._id} style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 12, marginBottom: 10, background: "var(--surface)" }}>
                                <div style={{ fontWeight: 900 }}>{log.title}</div>
                                <div className="hk-muted" style={{ fontSize: 13, marginTop: 4 }}>
                                    {log.property?.nickname ? `${log.property.nickname} — ` : ""}
                                    {log.serviceDate ? new Date(log.serviceDate).toLocaleDateString() : "No date"}
                                    {typeof log.cost === "number" ? ` • ${formatMoney(log.cost)}` : ""}
                                </div>
                                <div style={{ marginTop: 8 }}>
                                    <Link className="hk-link" to={`/properties/${log.property?._id || log.property}/maintenance`}>
                                        View maintenance →
                                    </Link>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="hk-card hk-card-pad">
                <div className="hk-row">
                    <h3 className="hk-section-title">Upcoming Maintenance</h3>
                    <span className="hk-pill">Next 30 days</span>
                </div>

                {overdue.length === 0 && upcoming.length === 0 ? (
                    <EmptyState
                        variant="default"
                        title="Nothing due soon 🎉"
                        message="Add a Next due date on a maintenance log and enable reminders to see items show up here."
                    />
                ) : (
                    <div style={{ display: "grid", gap: 16, marginTop: 10 }}>
                        {overdue.length > 0 && (
                            <div>
                                <div className="hk-pill hk-badge-danger" style={{ marginBottom: 10 }}>Overdue</div>
                                <ReminderList items={overdue} />
                            </div>
                        )}

                        {upcoming.length > 0 && (
                            <div>
                                <div className="hk-pill hk-badge-warn" style={{ marginBottom: 10 }}>Due Soon</div>
                                <ReminderList items={upcoming} />
                            </div>
                        )}
                    </div>
                )}
            </section>
        </div>
    );
}

function StatCard({ label, value }) {
    return (
        <div className="hk-card hk-card-pad">
            <div className="hk-muted" style={{ fontSize: 13, fontWeight: 800 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>{value}</div>
        </div>
    );
}

function ReminderList({ items }) {
    return (
        <ul className="hk-list">
            {items.map((log) => (
                <li key={log._id} style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 12, marginBottom: 10, background: "var(--surface)" }}>
                    <div style={{ fontWeight: 900 }}>{log.title}</div>
                    <div className="hk-muted" style={{ fontSize: 13, marginTop: 4 }}>
                        Due {log.nextDueDate ? new Date(log.nextDueDate).toLocaleDateString() : "—"}
                    </div>
                    <div style={{ marginTop: 8 }}>
                        <Link className="hk-link" to={`/properties/${log.property}/maintenance`}>View maintenance →</Link>
                    </div>
                </li>
            ))}
        </ul>
    );
}

function formatMoney(value) {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return "—";
    return `$${n.toFixed(2)}`;
}

function Sparkline({ values }) {
    const w = 260;
    const h = 64;
    const pad = 6;

    const safe = Array.isArray(values) && values.length ? values : [0];
    const max = Math.max(...safe, 0);
    const min = Math.min(...safe, 0);
    const range = max - min || 1;

    const points = safe
        .map((v, i) => {
            const x = pad + (i * (w - pad * 2)) / Math.max(safe.length - 1, 1);
            const y = h - pad - ((v - min) * (h - pad * 2)) / range;
            return `${x},${y}`;
        })
        .join(" ");

    return (
        <svg width="100%" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Spend sparkline">
            <polyline fill="none" stroke="currentColor" strokeWidth="3" strokeOpacity="0.85" points={points} />
        </svg>
    );
}
