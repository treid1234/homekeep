import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
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

function safeTimeLabel(d) {
    if (!d) return "";
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toLocaleString();
}

// HTML <input type="date"> requires YYYY-MM-DD
function toDateInputValue(dateLike) {
    if (!dateLike) return "";
    const d = new Date(dateLike);
    if (Number.isNaN(d.getTime())) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

// Send ISO midnight UTC to avoid timezone drift
function fromDateInputValue(v) {
    if (!v) return null;
    return new Date(`${v}T00:00:00.000Z`).toISOString();
}

function clampStr(v, max = 220) {
    const s = typeof v === "string" ? v : "";
    if (!s) return "";
    return s.length > max ? `${s.slice(0, max)}…` : s;
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
                style={{
                    width: "min(980px, 96vw)",
                    maxHeight: "86vh",
                    overflow: "auto",
                }}
            >
                <div className="hk-row" style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
                    <button className="hk-btn" type="button" onClick={onClose}>
                        ✕
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

function Pill({ children }) {
    return (
        <span
            className="hk-pill"
            style={{
                fontSize: 12,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
            }}
        >
            {children}
        </span>
    );
}

/**
 * Receipt parsing — supports multiple backend shapes.
 * We try a bunch of likely locations so you don't have to match one exact format.
 */
function normalizeUploadReceiptResponse(res) {
    // res could be: {success, data:{document, scan}} or {success,data:{documentId, extracted}} etc
    const data = res?.data || res || {};

    const doc =
        data.document ||
        data.receipt ||
        data.file ||
        data.upload ||
        data;

    const documentId =
        doc?._id ||
        doc?.id ||
        data.documentId ||
        data.receiptId ||
        data.id ||
        null;

    const scan =
        data.scan ||
        data.extracted ||
        data.ocr ||
        data.meta ||
        doc?.scan ||
        doc?.extracted ||
        doc?.ocr ||
        null;

    const vendor = scan?.vendor || scan?.merchant || data.vendor || "";
    const totalRaw = scan?.total ?? scan?.amount ?? data.total ?? data.amount;
    const total = Number(totalRaw);
    const dateRaw = scan?.date || scan?.serviceDate || data.date || data.receiptDate;

    const summary =
        scan?.summary ||
        scan?.textSummary ||
        data.summary ||
        "";

    const createdAt = doc?.createdAt || data.createdAt || null;
    const name = doc?.originalName || doc?.filename || doc?.name || "Receipt";

    const parsedDateISO = (() => {
        if (!dateRaw) return null;
        const dt = new Date(dateRaw);
        return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
    })();

    return {
        documentId,
        name,
        createdAt,
        scan: scan || null,
        vendor: vendor || "",
        total: Number.isFinite(total) ? total : null,
        dateISO: parsedDateISO,
        summary: summary || "",
    };
}

export default function MaintenancePage() {
    const { token } = useAuth();
    const { propertyId } = useParams();

    // ---------- page state ----------
    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState("");
    const [actionMsg, setActionMsg] = useState("");

    // ---------- logs ----------
    const [logs, setLogs] = useState([]);

    // Create log (manual entry)
    const [createForm, setCreateForm] = useState({
        title: "",
        category: "General",
        vendor: "",
        serviceDate: toDateInputValue(new Date()),
        cost: "",
        notes: "",
        nextDueDate: "",
        reminderEnabled: true,
    });
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState("");

    // List controls
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState("newest"); // newest|oldest|costHigh|costLow

    // Edit modal
    const [editOpen, setEditOpen] = useState(false);
    const [editSubmitting, setEditSubmitting] = useState(false);
    const [editError, setEditError] = useState("");
    const [editTarget, setEditTarget] = useState(null);
    const [editForm, setEditForm] = useState({
        title: "",
        category: "General",
        vendor: "",
        serviceDate: "",
        cost: "",
        notes: "",
        nextDueDate: "",
        reminderEnabled: true,
    });

    // ---------- “Upload receipt → scan → create log” ----------
    const receiptFileRef = useRef(null);
    const [receiptUploading, setReceiptUploading] = useState(false);
    const [receiptUploadError, setReceiptUploadError] = useState("");
    const [receiptUploadMsg, setReceiptUploadMsg] = useState("");

    const [receiptCreateOpen, setReceiptCreateOpen] = useState(false);
    const [receiptCreateBusy, setReceiptCreateBusy] = useState(false);
    const [receiptCreateError, setReceiptCreateError] = useState("");

    const [uploadedReceipt, setUploadedReceipt] = useState(null); // normalized {documentId, vendor, total, dateISO, ...}
    const [receiptOverrides, setReceiptOverrides] = useState({
        title: "",
        category: "General",
        vendor: "",
        serviceDate: toDateInputValue(new Date()),
        cost: "",
        notes: "",
        nextDueDate: "",
        reminderEnabled: true,
    });

    // ---------- load logs ----------
    async function loadLogs() {
        setLoading(true);
        setPageError("");
        setActionMsg("");
        try {
            const res = await api.listMaintenance(propertyId, token);
            const list = res?.data?.items || res?.data?.logs || res?.data || [];
            setLogs(Array.isArray(list) ? list : []);
        } catch (err) {
            setPageError(err?.message || "Failed to load maintenance logs.");
            setLogs([]);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadLogs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [propertyId]);

    // ---------- computed ----------
    const totalSpend = useMemo(() => {
        return logs.reduce((sum, x) => sum + Number(x?.cost || 0), 0);
    }, [logs]);

    const filteredSortedLogs = useMemo(() => {
        const q = search.trim().toLowerCase();
        let arr = [...logs];

        if (q) {
            arr = arr.filter((x) => {
                const hay = [
                    x?.title,
                    x?.category,
                    x?.vendor,
                    x?.notes,
                    safeDateLabel(x?.serviceDate),
                    safeDateLabel(x?.nextDueDate),
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();
                return hay.includes(q);
            });
        }

        const numCost = (v) => (typeof v === "number" ? v : Number(v || 0));

        if (sort === "oldest") {
            arr.sort((a, b) => new Date(a?.serviceDate || 0) - new Date(b?.serviceDate || 0));
        } else if (sort === "costHigh") {
            arr.sort((a, b) => numCost(b?.cost) - numCost(a?.cost));
        } else if (sort === "costLow") {
            arr.sort((a, b) => numCost(a?.cost) - numCost(b?.cost));
        } else {
            arr.sort((a, b) => new Date(b?.serviceDate || 0) - new Date(a?.serviceDate || 0));
        }

        return arr;
    }, [logs, search, sort]);

    // ---------- helpers ----------
    function setCreateField(key, value) {
        setCreateForm((f) => ({ ...f, [key]: value }));
    }

    function setEditField(key, value) {
        setEditForm((f) => ({ ...f, [key]: value }));
    }

    function openEdit(log) {
        setEditTarget(log);
        setEditError("");
        setActionMsg("");

        setEditForm({
            title: log?.title || "",
            category: log?.category || "General",
            vendor: log?.vendor || "",
            serviceDate: toDateInputValue(log?.serviceDate) || "",
            cost: typeof log?.cost === "number" ? String(log.cost) : String(log?.cost || ""),
            notes: log?.notes || "",
            nextDueDate: toDateInputValue(log?.nextDueDate) || "",
            reminderEnabled: typeof log?.reminderEnabled === "boolean" ? log.reminderEnabled : true,
        });

        setEditOpen(true);
    }

    function closeEdit() {
        if (editSubmitting) return;
        setEditOpen(false);
        setEditTarget(null);
        setEditError("");
    }

    // ---------- CRUD logs (manual entry) ----------
    async function handleCreateManual(e) {
        e.preventDefault();
        setCreateError("");
        setActionMsg("");

        if (!createForm.title.trim()) {
            setCreateError("Title is required.");
            return;
        }
        if (!createForm.serviceDate) {
            setCreateError("Service date is required.");
            return;
        }

        const costNum = createForm.cost === "" ? 0 : Number(createForm.cost);
        if (!Number.isFinite(costNum) || costNum < 0) {
            setCreateError("Cost must be a valid number.");
            return;
        }

        const payload = {
            title: createForm.title.trim(),
            category: (createForm.category || "General").trim(),
            vendor: (createForm.vendor || "").trim(),
            serviceDate: fromDateInputValue(createForm.serviceDate),
            cost: costNum,
            notes: (createForm.notes || "").trim(),
            reminderEnabled: !!createForm.reminderEnabled,
            nextDueDate: createForm.nextDueDate ? fromDateInputValue(createForm.nextDueDate) : null,
        };

        setCreating(true);
        try {
            // matches your api.js: createMaintenance(propertyId, payload, token)
            await api.createMaintenance(propertyId, payload, token);

            setCreateForm({
                title: "",
                category: "General",
                vendor: "",
                serviceDate: toDateInputValue(new Date()),
                cost: "",
                notes: "",
                nextDueDate: "",
                reminderEnabled: true,
            });

            setActionMsg("Log created ✅");
            await loadLogs();
        } catch (err) {
            setCreateError(err?.message || "Failed to create log.");
        } finally {
            setCreating(false);
        }
    }

    async function handleSaveEdit(e) {
        e.preventDefault();
        e.stopPropagation();

        setEditError("");
        setActionMsg("");

        if (!editTarget?._id) {
            setEditError("Missing log id.");
            return;
        }
        if (!editForm.title.trim()) {
            setEditError("Title is required.");
            return;
        }
        if (!editForm.serviceDate) {
            setEditError("Service date is required.");
            return;
        }

        const costNum = editForm.cost === "" ? 0 : Number(editForm.cost);
        if (!Number.isFinite(costNum) || costNum < 0) {
            setEditError("Cost must be a valid number.");
            return;
        }

        const payload = {
            title: editForm.title.trim(),
            category: (editForm.category || "General").trim(),
            vendor: (editForm.vendor || "").trim(),
            serviceDate: fromDateInputValue(editForm.serviceDate),
            cost: costNum,
            notes: (editForm.notes || "").trim(),
            reminderEnabled: !!editForm.reminderEnabled,
            nextDueDate: editForm.nextDueDate ? fromDateInputValue(editForm.nextDueDate) : null,
        };

        setEditSubmitting(true);
        try {
            await api.updateMaintenanceLog(propertyId, editTarget._id, payload, token);
            setActionMsg("Log updated ✅");
            setEditOpen(false);
            setEditTarget(null);
            await loadLogs();
        } catch (err) {
            setEditError(err?.message || "Failed to update log.");
        } finally {
            setEditSubmitting(false);
        }
    }

    async function handleDelete(logId) {
        setActionMsg("");
        setPageError("");

        const ok = window.confirm("Delete this maintenance log? This cannot be undone.");
        if (!ok) return;

        try {
            await api.deleteMaintenanceLog(propertyId, logId, token);
            setActionMsg("Log deleted ✅");
            await loadLogs();
        } catch (err) {
            setPageError(err?.message || "Failed to delete log.");
        }
    }

    // ---------- RECEIPT FLOW (restored): Upload receipt -> Scan -> Open override modal -> Create log ----------
    async function handleUploadReceiptFile(file) {
        setReceiptUploading(true);
        setReceiptUploadError("");
        setReceiptUploadMsg("");
        setReceiptCreateError("");
        setActionMsg("");

        try {
            const res = await api.uploadReceipt(file, token);
            const normalized = normalizeUploadReceiptResponse(res);

            if (!normalized.documentId) {
                throw new Error(
                    "Receipt uploaded but no documentId returned. Check backend uploadReceipt response."
                );
            }

            setUploadedReceipt(normalized);

            // Prefill overrides from scan
            const vendor = normalized.vendor || "";
            const total = normalized.total;
            const dateISO = normalized.dateISO;

            setReceiptOverrides({
                title: vendor ? `Receipt: ${vendor}` : "Receipt entry",
                category: "General",
                vendor,
                serviceDate: dateISO ? toDateInputValue(dateISO) : toDateInputValue(new Date()),
                cost: total !== null ? String(total) : "",
                notes: normalized.summary || "",
                nextDueDate: "",
                reminderEnabled: true,
            });

            setReceiptUploadMsg("Receipt uploaded + scanned ✅ Review and create the entry below.");
            setReceiptCreateOpen(true);
        } catch (err) {
            setReceiptUploadError(err?.message || "Failed to upload receipt.");
        } finally {
            setReceiptUploading(false);
            if (receiptFileRef.current) receiptFileRef.current.value = "";
        }
    }

    function closeReceiptCreate() {
        if (receiptCreateBusy) return;
        setReceiptCreateOpen(false);
        setReceiptCreateError("");
    }

    function setReceiptField(key, value) {
        setReceiptOverrides((f) => ({ ...f, [key]: value }));
    }

    async function handleCreateLogFromReceipt() {
        setReceiptCreateError("");
        setActionMsg("");

        const rid = uploadedReceipt?.documentId;
        if (!rid) {
            setReceiptCreateError("Missing receipt documentId.");
            return;
        }

        if (!receiptOverrides.title.trim()) {
            setReceiptCreateError("Title is required.");
            return;
        }
        if (!receiptOverrides.serviceDate) {
            setReceiptCreateError("Service date is required.");
            return;
        }

        const costNum = receiptOverrides.cost === "" ? 0 : Number(receiptOverrides.cost);
        if (!Number.isFinite(costNum) || costNum < 0) {
            setReceiptCreateError("Cost must be a valid number.");
            return;
        }

        const overrides = {
            title: receiptOverrides.title.trim(),
            category: (receiptOverrides.category || "General").trim(),
            vendor: (receiptOverrides.vendor || "").trim(),
            serviceDate: fromDateInputValue(receiptOverrides.serviceDate),
            cost: costNum,
            notes: (receiptOverrides.notes || "").trim(),
            reminderEnabled: !!receiptOverrides.reminderEnabled,
            nextDueDate: receiptOverrides.nextDueDate ? fromDateInputValue(receiptOverrides.nextDueDate) : null,
        };

        setReceiptCreateBusy(true);
        try {
            await api.createLogFromReceipt(rid, propertyId, overrides, token);
            setActionMsg("Entry created from receipt ✅");
            setReceiptCreateOpen(false);
            setUploadedReceipt(null);
            await loadLogs();
        } catch (err) {
            setReceiptCreateError(err?.message || "Failed to create entry from receipt.");
        } finally {
            setReceiptCreateBusy(false);
        }
    }

    return (
        <div className="hk-container">
            <div className="hk-header">
                <div>
                    <h2 className="hk-title">Maintenance</h2>
                    <p className="hk-subtitle">
                        Add and manage maintenance logs for this property. Total spend:{" "}
                        <strong>{money(totalSpend)}</strong>
                    </p>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <Link className="hk-link" to="/properties">
                        ← Back to properties
                    </Link>
                    <button className="hk-btn" type="button" onClick={loadLogs} disabled={loading}>
                        {loading ? "Refreshing…" : "Refresh"}
                    </button>
                </div>
            </div>

            {actionMsg && (
                <div className={actionMsg.includes("✅") ? "hk-muted" : "hk-error"} style={{ marginBottom: 12 }}>
                    {actionMsg}
                </div>
            )}
            {pageError && <div className="hk-error">{pageError}</div>}

            {/* ✅ RESTORED: Upload receipt -> scan -> create entry */}
            <div className="hk-card hk-card-pad" style={{ marginBottom: 12 }}>
                <div className="hk-row" style={{ marginBottom: 10 }}>
                    <div>
                        <div style={{ fontWeight: 900, fontSize: 16 }}>Create entry from receipt (scan + override)</div>
                        <div className="hk-muted" style={{ fontSize: 13 }}>
                            Upload a receipt to auto-extract vendor/date/total. You can override anything before saving.
                        </div>
                    </div>
                    <Pill>Receipt scan</Pill>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <input
                        ref={receiptFileRef}
                        type="file"
                        accept="application/pdf,image/*"
                        disabled={receiptUploading}
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            handleUploadReceiptFile(file);
                        }}
                    />
                    {receiptUploading ? <span className="hk-muted">Uploading + scanning…</span> : null}
                    <span className="hk-muted" style={{ fontSize: 12 }}>
                        Supported: PDF / images
                    </span>
                </div>

                {receiptUploadMsg ? <div className="hk-muted" style={{ marginTop: 10 }}>{receiptUploadMsg}</div> : null}
                {receiptUploadError ? <div className="hk-error" style={{ marginTop: 10 }}>{receiptUploadError}</div> : null}

                {uploadedReceipt ? (
                    <div className="hk-card hk-card-pad" style={{ marginTop: 12, background: "rgba(255,255,255,0.04)" }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                            <div style={{ fontWeight: 900 }}>{uploadedReceipt.name || "Receipt"}</div>
                            <Pill>ID: {String(uploadedReceipt.documentId).slice(-6)}</Pill>
                            {uploadedReceipt.vendor ? <Pill>Vendor: {uploadedReceipt.vendor}</Pill> : null}
                            {uploadedReceipt.total !== null ? <Pill>Total: {money(uploadedReceipt.total)}</Pill> : null}
                            {uploadedReceipt.dateISO ? <Pill>Date: {safeDateLabel(uploadedReceipt.dateISO)}</Pill> : null}
                            {uploadedReceipt.createdAt ? <Pill>Uploaded: {safeTimeLabel(uploadedReceipt.createdAt)}</Pill> : null}

                            <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
                                <button className="hk-btn" type="button" onClick={() => setReceiptCreateOpen(true)}>
                                    Review / create entry →
                                </button>
                            </div>
                        </div>

                        {uploadedReceipt.summary ? (
                            <div className="hk-muted" style={{ marginTop: 10, fontSize: 13 }}>
                                {clampStr(uploadedReceipt.summary)}
                            </div>
                        ) : null}

                        <div className="hk-muted" style={{ marginTop: 8, fontSize: 12 }}>
                            If vendor/total/date didn’t populate, your scan still ran — it just didn’t extract fields confidently. You can override manually in the next screen.
                        </div>
                    </div>
                ) : null}
            </div>

            {/* Main split: manual entry + logs list */}
            <div className="hk-split">
                {/* Left: Manual entry */}
                <section className="hk-card hk-card-pad">
                    <div className="hk-row" style={{ marginBottom: 10 }}>
                        <h3 className="hk-section-title">Manual entry</h3>
                        <span className="hk-pill">Add without receipt</span>
                    </div>

                    <form onSubmit={handleCreateManual} className="hk-form">
                        <label className="hk-label">
                            Title *
                            <input
                                className="hk-input"
                                value={createForm.title}
                                onChange={(e) => setCreateField("title", e.target.value)}
                                placeholder="e.g., Furnace service"
                            />
                        </label>

                        <div className="hk-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                            <label className="hk-label">
                                Category
                                <input
                                    className="hk-input"
                                    value={createForm.category}
                                    onChange={(e) => setCreateField("category", e.target.value)}
                                    placeholder="General"
                                />
                            </label>

                            <label className="hk-label">
                                Vendor
                                <input
                                    className="hk-input"
                                    value={createForm.vendor}
                                    onChange={(e) => setCreateField("vendor", e.target.value)}
                                    placeholder="Optional"
                                />
                            </label>
                        </div>

                        <div className="hk-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                            <label className="hk-label">
                                Service date *
                                <input
                                    className="hk-input"
                                    type="date"
                                    value={createForm.serviceDate}
                                    onChange={(e) => setCreateField("serviceDate", e.target.value)}
                                />
                            </label>

                            <label className="hk-label">
                                Cost
                                <input
                                    className="hk-input"
                                    value={createForm.cost}
                                    onChange={(e) => setCreateField("cost", e.target.value)}
                                    placeholder="0.00"
                                    inputMode="decimal"
                                />
                            </label>
                        </div>

                        <div className="hk-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                            <label className="hk-label">
                                Next due date (reminder)
                                <input
                                    className="hk-input"
                                    type="date"
                                    value={createForm.nextDueDate}
                                    onChange={(e) => setCreateField("nextDueDate", e.target.value)}
                                />
                            </label>

                            <label className="hk-label" style={{ display: "grid", gap: 8 }}>
                                Reminder enabled
                                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                    <input
                                        type="checkbox"
                                        checked={!!createForm.reminderEnabled}
                                        onChange={(e) => setCreateField("reminderEnabled", e.target.checked)}
                                    />
                                    <span className="hk-muted" style={{ fontSize: 13 }}>
                                        Include this log in reminders
                                    </span>
                                </div>
                            </label>
                        </div>

                        <label className="hk-label">
                            Notes
                            <textarea
                                className="hk-input"
                                rows={4}
                                value={createForm.notes}
                                onChange={(e) => setCreateField("notes", e.target.value)}
                                placeholder="Optional notes"
                            />
                        </label>

                        {createError && <div className="hk-error">{createError}</div>}

                        <div className="hk-actions">
                            <button className="hk-btn" type="submit" disabled={creating}>
                                {creating ? "Saving…" : "Save log"}
                            </button>
                        </div>
                    </form>
                </section>

                {/* Right: logs list */}
                <section className="hk-card hk-card-pad">
                    <div className="hk-row" style={{ marginBottom: 10 }}>
                        <div>
                            <h3 className="hk-section-title">Logs</h3>
                            <div className="hk-muted" style={{ fontSize: 13 }}>
                                {filteredSortedLogs.length} log{filteredSortedLogs.length === 1 ? "" : "s"} • Total{" "}
                                {money(totalSpend)}
                            </div>
                        </div>
                    </div>

                    <div className="hk-grid" style={{ gridTemplateColumns: "1fr 160px", gap: 10, marginBottom: 12 }}>
                        <input
                            className="hk-input"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search title, vendor, notes…"
                        />
                        <select className="hk-input" value={sort} onChange={(e) => setSort(e.target.value)}>
                            <option value="newest">Sort: newest</option>
                            <option value="oldest">Sort: oldest</option>
                            <option value="costHigh">Sort: cost high → low</option>
                            <option value="costLow">Sort: cost low → high</option>
                        </select>
                    </div>

                    {loading ? (
                        <div className="hk-muted">Loading…</div>
                    ) : filteredSortedLogs.length === 0 ? (
                        <div className="hk-muted">No logs found.</div>
                    ) : (
                        <ul className="hk-list" style={{ marginTop: 0 }}>
                            {filteredSortedLogs.map((log) => (
                                <li key={log._id} style={{ marginBottom: 12 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                                        <div>
                                            <div style={{ fontWeight: 900 }}>{log.title}</div>
                                            <div className="hk-muted" style={{ fontSize: 12 }}>
                                                {log.category ? `${log.category} • ` : ""}
                                                {log.vendor ? `${log.vendor} • ` : ""}
                                                {log.serviceDate ? safeDateLabel(log.serviceDate) : ""}
                                                {log.nextDueDate ? ` • Next due: ${safeDateLabel(log.nextDueDate)}` : ""}
                                                {typeof log.reminderEnabled === "boolean"
                                                    ? ` • Reminders: ${log.reminderEnabled ? "On" : "Off"}`
                                                    : ""}
                                            </div>
                                            {log.notes ? (
                                                <div className="hk-muted" style={{ fontSize: 13, marginTop: 6 }}>
                                                    {log.notes}
                                                </div>
                                            ) : null}
                                        </div>

                                        <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                                            <div style={{ fontWeight: 900 }}>{money(log.cost)}</div>
                                            <div style={{ display: "flex", gap: 10 }}>
                                                <button className="hk-btn" type="button" onClick={() => openEdit(log)}>
                                                    Edit
                                                </button>
                                                <button className="hk-btn" type="button" onClick={() => handleDelete(log._id)}>
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>

            {/* Edit modal */}
            <Modal open={editOpen} title="Edit maintenance log" onClose={closeEdit}>
                <form onSubmit={handleSaveEdit} className="hk-form">
                    <label className="hk-label">
                        Title *
                        <input
                            className="hk-input"
                            value={editForm.title}
                            onChange={(e) => setEditField("title", e.target.value)}
                        />
                    </label>

                    <div className="hk-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                        <label className="hk-label">
                            Category
                            <input
                                className="hk-input"
                                value={editForm.category}
                                onChange={(e) => setEditField("category", e.target.value)}
                            />
                        </label>

                        <label className="hk-label">
                            Vendor
                            <input
                                className="hk-input"
                                value={editForm.vendor}
                                onChange={(e) => setEditField("vendor", e.target.value)}
                            />
                        </label>
                    </div>

                    <div className="hk-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                        <label className="hk-label">
                            Service date *
                            <input
                                className="hk-input"
                                type="date"
                                value={editForm.serviceDate}
                                onChange={(e) => setEditField("serviceDate", e.target.value)}
                            />
                        </label>

                        <label className="hk-label">
                            Cost
                            <input
                                className="hk-input"
                                value={editForm.cost}
                                onChange={(e) => setEditField("cost", e.target.value)}
                                inputMode="decimal"
                            />
                        </label>
                    </div>

                    <div className="hk-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                        <label className="hk-label">
                            Next due date (reminder)
                            <input
                                className="hk-input"
                                type="date"
                                value={editForm.nextDueDate}
                                onChange={(e) => setEditField("nextDueDate", e.target.value)}
                            />
                        </label>

                        <label className="hk-label" style={{ display: "grid", gap: 8 }}>
                            Reminder enabled
                            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                <input
                                    type="checkbox"
                                    checked={!!editForm.reminderEnabled}
                                    onChange={(e) => setEditField("reminderEnabled", e.target.checked)}
                                />
                                <span className="hk-muted" style={{ fontSize: 13 }}>
                                    Include this log in reminders
                                </span>
                            </div>
                        </label>
                    </div>

                    <label className="hk-label">
                        Notes
                        <textarea
                            className="hk-input"
                            rows={4}
                            value={editForm.notes}
                            onChange={(e) => setEditField("notes", e.target.value)}
                        />
                    </label>

                    {editError && <div className="hk-error">{editError}</div>}

                    <div className="hk-actions" style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                        <button className="hk-btn" type="button" onClick={closeEdit} disabled={editSubmitting}>
                            Cancel
                        </button>
                        <button className="hk-btn" type="submit" disabled={editSubmitting}>
                            {editSubmitting ? "Saving…" : "Save updates"}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Receipt create modal (override + create entry) */}
            <Modal open={receiptCreateOpen} title="Create entry from receipt" onClose={closeReceiptCreate}>
                <div className="hk-muted" style={{ fontSize: 13, marginBottom: 10 }}>
                    We scanned your receipt and pre-filled what we could. Override anything, then click “Create entry”.
                </div>

                {uploadedReceipt ? (
                    <div className="hk-card hk-card-pad" style={{ marginBottom: 12, background: "rgba(255,255,255,0.04)" }}>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                            <div style={{ fontWeight: 900 }}>{uploadedReceipt.name}</div>
                            <Pill>ID: {String(uploadedReceipt.documentId).slice(-6)}</Pill>
                            {uploadedReceipt.vendor ? <Pill>Vendor: {uploadedReceipt.vendor}</Pill> : null}
                            {uploadedReceipt.total !== null ? <Pill>Total: {money(uploadedReceipt.total)}</Pill> : null}
                            {uploadedReceipt.dateISO ? <Pill>Date: {safeDateLabel(uploadedReceipt.dateISO)}</Pill> : null}
                        </div>
                        {uploadedReceipt.summary ? (
                            <div className="hk-muted" style={{ marginTop: 10, fontSize: 13 }}>
                                {clampStr(uploadedReceipt.summary)}
                            </div>
                        ) : null}
                    </div>
                ) : null}

                <div className="hk-form">
                    <label className="hk-label">
                        Title *
                        <input
                            className="hk-input"
                            value={receiptOverrides.title}
                            onChange={(e) => setReceiptField("title", e.target.value)}
                        />
                    </label>

                    <div className="hk-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                        <label className="hk-label">
                            Category
                            <input
                                className="hk-input"
                                value={receiptOverrides.category}
                                onChange={(e) => setReceiptField("category", e.target.value)}
                            />
                        </label>

                        <label className="hk-label">
                            Vendor
                            <input
                                className="hk-input"
                                value={receiptOverrides.vendor}
                                onChange={(e) => setReceiptField("vendor", e.target.value)}
                            />
                        </label>
                    </div>

                    <div className="hk-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                        <label className="hk-label">
                            Service date *
                            <input
                                className="hk-input"
                                type="date"
                                value={receiptOverrides.serviceDate}
                                onChange={(e) => setReceiptField("serviceDate", e.target.value)}
                            />
                        </label>

                        <label className="hk-label">
                            Cost
                            <input
                                className="hk-input"
                                value={receiptOverrides.cost}
                                onChange={(e) => setReceiptField("cost", e.target.value)}
                                inputMode="decimal"
                            />
                        </label>
                    </div>

                    <div className="hk-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                        <label className="hk-label">
                            Next due date (optional)
                            <input
                                className="hk-input"
                                type="date"
                                value={receiptOverrides.nextDueDate}
                                onChange={(e) => setReceiptField("nextDueDate", e.target.value)}
                            />
                        </label>

                        <label className="hk-label" style={{ display: "grid", gap: 8 }}>
                            Reminder enabled
                            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                <input
                                    type="checkbox"
                                    checked={!!receiptOverrides.reminderEnabled}
                                    onChange={(e) => setReceiptField("reminderEnabled", e.target.checked)}
                                />
                                <span className="hk-muted" style={{ fontSize: 13 }}>
                                    Include this log in reminders
                                </span>
                            </div>
                        </label>
                    </div>

                    <label className="hk-label">
                        Notes
                        <textarea
                            className="hk-input"
                            rows={4}
                            value={receiptOverrides.notes}
                            onChange={(e) => setReceiptField("notes", e.target.value)}
                        />
                    </label>

                    {receiptCreateError ? <div className="hk-error">{receiptCreateError}</div> : null}

                    <div className="hk-actions" style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                        <button className="hk-btn" type="button" onClick={closeReceiptCreate} disabled={receiptCreateBusy}>
                            Cancel
                        </button>
                        <button className="hk-btn" type="button" onClick={handleCreateLogFromReceipt} disabled={receiptCreateBusy}>
                            {receiptCreateBusy ? "Creating…" : "Create entry"}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
