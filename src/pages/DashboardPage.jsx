import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext.jsx";

function safeDateLabel(d) {
    if (!d) return "";
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toLocaleDateString();
}

function money(n) {
    const num = typeof n === "number" && Number.isFinite(n) ? n : 0;
    return num.toLocaleString(undefined, { style: "currency", currency: "CAD" });
}

function pickDashboardData(s) {
    // supports:
    // 1) { success:true, data:{...} }
    // 2) older shapes where fields are at root
    return s?.data?.data || s?.data || s || null;
}

function exportCSV(filename, rows) {
    const safe = Array.isArray(rows) ? rows : [];
    if (safe.length === 0) return;

    const headers = Object.keys(safe[0]);
    const escape = (v) => {
        const s = v === null || v === undefined ? "" : String(v);
        const needs = /[",\n]/.test(s);
        const cleaned = s.replace(/"/g, '""');
        return needs ? `"${cleaned}"` : cleaned;
    };

    const lines = [headers.join(","), ...safe.map((r) => headers.map((h) => escape(r[h])).join(","))];

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
}

function Modal({ open, title, children, onClose }) {
    if (!open) return null;
    return (
        <div
            role="dialog"
            aria-modal="true"
            onClick={onClose}
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.55)",
                display: "grid",
                placeItems: "center",
                padding: 16,
                zIndex: 9999,
            }}
        >
            <div
                className="hk-card hk-card-pad"
                onClick={(e) => e.stopPropagation()}
                style={{ width: "min(980px, 96vw)", maxHeight: "86vh", overflow: "auto" }}
            >
                <div className="hk-row" style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
                    <button className="hk-btn hk-btn-ghost hk-btn-sm" type="button" onClick={onClose}>
                        ✕
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

async function runWithLimit(items, limit, worker) {
    const results = [];
    const queue = [...items];
    const running = new Set();

    async function launchOne() {
        const item = queue.shift();
        if (!item) return;
        const p = Promise.resolve().then(() => worker(item));
        running.add(p);

        try {
            const r = await p;
            results.push(r);
        } finally {
            running.delete(p);
        }
    }

    while (queue.length > 0 || running.size > 0) {
        while (queue.length > 0 && running.size < limit) {
            // eslint-disable-next-line no-await-in-loop
            await launchOne();
        }
        if (running.size > 0) {
            // eslint-disable-next-line no-await-in-loop
            await Promise.race(Array.from(running));
        }
    }

    return results;
}

// ---------- Daily spend chart helpers ----------
function isoDateUTC(d) {
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

function startOfDayUTC(d) {
    const dt = new Date(d);
    return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
}

function addDaysUTC(date, days) {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
}

function buildDailySeries(windowDays, dailySpend) {
    const wd = Number(windowDays);
    const safeDays = Number.isFinite(wd) ? Math.min(Math.max(wd, 7), 365) : 30;

    const now = new Date();
    const end = startOfDayUTC(now);
    const start = startOfDayUTC(addDaysUTC(end, -safeDays + 1));

    const map = new Map();
    (Array.isArray(dailySpend) ? dailySpend : []).forEach((x) => {
        const key = x?.date;
        const total = typeof x?.total === "number" ? x.total : 0;
        if (key) map.set(key, total);
    });

    const out = [];
    for (let i = 0; i < safeDays; i += 1) {
        const day = addDaysUTC(start, i);
        const key = isoDateUTC(day);
        out.push({ date: key, total: map.get(key) || 0 });
    }
    return out;
}

function Sparkline({ data, height = 140 }) {
    const w = 900; // virtual width, scales via viewBox
    const h = Math.max(90, Number(height) || 140);
    const pad = 12;

    const max = data.reduce((m, p) => Math.max(m, p.total || 0), 0);
    const min = data.reduce((m, p) => Math.min(m, p.total || 0), Number.POSITIVE_INFINITY);
    const safeMin = Number.isFinite(min) ? min : 0;
    const safeMax = Number.isFinite(max) ? max : 0;

    const range = Math.max(1, safeMax - safeMin);

    const xStep = data.length > 1 ? (w - pad * 2) / (data.length - 1) : 0;

    const points = data.map((p, i) => {
        const x = pad + i * xStep;
        const y = pad + (h - pad * 2) * (1 - (Number(p.total || 0) - safeMin) / range);
        return { x, y, total: Number(p.total || 0), date: p.date };
    });

    const d = points
        .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
        .join(" ");

    const area = `${d} L ${(pad + (data.length - 1) * xStep).toFixed(2)} ${(h - pad).toFixed(2)} L ${pad.toFixed(
        2
    )} ${(h - pad).toFixed(2)} Z`;

    const last = points[points.length - 1];
    const lastLabel = last ? `${last.date} • ${money(last.total)}` : "";

    // simple grid lines (25/50/75%)
    const gy = [0.25, 0.5, 0.75].map((t) => pad + (h - pad * 2) * t);

    return (
        <div className="hk-card hk-card-pad hk-subcard" style={{ padding: 12 }}>
            <div className="hk-muted" style={{ fontSize: 12, marginBottom: 8 }}>
                {lastLabel || "Daily spend"}
            </div>

            <svg
                viewBox={`0 0 ${w} ${h}`}
                width="100%"
                height={h}
                role="img"
                aria-label="Daily spend chart"
                style={{
                    display: "block",
                    borderRadius: 12,
                    background: "var(--hk-subcard-bg, rgba(2,6,23,0.02))",
                }}
            >
                {gy.map((y, idx) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <line
                        key={idx}
                        x1={pad}
                        x2={w - pad}
                        y1={y}
                        y2={y}
                        stroke="currentColor"
                        opacity="0.08"
                        strokeWidth="1"
                    />
                ))}

                {safeMax > 0 ? (
                    <path d={area} fill="currentColor" opacity="0.06" />
                ) : null}

                <path d={d} fill="none" stroke="currentColor" strokeWidth="3" opacity="0.65" strokeLinecap="round" />

                {last ? (
                    <>
                        <circle cx={last.x} cy={last.y} r="5" fill="currentColor" opacity="0.8" />
                    </>
                ) : null}
            </svg>

            <div className="hk-muted" style={{ fontSize: 12, marginTop: 8, display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span>
                    Min: <strong>{money(safeMin)}</strong>
                </span>
                <span>
                    Max: <strong>{money(safeMax)}</strong>
                </span>
            </div>
        </div>
    );
}

export default function DashboardPage() {
    const { token } = useAuth();

    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState("");

    const [windowDays, setWindowDays] = useState(30);

    const [summary, setSummary] = useState(null);
    const [reminders, setReminders] = useState([]);

    // Receipt counts preload
    const [docCounts, setDocCounts] = useState({}); // key: `${propertyId}:${logId}` => number

    // -------- receipts modal state --------
    const [docsOpen, setDocsOpen] = useState(false);
    const [docsBusy, setDocsBusy] = useState(false);
    const [docsError, setDocsError] = useState("");
    const [docs, setDocs] = useState([]);
    const [docsTarget, setDocsTarget] = useState(null); // { propertyId, logId, title }

    // upload to existing log
    const uploadRef = useRef(null);
    const [uploadBusy, setUploadBusy] = useState(false);
    const [uploadMsg, setUploadMsg] = useState("");
    const [uploadErr, setUploadErr] = useState("");

    async function load(nextWindowDays = windowDays) {
        setLoading(true);
        setPageError("");
        try {
            const s = await api.dashboardSummary(token, nextWindowDays);
            setSummary(pickDashboardData(s));

            const r = await api.getUpcomingReminders(token);
            const list = r?.data?.reminders || [];
            setReminders(list);

            // Preload receipt counts (limit concurrency so we don’t hammer the API)
            const jobs = list
                .map((rem) => {
                    const propertyId = rem?.property?._id || rem?.property?.id || rem?.property;
                    const logId = rem?._id;
                    if (!propertyId || !logId) return null;
                    return { propertyId, logId };
                })
                .filter(Boolean);

            const nextCounts = {};
            await runWithLimit(jobs, 5, async ({ propertyId, logId }) => {
                try {
                    const res = await api.listMaintenanceDocuments(propertyId, logId, token);
                    const docsList = res?.data?.documents || [];
                    nextCounts[`${propertyId}:${logId}`] = Array.isArray(docsList) ? docsList.length : 0;
                } catch {
                    // leave undefined if it fails; button will show “Show receipts”
                }
            });

            setDocCounts(nextCounts);
        } catch (err) {
            setPageError(err?.message || "Failed to load dashboard.");
            setSummary(null);
            setReminders([]);
            setDocCounts({});
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load(30);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const totalUpcoming = useMemo(() => reminders.length, [reminders]);

    const meta = summary?.meta || {};
    const totals = summary?.totals || {};
    const byCategory = Array.isArray(summary?.byCategory) ? summary.byCategory : [];
    const topVendors = Array.isArray(summary?.topVendors) ? summary.topVendors : [];
    const dailySpend = Array.isArray(summary?.dailySpend) ? summary.dailySpend : [];
    const insights = summary?.insights || {};

    const dailySeries = useMemo(() => buildDailySeries(meta.windowDays ?? windowDays, dailySpend), [meta.windowDays, windowDays, dailySpend]);

    const windowSpendTotal = useMemo(() => dailySeries.reduce((sum, p) => sum + (p.total || 0), 0), [dailySeries]);
    const windowAvgPerDay = useMemo(() => (dailySeries.length ? windowSpendTotal / dailySeries.length : 0), [dailySeries.length, windowSpendTotal]);

    async function openDocsForLog(rem) {
        setDocsTarget(null);
        setDocs([]);
        setDocsError("");
        setUploadMsg("");
        setUploadErr("");

        const propertyId = rem?.property?._id || rem?.property?.id || rem?.property;
        const logId = rem?._id;

        if (!propertyId || !logId) {
            setDocsError("Missing propertyId or logId on this reminder.");
            setDocsOpen(true);
            return;
        }

        setDocsTarget({ propertyId, logId, title: rem?.title || "Maintenance log" });
        setDocsOpen(true);

        setDocsBusy(true);
        try {
            const res = await api.listMaintenanceDocuments(propertyId, logId, token);
            const list = res?.data?.documents || [];
            setDocs(Array.isArray(list) ? list : []);
            setDocCounts((m) => ({ ...m, [`${propertyId}:${logId}`]: Array.isArray(list) ? list.length : 0 }));
        } catch (err) {
            setDocsError(err?.message || "Failed to load documents for this log.");
            setDocs([]);
        } finally {
            setDocsBusy(false);
        }
    }

    function closeDocs() {
        if (docsBusy || uploadBusy) return;
        setDocsOpen(false);
        setDocs([]);
        setDocsError("");
        setDocsTarget(null);
        setUploadMsg("");
        setUploadErr("");
        if (uploadRef.current) uploadRef.current.value = "";
    }

    async function handleDownload(docId) {
        if (!docsTarget) return;
        try {
            const { blob, filename } = await api.downloadMaintenanceDocument(docsTarget.propertyId, docsTarget.logId, docId, token);

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename || "document";
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            setDocsError(err?.message || "Download failed.");
        }
    }

    async function handleDeleteDoc(docId) {
        if (!docsTarget) return;
        const ok = window.confirm("Delete this document? This cannot be undone.");
        if (!ok) return;

        try {
            await api.deleteMaintenanceDocument(docsTarget.propertyId, docsTarget.logId, docId, token);
            const res = await api.listMaintenanceDocuments(docsTarget.propertyId, docsTarget.logId, token);
            const list = res?.data?.documents || [];
            setDocs(list);

            setDocCounts((m) => ({
                ...m,
                [`${docsTarget.propertyId}:${docsTarget.logId}`]: Array.isArray(list) ? list.length : 0,
            }));
        } catch (err) {
            setDocsError(err?.message || "Delete failed.");
        }
    }

    async function handleUploadToLog(file) {
        if (!docsTarget) return;

        setUploadBusy(true);
        setUploadMsg("");
        setUploadErr("");
        setDocsError("");

        try {
            const up = await api.uploadReceipt(file, token);
            const docId = up?.data?.document?._id || up?.data?.document?.id || up?.data?.documentId || null;

            if (!docId) throw new Error("Upload succeeded but no documentId returned.");

            await api.attachReceipt(docId, docsTarget.propertyId, docsTarget.logId, token);

            setUploadMsg("Receipt uploaded + attached ✅");

            const res = await api.listMaintenanceDocuments(docsTarget.propertyId, docsTarget.logId, token);
            const list = res?.data?.documents || [];
            setDocs(list);

            setDocCounts((m) => ({
                ...m,
                [`${docsTarget.propertyId}:${docsTarget.logId}`]: Array.isArray(list) ? list.length : 0,
            }));
        } catch (err) {
            setUploadErr(err?.message || "Upload failed.");
        } finally {
            setUploadBusy(false);
            if (uploadRef.current) uploadRef.current.value = "";
        }
    }

    return (
        <div className="hk-container">
            <div className="hk-header">
                <div>
                    <h2 className="hk-title">Dashboard</h2>
                    <p className="hk-subtitle">Analytics + upcoming reminders</p>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <label className="hk-label" style={{ minWidth: 180 }}>
                        Analytics window
                        <select
                            className="hk-input"
                            value={windowDays}
                            onChange={(e) => {
                                const next = Number(e.target.value);
                                setWindowDays(next);
                                load(next);
                            }}
                            disabled={loading}
                        >
                            <option value={30}>Last 30 days</option>
                            <option value={90}>Last 90 days</option>
                            <option value={365}>Last 365 days</option>
                        </select>
                    </label>

                    <Link className="hk-link" to="/properties">
                        View properties →
                    </Link>

                    <button className="hk-btn" type="button" onClick={() => load(windowDays)} disabled={loading}>
                        {loading ? "Refreshing…" : "Refresh"}
                    </button>
                </div>
            </div>

            {pageError ? <div className="hk-banner hk-banner-err">{pageError}</div> : null}

            {loading ? (
                <div className="hk-muted">Loading…</div>
            ) : (
                <>
                    <div className="hk-card hk-card-pad" style={{ marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                            <div>
                                <div style={{ fontWeight: 900, fontSize: 16 }}>Summary</div>
                                <div className="hk-muted" style={{ fontSize: 13 }}>
                                    Properties: <strong>{meta.totalProperties ?? "—"}</strong> • Logs:{" "}
                                    <strong>{meta.totalLogs ?? "—"}</strong>
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                <span className="hk-pill">This month: {money(totals.month ?? 0)}</span>
                                <span className="hk-pill">This year: {money(totals.year ?? 0)}</span>
                                <span className="hk-pill">All-time: {money(totals.allTime ?? 0)}</span>
                            </div>
                        </div>

                        <div className="hk-divider" />

                        <div className="hk-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <div className="hk-card hk-card-pad">
                                <div className="hk-muted" style={{ fontSize: 12 }}>
                                    Smart insight
                                </div>
                                <div style={{ fontWeight: 900, marginTop: 6 }}>Top category this month</div>
                                <div className="hk-muted" style={{ marginTop: 6 }}>
                                    {insights?.topCategoryThisMonth?.category
                                        ? `${insights.topCategoryThisMonth.category} • ${money(insights.topCategoryThisMonth.total || 0)}`
                                        : "No spend recorded this month yet."}
                                </div>
                            </div>

                            <div className="hk-card hk-card-pad">
                                <div className="hk-muted" style={{ fontSize: 12 }}>
                                    Smart insight
                                </div>
                                <div style={{ fontWeight: 900, marginTop: 6 }}>Biggest log (last 30 days)</div>
                                <div className="hk-muted" style={{ marginTop: 6 }}>
                                    {insights?.biggestLogLast30Days
                                        ? `${money(insights.biggestLogLast30Days.cost || 0)} • ${insights.biggestLogLast30Days.vendor || "—"} • ${safeDateLabel(
                                            insights.biggestLogLast30Days.serviceDate
                                        )}`
                                        : "No logs in the last 30 days."}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ✅ NEW: Chart section */}
                    <div className="hk-card hk-card-pad" style={{ marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                            <div>
                                <div style={{ fontWeight: 900, fontSize: 16 }}>Daily spend trend</div>
                                <div className="hk-muted" style={{ fontSize: 13 }}>
                                    Last {meta.windowDays ?? windowDays} days • Total: <strong>{money(windowSpendTotal)}</strong> • Avg/day:{" "}
                                    <strong>{money(windowAvgPerDay)}</strong>
                                </div>
                            </div>

                            <button
                                className="hk-btn hk-btn-ghost hk-btn-sm"
                                type="button"
                                onClick={() =>
                                    exportCSV(
                                        `homekeep_daily_spend_${meta.windowDays ?? windowDays}d.csv`,
                                        dailySeries.map((x) => ({ date: x.date, total: x.total }))
                                    )
                                }
                                disabled={!dailySeries.length}
                            >
                                Export CSV
                            </button>
                        </div>

                        <div className="hk-divider" />

                        <Sparkline data={dailySeries} height={150} />
                    </div>

                    <div className="hk-grid" style={{ marginBottom: 12 }}>
                        <div className="hk-card hk-card-pad">
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                                <div>
                                    <div style={{ fontWeight: 900 }}>Top categories (window)</div>
                                    <div className="hk-muted" style={{ fontSize: 13 }}>
                                        Based on last {meta.windowDays ?? windowDays} days
                                    </div>
                                </div>

                                <button
                                    className="hk-btn hk-btn-ghost hk-btn-sm"
                                    type="button"
                                    onClick={() =>
                                        exportCSV(
                                            `homekeep_by_category_${meta.windowDays ?? windowDays}d.csv`,
                                            byCategory.map((x) => ({ category: x.category, total: x.total, count: x.count }))
                                        )
                                    }
                                    disabled={!byCategory.length}
                                >
                                    Export CSV
                                </button>
                            </div>

                            <div className="hk-divider" />

                            {byCategory.length === 0 ? (
                                <div className="hk-muted">No category data yet.</div>
                            ) : (
                                <ul className="hk-list" style={{ marginTop: 0 }}>
                                    {byCategory.map((c) => (
                                        <li key={c.category}>
                                            <div className="hk-stat">
                                                <div>
                                                    <div style={{ fontWeight: 900 }}>{c.category}</div>
                                                    <div className="hk-muted" style={{ fontSize: 12 }}>
                                                        {c.count} log(s)
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
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                                <div>
                                    <div style={{ fontWeight: 900 }}>Top vendors (window)</div>
                                    <div className="hk-muted" style={{ fontSize: 13 }}>
                                        Based on last {meta.windowDays ?? windowDays} days
                                    </div>
                                </div>

                                <button
                                    className="hk-btn hk-btn-ghost hk-btn-sm"
                                    type="button"
                                    onClick={() =>
                                        exportCSV(
                                            `homekeep_top_vendors_${meta.windowDays ?? windowDays}d.csv`,
                                            topVendors.map((x) => ({ vendor: x.vendor, total: x.total, count: x.count }))
                                        )
                                    }
                                    disabled={!topVendors.length}
                                >
                                    Export CSV
                                </button>
                            </div>

                            <div className="hk-divider" />

                            {topVendors.length === 0 ? (
                                <div className="hk-muted">No vendor data yet.</div>
                            ) : (
                                <ul className="hk-list" style={{ marginTop: 0 }}>
                                    {topVendors.map((v) => (
                                        <li key={v.vendor}>
                                            <div className="hk-stat">
                                                <div>
                                                    <div style={{ fontWeight: 900 }}>{v.vendor}</div>
                                                    <div className="hk-muted" style={{ fontSize: 12 }}>
                                                        {v.count} log(s)
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

                    <div className="hk-card hk-card-pad">
                        <div className="hk-row" style={{ marginBottom: 10, display: "flex", justifyContent: "space-between", gap: 12 }}>
                            <div>
                                <div style={{ fontWeight: 900, fontSize: 16 }}>Upcoming reminders</div>
                                <div className="hk-muted" style={{ fontSize: 13 }}>
                                    “Show receipts” displays the real count (preloaded).
                                </div>
                            </div>
                            <span className="hk-pill">Reminders</span>
                        </div>

                        {reminders.length === 0 ? (
                            <div className="hk-muted">No reminders found.</div>
                        ) : (
                            <ul className="hk-list" style={{ marginTop: 0 }}>
                                {reminders.map((r) => {
                                    const propName = r?.property?.nickname || r?.property?.city || "Property";
                                    const propertyId = r?.property?._id || r?.property?.id || r?.property;
                                    const logId = r?._id;
                                    const key = propertyId && logId ? `${propertyId}:${logId}` : "";
                                    const count = key ? docCounts[key] : undefined;

                                    const label = typeof count === "number" ? `Show receipts (${count})` : "Show receipts";

                                    return (
                                        <li key={r._id} style={{ marginBottom: 12 }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                                                <div>
                                                    <div style={{ fontWeight: 900 }}>{r.title}</div>
                                                    <div className="hk-muted" style={{ fontSize: 12 }}>
                                                        {propName}
                                                        {r.nextDueDate ? ` • Due: ${safeDateLabel(r.nextDueDate)}` : ""}
                                                        {typeof r.dueInDays === "number" ? ` • In ${r.dueInDays} day(s)` : ""}
                                                    </div>
                                                </div>

                                                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                                                    <Link className="hk-link" to={`/properties/${propertyId}/maintenance`}>
                                                        Open log →
                                                    </Link>
                                                    <button className="hk-btn" type="button" onClick={() => openDocsForLog(r)}>
                                                        {label}
                                                    </button>
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>

                    <Modal open={docsOpen} title="Receipts / Documents" onClose={closeDocs}>
                        {docsTarget ? (
                            <div className="hk-muted" style={{ fontSize: 13, marginBottom: 10 }}>
                                Log: <strong>{docsTarget.title}</strong>
                            </div>
                        ) : null}

                        {docsError ? (
                            <div className="hk-banner hk-banner-err" style={{ marginBottom: 10 }}>
                                {docsError}
                            </div>
                        ) : null}
                        {uploadErr ? (
                            <div className="hk-banner hk-banner-err" style={{ marginBottom: 10 }}>
                                {uploadErr}
                            </div>
                        ) : null}
                        {uploadMsg ? <div className="hk-banner hk-banner-ok" style={{ marginBottom: 10 }}>{uploadMsg}</div> : null}

                        {docsTarget ? (
                            <div className="hk-card hk-card-pad" style={{ marginBottom: 12 }}>
                                <div style={{ fontWeight: 900, marginBottom: 6 }}>Upload receipt to this log</div>
                                <div className="hk-muted" style={{ fontSize: 13, marginBottom: 10 }}>
                                    This will upload the file, then attach it to this maintenance log.
                                </div>

                                <input
                                    ref={uploadRef}
                                    type="file"
                                    accept="application/pdf,image/*"
                                    disabled={uploadBusy}
                                    onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (!f) return;
                                        handleUploadToLog(f);
                                    }}
                                />
                                {uploadBusy ? <div className="hk-muted" style={{ marginTop: 8 }}>Uploading…</div> : null}
                            </div>
                        ) : null}

                        {docsBusy ? (
                            <div className="hk-muted">Loading documents…</div>
                        ) : docs.length === 0 ? (
                            <div className="hk-muted">No receipts/documents attached to this log yet.</div>
                        ) : (
                            <ul className="hk-list" style={{ marginTop: 0 }}>
                                {docs.map((d) => (
                                    <li key={d._id} style={{ marginBottom: 10 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                                            <div>
                                                <div style={{ fontWeight: 900 }}>{d.originalName || "Document"}</div>
                                                <div className="hk-muted" style={{ fontSize: 12 }}>
                                                    {d.createdAt ? `Uploaded: ${safeDateLabel(d.createdAt)}` : ""}
                                                    {d.size ? ` • ${Math.round(d.size / 1024)} KB` : ""}
                                                </div>
                                            </div>

                                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                                <button className="hk-btn" type="button" onClick={() => handleDownload(d._id)}>
                                                    Download / Show
                                                </button>
                                                <button className="hk-btn hk-btn-ghost" type="button" onClick={() => handleDeleteDoc(d._id)}>
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Modal>
                </>
            )}
        </div>
    );
}
