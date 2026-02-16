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
    const num = typeof n === "number" && Number.isFinite(n) ? n : Number(n) || 0;
    return num.toLocaleString(undefined, { style: "currency", currency: "CAD" });
}

function Modal({ open, title, children, onClose, busy }) {
    if (!open) return null;
    return (
        <div
            role="dialog"
            aria-modal="true"
            onClick={() => (busy ? null : onClose())}
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
                <div className="hk-row" style={{ marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
                    <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
                    <button className="hk-btn hk-btn-ghost hk-btn-sm" type="button" onClick={onClose} disabled={busy}>
                        ✕
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

export default function ReceiptsPage() {
    const { token, refreshReceiptsCount } = useAuth();

    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState("");

    // Inbox list (unattached receipts)
    const [receipts, setReceipts] = useState([]);

    // Upload
    const uploadRef = useRef(null);
    const [uploadBusy, setUploadBusy] = useState(false);
    const [uploadErr, setUploadErr] = useState("");
    const [uploadMsg, setUploadMsg] = useState("");

    // Preview modal
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewBusy, setPreviewBusy] = useState(false);
    const [previewErr, setPreviewErr] = useState("");
    const [previewDoc, setPreviewDoc] = useState(null); // Document object
    const [previewUrl, setPreviewUrl] = useState(""); // objectURL
    const [previewFilename, setPreviewFilename] = useState("");

    // Attach modal
    const [attachOpen, setAttachOpen] = useState(false);
    const [attachBusy, setAttachBusy] = useState(false);
    const [attachErr, setAttachErr] = useState("");
    const [attachDoc, setAttachDoc] = useState(null);

    const [properties, setProperties] = useState([]);
    const [logs, setLogs] = useState([]);

    const [selectedPropertyId, setSelectedPropertyId] = useState("");
    const [selectedLogId, setSelectedLogId] = useState("");

    // Create-log modal
    const [createOpen, setCreateOpen] = useState(false);
    const [createBusy, setCreateBusy] = useState(false);
    const [createErr, setCreateErr] = useState("");
    const [createDoc, setCreateDoc] = useState(null);
    const [createProps, setCreateProps] = useState([]);
    const [createPropertyId, setCreatePropertyId] = useState("");

    const [overrides, setOverrides] = useState({
        title: "",
        serviceDate: "",
        category: "General",
        vendor: "",
        cost: "",
        notes: "",
        nextDueDate: "",
        reminderEnabled: false,
    });

    const inboxCount = useMemo(() => receipts.length, [receipts]);

    async function loadInbox() {
        setLoading(true);
        setPageError("");
        try {
            const res = await api.listReceipts({ status: "unattached" }, token);
            const list = res?.data?.receipts || [];
            setReceipts(Array.isArray(list) ? list : []);
            await refreshReceiptsCount(token);
        } catch (err) {
            setPageError(err?.message || "Failed to load receipts inbox.");
            setReceipts([]);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadInbox();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function handleUpload(file) {
        setUploadBusy(true);
        setUploadErr("");
        setUploadMsg("");

        try {
            await api.uploadReceipt(file, token);
            setUploadMsg("Receipt uploaded to Inbox ✅");
            await loadInbox();
        } catch (err) {
            setUploadErr(err?.message || "Upload failed.");
        } finally {
            setUploadBusy(false);
            if (uploadRef.current) uploadRef.current.value = "";
        }
    }

    async function openPreview(doc) {
        setPreviewErr("");
        setPreviewDoc(doc);
        setPreviewFilename("");
        setPreviewUrl("");
        setPreviewOpen(true);

        setPreviewBusy(true);
        try {
            const { blob, filename } = await api.downloadReceipt(doc._id, token);

            const url = window.URL.createObjectURL(blob);
            setPreviewUrl(url);
            setPreviewFilename(filename || doc.originalName || "receipt");
        } catch (err) {
            setPreviewErr(err?.message || "Preview failed.");
        } finally {
            setPreviewBusy(false);
        }
    }

    function closePreview() {
        if (previewBusy) return;
        setPreviewOpen(false);
        setPreviewDoc(null);
        setPreviewErr("");
        setPreviewFilename("");
        if (previewUrl) {
            window.URL.revokeObjectURL(previewUrl);
        }
        setPreviewUrl("");
    }

    async function handleDownload(doc) {
        try {
            const { blob, filename } = await api.downloadReceipt(doc._id, token);
            const url = window.URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = filename || doc.originalName || "receipt";
            document.body.appendChild(a);
            a.click();
            a.remove();

            window.URL.revokeObjectURL(url);
        } catch (err) {
            setPageError(err?.message || "Download failed.");
        }
    }

    async function handleDelete(doc) {
        const ok = window.confirm("Delete this receipt? This cannot be undone.");
        if (!ok) return;

        try {
            await api.deleteReceipt(doc._id, token);
            await loadInbox();
        } catch (err) {
            setPageError(err?.message || "Delete failed.");
        }
    }

    // ---------- Attach flow ----------
    async function openAttach(doc) {
        setAttachDoc(doc);
        setAttachErr("");
        setSelectedPropertyId("");
        setSelectedLogId("");
        setLogs([]);
        setAttachOpen(true);

        try {
            const p = await api.listProperties(token);
            const list = p?.data?.properties || [];
            setProperties(Array.isArray(list) ? list : []);
        } catch (err) {
            setAttachErr(err?.message || "Failed to load properties.");
            setProperties([]);
        }
    }

    function closeAttach() {
        if (attachBusy) return;
        setAttachOpen(false);
        setAttachBusy(false);
        setAttachErr("");
        setAttachDoc(null);
        setSelectedPropertyId("");
        setSelectedLogId("");
        setLogs([]);
    }

    async function loadLogsForProperty(propertyId) {
        if (!propertyId) {
            setLogs([]);
            return;
        }
        try {
            const res = await api.listMaintenance(propertyId, token);
            const list = res?.data?.logs || res?.data?.maintenance || res?.data || [];
            setLogs(Array.isArray(list) ? list : []);
        } catch (err) {
            setAttachErr(err?.message || "Failed to load maintenance logs.");
            setLogs([]);
        }
    }

    async function submitAttach() {
        if (!attachDoc?._id) return;
        if (!selectedPropertyId || !selectedLogId) {
            setAttachErr("Please select a property and a maintenance log.");
            return;
        }

        setAttachBusy(true);
        setAttachErr("");

        try {
            await api.attachReceipt(attachDoc._id, selectedPropertyId, selectedLogId, token);
            await refreshReceiptsCount(token);
            await loadInbox();
            closeAttach();
        } catch (err) {
            setAttachErr(err?.message || "Attach failed.");
        } finally {
            setAttachBusy(false);
        }
    }

    // ---------- Create-log flow ----------
    async function openCreateLog(doc) {
        setCreateDoc(doc);
        setCreateErr("");
        setCreatePropertyId("");
        setCreateOpen(true);

        // Prefill from extracted fields if present
        const ex = doc?.extracted || {};
        const suggestedTitle = ex?.titleSuggestion || "";
        const vendor = ex?.vendor || "";
        const category = ex?.category || "General";
        const amount = typeof ex?.amount === "number" ? ex.amount : "";

        // serviceDate: if extracted date exists, format yyyy-mm-dd for <input type="date">
        let serviceDate = "";
        if (ex?.date) {
            const dt = new Date(ex.date);
            if (!Number.isNaN(dt.getTime())) {
                const yyyy = dt.getFullYear();
                const mm = String(dt.getMonth() + 1).padStart(2, "0");
                const dd = String(dt.getDate()).padStart(2, "0");
                serviceDate = `${yyyy}-${mm}-${dd}`;
            }
        }

        setOverrides({
            title: suggestedTitle || "",
            serviceDate: serviceDate || "",
            category: category || "General",
            vendor: vendor || "",
            cost: amount === "" ? "" : String(amount),
            notes: "",
            nextDueDate: "",
            reminderEnabled: false,
        });

        try {
            const p = await api.listProperties(token);
            const list = p?.data?.properties || [];
            setCreateProps(Array.isArray(list) ? list : []);
        } catch (err) {
            setCreateErr(err?.message || "Failed to load properties.");
            setCreateProps([]);
        }
    }

    function closeCreateLog() {
        if (createBusy) return;
        setCreateOpen(false);
        setCreateBusy(false);
        setCreateErr("");
        setCreateDoc(null);
        setCreatePropertyId("");
    }

    async function submitCreateLog() {
        if (!createDoc?._id) return;
        if (!createPropertyId) {
            setCreateErr("Please select a property.");
            return;
        }
        if (!overrides.title?.trim()) {
            setCreateErr("Title is required.");
            return;
        }
        if (!overrides.serviceDate) {
            setCreateErr("Service date is required.");
            return;
        }

        setCreateBusy(true);
        setCreateErr("");

        try {
            const payload = {
                ...overrides,
                title: overrides.title.trim(),
                vendor: (overrides.vendor || "").trim(),
                category: (overrides.category || "General").trim(),
                notes: (overrides.notes || "").trim(),
                cost: overrides.cost === "" ? 0 : Number(overrides.cost) || 0,
                nextDueDate: overrides.nextDueDate ? overrides.nextDueDate : null,
                reminderEnabled: !!overrides.reminderEnabled,
            };

            await api.createLogFromReceipt(createDoc._id, createPropertyId, payload, token);

            await refreshReceiptsCount(token);
            await loadInbox();
            closeCreateLog();
        } catch (err) {
            setCreateErr(err?.message || "Create log failed.");
        } finally {
            setCreateBusy(false);
        }
    }

    return (
        <div className="hk-container">
            <div className="hk-header">
                <div>
                    <h2 className="hk-title">Receipts Inbox</h2>
                    <p className="hk-subtitle">
                        Unattached receipts waiting to be attached to a maintenance log. ({inboxCount})
                    </p>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <Link className="hk-link" to="/dashboard">
                        Back to dashboard →
                    </Link>
                    <button className="hk-btn" type="button" onClick={loadInbox} disabled={loading}>
                        {loading ? "Refreshing…" : "Refresh"}
                    </button>
                </div>
            </div>

            {pageError ? <div className="hk-error">{pageError}</div> : null}
            {uploadErr ? <div className="hk-error">{uploadErr}</div> : null}
            {uploadMsg ? <div className="hk-muted">{uploadMsg}</div> : null}

            <div className="hk-card hk-card-pad" style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Upload a receipt to Inbox</div>
                <div className="hk-muted" style={{ fontSize: 13, marginBottom: 10 }}>
                    This will upload the receipt as <strong>unattached</strong>. Then you can attach it to an existing log or create a new log from it.
                </div>

                <input
                    ref={uploadRef}
                    type="file"
                    accept="application/pdf,image/*"
                    disabled={uploadBusy}
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        handleUpload(f);
                    }}
                />
                {uploadBusy ? <div className="hk-muted" style={{ marginTop: 8 }}>Uploading…</div> : null}
            </div>

            <div className="hk-card hk-card-pad">
                <div className="hk-row" style={{ marginBottom: 10 }}>
                    <div>
                        <div style={{ fontWeight: 900, fontSize: 16 }}>Inbox</div>
                        <div className="hk-muted" style={{ fontSize: 13 }}>
                            These receipts are not attached to any maintenance log yet.
                        </div>
                    </div>
                    <span className="hk-pill">Unattached</span>
                </div>

                {loading ? (
                    <div className="hk-muted">Loading…</div>
                ) : receipts.length === 0 ? (
                    <div className="hk-muted">Inbox is empty 🎉</div>
                ) : (
                    <ul className="hk-list" style={{ marginTop: 0 }}>
                        {receipts.map((d) => {
                            const ex = d?.extracted || {};
                            const vendor = ex?.vendor || "";
                            const amount = typeof ex?.amount === "number" ? ex.amount : null;
                            const dt = ex?.date ? safeDateLabel(ex.date) : "";
                            const category = ex?.category || "";
                            const title = d?.originalName || "Receipt";

                            return (
                                <li key={d._id} style={{ marginBottom: 12 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 900 }}>{title}</div>
                                            <div className="hk-muted" style={{ fontSize: 12 }}>
                                                {d.createdAt ? `Uploaded: ${safeDateLabel(d.createdAt)}` : ""}
                                                {d.size ? ` • ${Math.round(d.size / 1024)} KB` : ""}
                                            </div>

                                            <div className="hk-extract-grid">
                                                <div className="hk-extract-item">
                                                    <div className="hk-extract-label">Vendor</div>
                                                    <div className="hk-extract-value">{vendor || "—"}</div>
                                                </div>
                                                <div className="hk-extract-item">
                                                    <div className="hk-extract-label">Amount</div>
                                                    <div className="hk-extract-value">{amount !== null ? money(amount) : "—"}</div>
                                                </div>
                                                <div className="hk-extract-item">
                                                    <div className="hk-extract-label">Date</div>
                                                    <div className="hk-extract-value">{dt || "—"}</div>
                                                </div>
                                                <div className="hk-extract-item">
                                                    <div className="hk-extract-label">Category</div>
                                                    <div className="hk-extract-value">{category || "General"}</div>
                                                </div>
                                                <div className="hk-extract-item" style={{ gridColumn: "span 2" }}>
                                                    <div className="hk-extract-label">Title suggestion</div>
                                                    <div className="hk-extract-value">{ex?.titleSuggestion || "—"}</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 190 }}>
                                            <button className="hk-btn" type="button" onClick={() => openPreview(d)}>
                                                Preview
                                            </button>

                                            <button className="hk-btn hk-btn-ghost" type="button" onClick={() => handleDownload(d)}>
                                                Download
                                            </button>

                                            <button className="hk-btn hk-btn-ghost" type="button" onClick={() => openAttach(d)}>
                                                Attach to log
                                            </button>

                                            <button className="hk-btn hk-btn-ghost" type="button" onClick={() => openCreateLog(d)}>
                                                Create log from receipt
                                            </button>

                                            <button className="hk-btn hk-btn-ghost" type="button" onClick={() => handleDelete(d)}>
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {/* PREVIEW MODAL */}
            <Modal open={previewOpen} title="Receipt preview" onClose={closePreview} busy={previewBusy}>
                {previewErr ? <div className="hk-error" style={{ marginBottom: 10 }}>{previewErr}</div> : null}
                {previewBusy ? (
                    <div className="hk-muted">Loading preview…</div>
                ) : previewUrl ? (
                    <div className="hk-subcard hk-card-pad">
                        <div className="hk-muted" style={{ fontSize: 13, marginBottom: 10 }}>
                            {previewFilename || "receipt"}
                        </div>

                        {/* If it looks like PDF, use iframe; otherwise show image */}
                        {String(previewFilename || "").toLowerCase().endsWith(".pdf") ||
                            (previewDoc?.mimeType || "").includes("pdf") ? (
                            <iframe className="hk-iframe" src={previewUrl} title="Receipt PDF" />
                        ) : (
                            <img className="hk-preview-img" src={previewUrl} alt="Receipt preview" />
                        )}
                    </div>
                ) : (
                    <div className="hk-muted">No preview available.</div>
                )}
            </Modal>

            {/* ATTACH MODAL */}
            <Modal open={attachOpen} title="Attach receipt to existing maintenance log" onClose={closeAttach} busy={attachBusy}>
                {attachErr ? <div className="hk-error" style={{ marginBottom: 10 }}>{attachErr}</div> : null}

                <div className="hk-form">
                    <label className="hk-label">
                        Property
                        <select
                            className="hk-input"
                            value={selectedPropertyId}
                            disabled={attachBusy}
                            onChange={(e) => {
                                const v = e.target.value;
                                setSelectedPropertyId(v);
                                setSelectedLogId("");
                                loadLogsForProperty(v);
                            }}
                        >
                            <option value="">Select…</option>
                            {properties.map((p) => (
                                <option key={p._id} value={p._id}>
                                    {p.nickname || p.city || p.addressLine1 || "Property"}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="hk-label">
                        Maintenance log
                        <select
                            className="hk-input"
                            value={selectedLogId}
                            disabled={attachBusy || !selectedPropertyId}
                            onChange={(e) => setSelectedLogId(e.target.value)}
                        >
                            <option value="">{selectedPropertyId ? "Select…" : "Select a property first"}</option>
                            {logs.map((l) => (
                                <option key={l._id} value={l._id}>
                                    {l.title || "Maintenance"} {l.serviceDate ? `(${safeDateLabel(l.serviceDate)})` : ""}
                                </option>
                            ))}
                        </select>
                    </label>

                    <div style={{ display: "flex", gap: 10 }}>
                        <button className="hk-btn" type="button" onClick={submitAttach} disabled={attachBusy}>
                            {attachBusy ? "Attaching…" : "Attach"}
                        </button>
                        <button className="hk-btn hk-btn-ghost" type="button" onClick={closeAttach} disabled={attachBusy}>
                            Cancel
                        </button>
                    </div>
                </div>
            </Modal>

            {/* CREATE LOG MODAL */}
            <Modal open={createOpen} title="Create maintenance log from receipt" onClose={closeCreateLog} busy={createBusy}>
                {createErr ? <div className="hk-error" style={{ marginBottom: 10 }}>{createErr}</div> : null}

                <div className="hk-form">
                    <label className="hk-label">
                        Property
                        <select
                            className="hk-input"
                            value={createPropertyId}
                            disabled={createBusy}
                            onChange={(e) => setCreatePropertyId(e.target.value)}
                        >
                            <option value="">Select…</option>
                            {createProps.map((p) => (
                                <option key={p._id} value={p._id}>
                                    {p.nickname || p.city || p.addressLine1 || "Property"}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="hk-label">
                        Title (required)
                        <input
                            className="hk-input"
                            value={overrides.title}
                            disabled={createBusy}
                            onChange={(e) => setOverrides((o) => ({ ...o, title: e.target.value }))}
                            placeholder="e.g., Plumbing • Rona • $128.45"
                        />
                    </label>

                    <label className="hk-label">
                        Service date (required)
                        <input
                            className="hk-input"
                            type="date"
                            value={overrides.serviceDate}
                            disabled={createBusy}
                            onChange={(e) => setOverrides((o) => ({ ...o, serviceDate: e.target.value }))}
                        />
                    </label>

                    <div className="hk-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <label className="hk-label">
                            Vendor
                            <input
                                className="hk-input"
                                value={overrides.vendor}
                                disabled={createBusy}
                                onChange={(e) => setOverrides((o) => ({ ...o, vendor: e.target.value }))}
                            />
                        </label>

                        <label className="hk-label">
                            Cost
                            <input
                                className="hk-input"
                                type="number"
                                step="0.01"
                                value={overrides.cost}
                                disabled={createBusy}
                                onChange={(e) => setOverrides((o) => ({ ...o, cost: e.target.value }))}
                            />
                        </label>

                        <label className="hk-label">
                            Category
                            <input
                                className="hk-input"
                                value={overrides.category}
                                disabled={createBusy}
                                onChange={(e) => setOverrides((o) => ({ ...o, category: e.target.value }))}
                            />
                        </label>

                        <label className="hk-label">
                            Next due date
                            <input
                                className="hk-input"
                                type="date"
                                value={overrides.nextDueDate}
                                disabled={createBusy}
                                onChange={(e) => setOverrides((o) => ({ ...o, nextDueDate: e.target.value }))}
                            />
                        </label>
                    </div>

                    <label className="hk-label">
                        Notes
                        <textarea
                            className="hk-textarea"
                            value={overrides.notes}
                            disabled={createBusy}
                            onChange={(e) => setOverrides((o) => ({ ...o, notes: e.target.value }))}
                            placeholder="Optional notes…"
                        />
                    </label>

                    <label className="hk-label" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <input
                            type="checkbox"
                            checked={overrides.reminderEnabled}
                            disabled={createBusy}
                            onChange={(e) => setOverrides((o) => ({ ...o, reminderEnabled: e.target.checked }))}
                        />
                        Enable reminder
                    </label>

                    <div style={{ display: "flex", gap: 10 }}>
                        <button className="hk-btn" type="button" onClick={submitCreateLog} disabled={createBusy}>
                            {createBusy ? "Creating…" : "Create log + attach receipt"}
                        </button>
                        <button className="hk-btn hk-btn-ghost" type="button" onClick={closeCreateLog} disabled={createBusy}>
                            Cancel
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
