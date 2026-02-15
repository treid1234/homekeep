import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext.jsx";

function money(n) {
    const num = typeof n === "number" && Number.isFinite(n) ? n : 0;
    return num.toLocaleString(undefined, { style: "currency", currency: "CAD" });
}

function safeDateLabel(d) {
    if (!d) return "";
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toLocaleDateString();
}

function getMonthNameFromISODate(isoDate) {
    if (!isoDate) return "";
    const dt = new Date(`${isoDate}T00:00:00.000Z`);
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function reminderBadge(reminderStatus, dueInDays) {
    const base = {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(255,255,255,0.06)",
        whiteSpace: "nowrap",
    };

    if (reminderStatus === "overdue") {
        return { ...base, border: "1px solid rgba(255, 80, 80, 0.35)", background: "rgba(255, 80, 80, 0.10)" };
    }
    if (reminderStatus === "dueSoon") {
        return { ...base, border: "1px solid rgba(255, 200, 80, 0.35)", background: "rgba(255, 200, 80, 0.10)" };
    }
    return { ...base, border: "1px solid rgba(120, 255, 180, 0.35)", background: "rgba(120, 255, 180, 0.10)" };
}

export default function DashboardPage() {
    const { token } = useAuth();

    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState("");
    const [data, setData] = useState(null);

    const [remindersLoading, setRemindersLoading] = useState(true);
    const [remindersError, setRemindersError] = useState("");
    const [upcoming, setUpcoming] = useState([]);
    const [reminderActionMsg, setReminderActionMsg] = useState("");
    const [reminderBusyById, setReminderBusyById] = useState({});

    async function loadDashboard() {
        const res = await api.dashboardSummary(token);
        setData(res?.data || null);
    }

    async function loadUpcomingReminders() {
        setRemindersLoading(true);
        setRemindersError("");
        try {
            const res = await api.upcomingReminders(token, { windowDays: 30 });
            const list = res?.data?.reminders || [];
            setUpcoming(Array.isArray(list) ? list : []);
        } catch (err) {
            setRemindersError(err?.message || "Failed to load reminders.");
            setUpcoming([]);
        } finally {
            setRemindersLoading(false);
        }
    }

    async function load() {
        setLoading(true);
        setPageError("");
        setReminderActionMsg("");
        try {
            await Promise.all([loadDashboard(), loadUpcomingReminders()]);
        } catch (err) {
            setPageError(err?.message || "Failed to load dashboard.");
            setData(null);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const totals = data?.totals || {};
    const recentLogs = Array.isArray(data?.recentLogs) ? data.recentLogs : [];
    const byCategory = Array.isArray(data?.byCategory) ? data.byCategory : [];
    const byProperty = Array.isArray(data?.byProperty) ? data.byProperty : [];
    const topVendors = Array.isArray(data?.topVendors) ? data.topVendors : [];
    const remindersSummary = data?.remindersSummary || {};
    const dailySpend = Array.isArray(data?.dailySpend) ? data.dailySpend : [];

    const maxDailySpend = useMemo(() => {
        if (!dailySpend.length) return 0;
        return Math.max(...dailySpend.map((d) => Number(d?.total || 0)));
    }, [dailySpend]);

    async function handleSnooze(logId, days) {
        setReminderActionMsg("");
        setReminderBusyById((p) => ({ ...p, [logId]: true }));
        try {
            await api.snoozeReminder(logId, token, { days });
            setReminderActionMsg(`Snoozed ${days} days ✅`);
            await Promise.all([loadDashboard(), loadUpcomingReminders()]);
        } catch (err) {
            setReminderActionMsg(err?.message || "Snooze failed.");
        } finally {
            setReminderBusyById((p) => ({ ...p, [logId]: false }));
        }
    }

    async function handleComplete(logId) {
        setReminderActionMsg("");
        setReminderBusyById((p) => ({ ...p, [logId]: true }));
        try {
            await api.completeReminder(logId, token);
            setReminderActionMsg("Marked complete ✅");
            await Promise.all([loadDashboard(), loadUpcomingReminders()]);
        } catch (err) {
            setReminderActionMsg(err?.message || "Complete failed.");
        } finally {
            setReminderBusyById((p) => ({ ...p, [logId]: false }));
        }
    }

    return (
        <div className="hk-container">
            <div className="hk-header">
                <div>
                    <h2 className="hk-title">Dashboard</h2>
                    <p className="hk-subtitle">
                        A quick snapshot of spending, activity, and where costs are going.
                    </p>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <button className="hk-btn" type="button" onClick={load} disabled={loading}>
                        {loading ? "Refreshing…" : "Refresh"}
                    </button>
                    <Link className="hk-link" to="/properties">
                        View properties →
                    </Link>
                </div>
            </div>

            {pageError && <div className="hk-error">{pageError}</div>}

            {loading ? (
                <div className="hk-muted">Loading…</div>
            ) : !data ? (
                <div className="hk-muted">No dashboard data yet.</div>
            ) : (
                <>
                    {/* Top cards */}
                    <div className="hk-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                        <div className="hk-card hk-card-pad">
                            <div className="hk-muted" style={{ fontSize: 13, fontWeight: 800 }}>
                                This month
                            </div>
                            <div style={{ fontSize: 26, fontWeight: 900 }}>{money(totals.month)}</div>
                        </div>

                        <div className="hk-card hk-card-pad">
                            <div className="hk-muted" style={{ fontSize: 13, fontWeight: 800 }}>
                                This year
                            </div>
                            <div style={{ fontSize: 26, fontWeight: 900 }}>{money(totals.year)}</div>
                        </div>

                        <div className="hk-card hk-card-pad">
                            <div className="hk-muted" style={{ fontSize: 13, fontWeight: 800 }}>
                                All time
                            </div>
                            <div style={{ fontSize: 26, fontWeight: 900 }}>{money(totals.allTime)}</div>
                        </div>
                    </div>

                    {/* Property overview */}
                    <div className="hk-card hk-card-pad" style={{ marginTop: 12 }}>
                        <div className="hk-row" style={{ marginBottom: 10 }}>
                            <div>
                                <div style={{ fontWeight: 900 }}>Property overview</div>
                                <div className="hk-muted" style={{ fontSize: 13 }}>
                                    Spend + activity by property
                                </div>
                            </div>
                            <Link className="hk-link" to="/properties">
                                Manage →
                            </Link>
                        </div>

                        {!byProperty.length ? (
                            <div className="hk-muted">No property stats yet.</div>
                        ) : (
                            <div className="hk-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                                {byProperty.map((p) => (
                                    <div key={p.propertyId} className="hk-card hk-card-pad">
                                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
                                            <div>
                                                <div style={{ fontWeight: 900, fontSize: 16 }}>{p.nickname || "Property"}</div>
                                                <div className="hk-muted" style={{ fontSize: 12 }}>
                                                    {p.city ? `${p.city}, ` : ""}
                                                    {p.province || ""}
                                                </div>
                                            </div>

                                            <span className="hk-pill" style={{ fontSize: 12 }}>
                                                {Number(p.count || 0)} log{Number(p.count || 0) === 1 ? "" : "s"}
                                            </span>
                                        </div>

                                        <div style={{ marginTop: 10, fontSize: 22, fontWeight: 900 }}>{money(p.total)}</div>

                                        <div style={{ marginTop: 10 }}>
                                            <Link className="hk-link" to={`/properties/${p.propertyId}/maintenance`}>
                                                Open maintenance →
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Reminders + Daily spend */}
                    <div className="hk-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                        <div className="hk-card hk-card-pad">
                            <div className="hk-row" style={{ marginBottom: 8 }}>
                                <div>
                                    <div style={{ fontWeight: 900 }}>Reminders</div>
                                    <div className="hk-muted" style={{ fontSize: 13 }}>
                                        Window: {remindersSummary.windowDays || 30} days
                                    </div>
                                </div>
                                <Link className="hk-link" to="/properties">
                                    Go →
                                </Link>
                            </div>

                            <div style={{ display: "flex", gap: 12 }}>
                                <div className="hk-card hk-card-pad" style={{ flex: 1 }}>
                                    <div className="hk-muted" style={{ fontSize: 13, fontWeight: 800 }}>
                                        Overdue
                                    </div>
                                    <div style={{ fontSize: 22, fontWeight: 900 }}>
                                        {Number(remindersSummary.overdueCount || 0)}
                                    </div>
                                </div>

                                <div className="hk-card hk-card-pad" style={{ flex: 1 }}>
                                    <div className="hk-muted" style={{ fontSize: 13, fontWeight: 800 }}>
                                        Upcoming
                                    </div>
                                    <div style={{ fontSize: 22, fontWeight: 900 }}>
                                        {Number(remindersSummary.upcomingCount || 0)}
                                    </div>
                                </div>
                            </div>

                            {/* Upcoming reminders list */}
                            <div style={{ marginTop: 12 }}>
                                <div className="hk-row" style={{ marginBottom: 8 }}>
                                    <div className="hk-muted" style={{ fontSize: 13, fontWeight: 900 }}>
                                        Upcoming reminders
                                    </div>
                                    <button className="hk-btn" type="button" onClick={loadUpcomingReminders} disabled={remindersLoading}>
                                        {remindersLoading ? "Loading…" : "Refresh"}
                                    </button>
                                </div>

                                {reminderActionMsg && (
                                    <div className={reminderActionMsg.includes("✅") ? "hk-muted" : "hk-error"} style={{ marginBottom: 10 }}>
                                        {reminderActionMsg}
                                    </div>
                                )}

                                {remindersError ? (
                                    <div className="hk-error" style={{ fontSize: 13 }}>{remindersError}</div>
                                ) : remindersLoading ? (
                                    <div className="hk-muted">Loading reminders…</div>
                                ) : upcoming.length === 0 ? (
                                    <div className="hk-muted" style={{ fontSize: 13 }}>
                                        No upcoming reminders yet. Add a <strong>Next due date</strong> on a maintenance log and keep reminders enabled.
                                    </div>
                                ) : (
                                    <ul className="hk-list" style={{ marginTop: 0 }}>
                                        {upcoming.slice(0, 6).map((r) => {
                                            const busy = !!reminderBusyById[r._id];
                                            const status = r.reminderStatus || "future";
                                            const badgeText =
                                                status === "overdue"
                                                    ? `Overdue (${Math.abs(Number(r.dueInDays || 0))}d)`
                                                    : status === "dueSoon"
                                                        ? `Due soon (${Number(r.dueInDays || 0)}d)`
                                                        : `Upcoming (${Number(r.dueInDays || 0)}d)`;

                                            return (
                                                <li key={r._id} style={{ marginBottom: 10 }}>
                                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                                                                <div style={{ fontWeight: 900 }}>{r.title || "Reminder"}</div>
                                                                <span style={reminderBadge(status, r.dueInDays)}>{badgeText}</span>
                                                            </div>

                                                            <div className="hk-muted" style={{ fontSize: 12, marginTop: 4 }}>
                                                                {r.property?.nickname ? `${r.property.nickname} • ` : ""}
                                                                {r.category ? `${r.category} • ` : ""}
                                                                {r.vendor ? `${r.vendor} • ` : ""}
                                                                Due: {r.nextDueDate ? safeDateLabel(r.nextDueDate) : "—"}
                                                            </div>

                                                            <div style={{ marginTop: 6 }}>
                                                                {r.property?._id ? (
                                                                    <Link className="hk-link" to={`/properties/${r.property._id}/maintenance`}>
                                                                        Open maintenance →
                                                                    </Link>
                                                                ) : (
                                                                    <span className="hk-muted" style={{ fontSize: 12 }}>
                                                                        (Property link unavailable)
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div style={{ display: "flex", gap: 8 }}>
                                                            <button
                                                                type="button"
                                                                className="hk-btn"
                                                                disabled={busy}
                                                                onClick={() => handleSnooze(r._id, 7)}
                                                            >
                                                                {busy ? "Working…" : "Snooze 7d"}
                                                            </button>

                                                            <button
                                                                type="button"
                                                                className="hk-btn"
                                                                disabled={busy}
                                                                onClick={() => handleComplete(r._id)}
                                                            >
                                                                {busy ? "Working…" : "Complete"}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        </div>

                        {/* Daily spend */}
                        <div className="hk-card hk-card-pad">
                            <div className="hk-row" style={{ marginBottom: 8 }}>
                                <div>
                                    <div style={{ fontWeight: 900 }}>Daily spend</div>
                                    <div className="hk-muted" style={{ fontSize: 13 }}>
                                        Last {dailySpend.length || 0} days
                                    </div>
                                </div>
                            </div>

                            {!dailySpend.length ? (
                                <div className="hk-muted">No daily spend data.</div>
                            ) : (
                                <div style={{ display: "grid", gap: 6 }}>
                                    {dailySpend.slice(-14).map((d) => {
                                        const total = Number(d?.total || 0);
                                        const pct = maxDailySpend > 0 ? Math.round((total / maxDailySpend) * 100) : 0;

                                        return (
                                            <div
                                                key={d.date}
                                                style={{
                                                    display: "grid",
                                                    gridTemplateColumns: "80px 1fr 90px",
                                                    gap: 10,
                                                    alignItems: "center",
                                                }}
                                            >
                                                <div className="hk-muted" style={{ fontSize: 12 }}>
                                                    {getMonthNameFromISODate(d.date)}
                                                </div>

                                                <div style={{ height: 10, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                                                    <div style={{ height: "100%", width: `${pct}%`, borderRadius: 999, background: "rgba(255,255,255,0.45)" }} />
                                                </div>

                                                <div style={{ fontSize: 12, textAlign: "right" }}>{money(total)}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Recent logs */}
                    <div className="hk-card hk-card-pad" style={{ marginTop: 12 }}>
                        <div className="hk-row" style={{ marginBottom: 10 }}>
                            <div>
                                <div style={{ fontWeight: 900 }}>Recent logs</div>
                                <div className="hk-muted" style={{ fontSize: 13 }}>
                                    Latest activity across your properties
                                </div>
                            </div>
                            <Link className="hk-link" to="/properties">
                                View all →
                            </Link>
                        </div>

                        {recentLogs.length === 0 ? (
                            <div className="hk-muted">No logs yet.</div>
                        ) : (
                            <ul className="hk-list" style={{ marginTop: 0 }}>
                                {recentLogs.slice(0, 8).map((log) => (
                                    <li key={log._id} style={{ marginBottom: 10 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                                            <div>
                                                <div style={{ fontWeight: 900 }}>{log.title}</div>
                                                <div className="hk-muted" style={{ fontSize: 12 }}>
                                                    {log.property?.nickname ? `${log.property.nickname} • ` : ""}
                                                    {log.category ? `${log.category} • ` : ""}
                                                    {log.vendor ? `${log.vendor} • ` : ""}
                                                    {log.serviceDate ? safeDateLabel(log.serviceDate) : ""}
                                                </div>
                                            </div>
                                            <div style={{ fontWeight: 900 }}>{money(log.cost)}</div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Category + Vendors */}
                    <div className="hk-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                        <div className="hk-card hk-card-pad">
                            <div style={{ fontWeight: 900, marginBottom: 10 }}>Spend by category</div>
                            {!byCategory.length ? (
                                <div className="hk-muted">No category breakdown yet.</div>
                            ) : (
                                <ul className="hk-list" style={{ marginTop: 0 }}>
                                    {byCategory.map((c) => (
                                        <li key={c.category} style={{ marginBottom: 10 }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                                                <div>
                                                    <div style={{ fontWeight: 900 }}>{c.category || "Uncategorized"}</div>
                                                    <div className="hk-muted" style={{ fontSize: 12 }}>
                                                        {Number(c.count || 0)} log{Number(c.count || 0) === 1 ? "" : "s"}
                                                    </div>
                                                </div>
                                                <div style={{ fontWeight: 900 }}>{money(c.total)}</div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="hk-card hk-card-pad">
                            <div style={{ fontWeight: 900, marginBottom: 10 }}>Top vendors</div>
                            {!topVendors.length ? (
                                <div className="hk-muted">No vendor stats yet.</div>
                            ) : (
                                <ul className="hk-list" style={{ marginTop: 0 }}>
                                    {topVendors.map((v) => (
                                        <li key={v.vendor} style={{ marginBottom: 10 }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                                                <div>
                                                    <div style={{ fontWeight: 900 }}>{v.vendor || "Unknown"}</div>
                                                    <div className="hk-muted" style={{ fontSize: 12 }}>
                                                        {Number(v.count || 0)} log{Number(v.count || 0) === 1 ? "" : "s"}
                                                    </div>
                                                </div>
                                                <div style={{ fontWeight: 900 }}>{money(v.total)}</div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
