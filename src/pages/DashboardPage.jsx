import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext.jsx";
import { Link } from "react-router-dom";

export default function DashboardPage() {
    const { token } = useAuth();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [summary, setSummary] = useState(null);
    const [upcoming, setUpcoming] = useState([]);
    const [overdue, setOverdue] = useState([]);

    async function load() {
        setLoading(true);
        setError("");

        try {
            const [summaryRes, remindersRes] = await Promise.all([
                api.dashboardSummary(token),
                api.getUpcomingReminders(30, token),
            ]);

            const unwrap = (res) => {
                const body = res?.data;
                if (!body) return null;
                if (typeof body === "object" && body.data && typeof body.data === "object") return body.data;
                return body;
            };

            const summaryPayload = unwrap(summaryRes);
            const remindersPayload = unwrap(remindersRes) || {};

            setSummary(summaryPayload);
            setUpcoming(remindersPayload.upcoming || []);
            setOverdue(remindersPayload.overdue || []);
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

    if (loading) return <div>Loading dashboard…</div>;
    if (error) return <div style={{ color: "crimson" }}>{error}</div>;

    const monthSpend = summary?.totals?.month;
    const yearSpend = summary?.totals?.year;
    const recentLogs = summary?.recentLogs || [];

    return (
        <div>
            <h2>Dashboard</h2>

            {/* ===== Summary Cards ===== */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 16,
                    marginBottom: 24,
                }}
            >
                <SummaryCard label="This Month" value={formatMoney(monthSpend)} />
                <SummaryCard label="This Year" value={formatMoney(yearSpend)} />
                <SummaryCard
                    label="Recent Activity"
                    value={`${recentLogs.length} log${recentLogs.length === 1 ? "" : "s"}`}
                />
                <div
                    style={{
                        padding: 16,
                        border: "1px solid #e5e7eb",
                        borderRadius: 10,
                        background: "#fff",
                    }}
                >
                    <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 10 }}>Last 30 days spend</div>
                    <Sparkline values={sparkValues} />
                    <div style={{ marginTop: 10, fontSize: 14, color: "#374151" }}>
                        Total: {formatMoney(sparkValues.reduce((a, b) => a + b, 0))}
                    </div>
                </div>
            </div>

            {/* ===== Recent Logs ===== */}
            <section
                style={{
                    padding: 16,
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    background: "#fff",
                    marginBottom: 24,
                }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <h3 style={{ marginTop: 0, marginBottom: 0 }}>Recent Logs</h3>
                    <button onClick={load} style={{ cursor: "pointer" }}>Refresh</button>
                </div>

                {recentLogs.length === 0 ? (
                    <div style={{ color: "#374151", marginTop: 10 }}>No maintenance logs yet.</div>
                ) : (
                    <ul style={{ paddingLeft: 18, marginTop: 12, marginBottom: 0 }}>
                        {recentLogs.slice(0, 5).map((log) => (
                            <li key={log._id} style={{ marginBottom: 10 }}>
                                <div style={{ fontWeight: 700 }}>{log.title}</div>
                                <div style={{ fontSize: 13, color: "#374151" }}>
                                    {log.property?.nickname ? `${log.property.nickname} — ` : ""}
                                    {log.serviceDate ? new Date(log.serviceDate).toLocaleDateString() : "No service date"}
                                    {typeof log.cost === "number" ? ` • ${formatMoney(log.cost)}` : ""}
                                </div>
                                <Link to={`/properties/${log.property?._id || log.property}/maintenance`} style={{ fontSize: 13 }}>
                                    View maintenance
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {/* ===== Reminders Section ===== */}
            <section
                style={{
                    padding: 16,
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    background: "#fff",
                }}
            >
                <h3 style={{ marginTop: 0 }}>Upcoming Maintenance</h3>

                {overdue.length === 0 && upcoming.length === 0 ? (
                    <div style={{ color: "#374151" }}>No upcoming or overdue maintenance in the next 30 days 🎉</div>
                ) : (
                    <div style={{ display: "grid", gap: 16 }}>
                        {overdue.length > 0 && (
                            <div>
                                <div style={{ fontWeight: 700, color: "#b91c1c", marginBottom: 6 }}>Overdue</div>
                                <ReminderList items={overdue} />
                            </div>
                        )}

                        {upcoming.length > 0 && (
                            <div>
                                <div style={{ fontWeight: 700, color: "#92400e", marginBottom: 6 }}>Due Soon</div>
                                <ReminderList items={upcoming} />
                            </div>
                        )}
                    </div>
                )}
            </section>
        </div>
    );
}

/* ================= Helpers ================= */

function formatMoney(value) {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return "—";
    return `$${n.toFixed(2)}`;
}

function SummaryCard({ label, value }) {
    return (
        <div style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff" }}>
            <div style={{ fontSize: 13, opacity: 0.7 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
        </div>
    );
}

function ReminderList({ items }) {
    return (
        <ul style={{ paddingLeft: 18, margin: 0 }}>
            {items.map((log) => (
                <li key={log._id} style={{ marginBottom: 8 }}>
                    <div style={{ fontWeight: 600 }}>{log.title}</div>
                    <div style={{ fontSize: 13, color: "#374151" }}>
                        Due {log.nextDueDate ? new Date(log.nextDueDate).toLocaleDateString() : "—"}
                    </div>

                    <Link to={`/properties/${log.property}/maintenance`} style={{ fontSize: 13 }}>
                        View maintenance
                    </Link>
                </li>
            ))}
        </ul>
    );
}

/**
 * Tiny dependency-free sparkline.
 * values: number[]
 */
function Sparkline({ values }) {
    const w = 220;
    const h = 50;
    const pad = 4;

    const max = Math.max(...values, 0);
    const min = Math.min(...values, 0);
    const range = max - min || 1;

    const points = values
        .map((v, i) => {
            const x = pad + (i * (w - pad * 2)) / Math.max(values.length - 1, 1);
            const y = h - pad - ((v - min) * (h - pad * 2)) / range;
            return `${x},${y}`;
        })
        .join(" ");

    return (
        <svg width="100%" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Spend sparkline">
            <polyline fill="none" stroke="currentColor" strokeWidth="2" points={points} />
        </svg>
    );
}
