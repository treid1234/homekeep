import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../services/api";

function money(n) {
    const num = typeof n === "number" ? n : Number(n || 0);
    return num.toLocaleString(undefined, { style: "currency", currency: "CAD" });
}

function Icon({ name, size = 18 }) {
    const common = {
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "none",
        xmlns: "http://www.w3.org/2000/svg"
    };

    if (name === "wallet") {
        return (
            <svg {...common}>
                <path d="M3 7.5V6.5C3 5.4 3.9 4.5 5 4.5H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path
                    d="M3 7.5C3 6.4 3.9 5.5 5 5.5H19.5C20.6 5.5 21.5 6.4 21.5 7.5V17.5C21.5 18.6 20.6 19.5 19.5 19.5H5C3.9 19.5 3 18.6 3 17.5V7.5Z"
                    stroke="currentColor"
                    strokeWidth="2"
                />
                <path d="M16.5 12H19.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
        );
    }

    if (name === "spark") {
        return (
            <svg {...common}>
                <path
                    d="M12 2l1.1 4.2L17.3 7.3l-4.2 1.1L12 12.6l-1.1-4.2L6.7 7.3l4.2-1.1L12 2Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                />
                <path
                    d="M19 13l.7 2.6 2.3.7-2.3.7L19 19l-.7-2.6-2.3-.7 2.3-.7L19 13Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                />
            </svg>
        );
    }

    if (name === "tool") {
        return (
            <svg {...common}>
                <path
                    d="M21 7.5a5.5 5.5 0 0 1-7.6 5.1L6.8 19.2a2 2 0 0 1-2.8 0l-.2-.2a2 2 0 0 1 0-2.8l6.6-6.6A5.5 5.5 0 0 1 21 7.5Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                />
                <path d="M15.5 6.5l2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
        );
    }

    if (name === "home") {
        return (
            <svg {...common}>
                <path
                    d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-9.5Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                />
            </svg>
        );
    }

    return null;
}

function Sparkline({ series, width = 240, height = 48 }) {
    // series: [{date:"YYYY-MM-DD", total:number}, ...]
    const values = (series || []).map((d) => Number(d.total) || 0);

    if (!values.length) return null;

    const max = Math.max(...values);
    const min = Math.min(...values);

    // If all values are same (e.g., all 0), draw a flat line in the middle
    const range = max - min || 1;

    const pad = 4;
    const w = width;
    const h = height;

    const points = values.map((v, i) => {
        const x = pad + (i * (w - pad * 2)) / (values.length - 1 || 1);
        const y = pad + (h - pad * 2) * (1 - (v - min) / range);
        return [x, y];
    });

    const d = points
        .map(([x, y], idx) => (idx === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : `L ${x.toFixed(2)} ${y.toFixed(2)}`))
        .join(" ");

    // Fill area under line
    const area = `${d} L ${points[points.length - 1][0].toFixed(2)} ${(h - pad).toFixed(2)} L ${points[0][0].toFixed(2)} ${(h - pad).toFixed(2)} Z`;

    const last = values[values.length - 1];
    const lastLabel = last > 0 ? `Last: ${money(last)}` : "No spend today";

    return (
        <div style={{ marginTop: 10 }}>
            <svg width={w} height={h} role="img" aria-label="Spending trend sparkline">
                <path d={area} fill="currentColor" opacity="0.10" />
                <path d={d} stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                {/* last point */}
                <circle
                    cx={points[points.length - 1][0]}
                    cy={points[points.length - 1][1]}
                    r="3.5"
                    fill="currentColor"
                    opacity="0.9"
                />
            </svg>

            <div style={{ fontSize: 12.5, opacity: 0.75, marginTop: 4 }}>{lastLabel}</div>
        </div>
    );
}

function StatCard({ title, value, subtitle, tone = "teal", icon, children }) {
    const tones = {
        teal: { bg: "#ecfeff", border: "#06b6d4", text: "#0f766e" },
        purple: { bg: "#f5f3ff", border: "#8b5cf6", text: "#6d28d9" },
        amber: { bg: "#fffbeb", border: "#f59e0b", text: "#b45309" },
        rose: { bg: "#fff1f2", border: "#fb7185", text: "#be123c" }
    };

    const t = tones[tone] || tones.teal;

    return (
        <div
            style={{
                border: `1px solid ${t.border}33`,
                background: `linear-gradient(180deg, ${t.bg} 0%, #ffffff 85%)`,
                borderRadius: 14,
                padding: 14,
                boxShadow: "0 6px 20px rgba(0,0,0,0.06)"
            }}
        >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 650, color: "#111827", opacity: 0.85 }}>{title}</div>

                <div
                    style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        display: "grid",
                        placeItems: "center",
                        background: "#ffffff",
                        border: `1px solid ${t.border}33`,
                        color: t.text
                    }}
                    aria-hidden="true"
                >
                    <Icon name={icon} size={18} />
                </div>
            </div>

            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8, color: "#111827", letterSpacing: "-0.02em" }}>
                {value}
            </div>

            {subtitle ? (
                <div style={{ fontSize: 12.5, marginTop: 6, color: "#374151", opacity: 0.8 }}>{subtitle}</div>
            ) : null}

            {children ? <div style={{ marginTop: 8, color: t.text }}>{children}</div> : null}
        </div>
    );
}

function Chip({ children }) {
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 10px",
                borderRadius: 999,
                fontSize: 12.5,
                border: "1px solid #e5e7eb",
                background: "#fff",
                color: "#374151"
            }}
        >
            {children}
        </span>
    );
}

export default function DashboardPage() {
    const { user, token } = useAuth();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [totals, setTotals] = useState({ month: 0, year: 0 });
    const [recent, setRecent] = useState([]);
    const [dailySpend, setDailySpend] = useState([]);

    const { monthLabel, yearLabel } = useMemo(() => {
        const now = new Date();
        const month = now.toLocaleString(undefined, { month: "long" });
        const year = now.getFullYear();
        return { monthLabel: month, yearLabel: String(year) };
    }, []);

    async function load() {
        setLoading(true);
        setError("");
        try {
            const res = await api.dashboardSummary(token);
            setTotals(res.data.totals || { month: 0, year: 0 });
            setRecent(res.data.recentLogs || []);
            setDailySpend(res.data.dailySpend || []);
        } catch (err) {
            setError(err.message || "Could not load dashboard.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div>
                    <h2 style={{ marginBottom: 6 }}>Dashboard</h2>
                    <div style={{ color: "#374151", opacity: 0.9 }}>
                        Welcome back, <strong>{user?.name}</strong>
                    </div>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <Link
                        to="/properties"
                        style={{
                            display: "inline-flex",
                            gap: 8,
                            alignItems: "center",
                            padding: "8px 12px",
                            borderRadius: 10,
                            border: "1px solid #e5e7eb",
                            textDecoration: "none",
                            color: "#111827",
                            background: "#fff"
                        }}
                    >
                        <Icon name="home" size={18} />
                        Properties
                    </Link>

                    <button
                        onClick={load}
                        disabled={loading}
                        style={{
                            padding: "8px 12px",
                            borderRadius: 10,
                            border: "1px solid #e5e7eb",
                            background: loading ? "#f9fafb" : "#111827",
                            color: loading ? "#6b7280" : "#fff",
                            cursor: loading ? "not-allowed" : "pointer"
                        }}
                    >
                        Refresh
                    </button>
                </div>
            </div>

            {error ? (
                <div
                    style={{
                        marginTop: 12,
                        padding: 12,
                        borderRadius: 12,
                        background: "#fff1f2",
                        border: "1px solid #fecdd3",
                        color: "#9f1239"
                    }}
                >
                    {error}
                </div>
            ) : null}

            <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Chip>Auth secured</Chip>
                <Chip>MongoDB + API</Chip>
                <Chip>Properties + Maintenance</Chip>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16, alignItems: "start" }}>
                <div style={{ display: "grid", gap: 12 }}>
                    <StatCard
                        title={`Spending • ${monthLabel}`}
                        value={loading ? "—" : money(totals.month)}
                        subtitle="Last 30 days trend (daily totals)."
                        tone="teal"
                        icon="wallet"
                    >
                        <Sparkline series={dailySpend} />
                    </StatCard>

                    <StatCard
                        title={`Spending • ${yearLabel}`}
                        value={loading ? "—" : money(totals.year)}
                        subtitle="Total maintenance costs logged this year."
                        tone="purple"
                        icon="spark"
                    />
                </div>

                <section
                    style={{
                        padding: 14,
                        border: "1px solid #e5e7eb",
                        borderRadius: 14,
                        background: "linear-gradient(180deg, #ffffff 0%, #ffffff 60%, #f9fafb 100%)",
                        boxShadow: "0 6px 20px rgba(0,0,0,0.06)"
                    }}
                >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                        <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ color: "#1f2937" }}>
                                <Icon name="tool" />
                            </span>
                            Recent maintenance
                        </h3>

                        <Link to="/properties" style={{ fontSize: 13, color: "#4b5563" }}>
                            Add entries →
                        </Link>
                    </div>

                    <div style={{ height: 1, background: "#e5e7eb", margin: "12px 0" }} />

                    {loading ? (
                        <div style={{ color: "#6b7280" }}>Loading…</div>
                    ) : recent.length === 0 ? (
                        <div style={{ color: "#374151" }}>
                            No maintenance entries yet. Add one from your <Link to="/properties">Properties</Link> page.
                        </div>
                    ) : (
                        <div style={{ display: "grid", gap: 10 }}>
                            {recent.map((log) => {
                                const propName = log.property?.nickname || "Property";
                                const dateStr = log.serviceDate ? new Date(log.serviceDate).toLocaleDateString() : "";
                                const costStr = typeof log.cost === "number" ? money(log.cost) : money(0);

                                return (
                                    <div
                                        key={log._id}
                                        style={{
                                            padding: 12,
                                            borderRadius: 12,
                                            border: "1px solid #e5e7eb",
                                            background: "#ffffff"
                                        }}
                                    >
                                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                                            <div style={{ fontWeight: 750, color: "#111827" }}>{log.title}</div>
                                            <div style={{ fontWeight: 800, color: "#111827" }}>{costStr}</div>
                                        </div>

                                        <div style={{ marginTop: 6, fontSize: 13.5, color: "#374151", opacity: 0.9 }}>
                                            {propName} • {log.category} • {dateStr}
                                        </div>

                                        {(log.vendor || log.notes) ? (
                                            <div style={{ marginTop: 6, fontSize: 13, color: "#6b7280", lineHeight: 1.35 }}>
                                                {log.vendor ? `Vendor: ${log.vendor}` : ""}
                                                {log.vendor && log.notes ? " • " : ""}
                                                {log.notes ? log.notes : ""}
                                            </div>
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}

