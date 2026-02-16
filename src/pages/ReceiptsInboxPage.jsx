import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext.jsx";

function safeDateLabel(d) {
    if (!d) return "";
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toLocaleDateString();
}

function toISODateInput(d) {
    if (!d) return "";
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "";
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

function money(n) {
    const num = typeof n === "number" && Number.isFinite(n) ? n : 0;
    return num.toLocaleString(undefined, { style: "currency", currency: "CAD" });
}

function needsReview(doc) {
    const ex = doc?.extracted || {};
    const missingVendor = !String(ex.vendor || "").trim();
    const missingAmount = !(typeof ex.amount === "number" && Number.isFinite(ex.amount) && ex.amount > 0);
    const missingDate = !ex.date;
    return missingVendor || missingAmount || missingDate;
}

function Modal({ open, title, children, onClose, disableClose }) {
    if (!open) return null;
    return (
        <div
            className="hk-modal-backdrop"
            role="dialog"
            aria-modal="true"
            onClick={() => (!disableClose ? onClose() : null)}
        >
            <div
                className="hk-modal hk-card hk-card-pad"
                onClick={(e) => e.stopPropagation()}
                style={{ maxHeight: "86vh", overflow: "auto" }}
            >
                <div
                    className="hk-row"
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        marginBottom: 12,
                    }}
                >
                    <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
                    <button
                        className="hk-btn hk-btn-ghost hk-btn-sm"
                        type="button"
                        onClick={onClose}
                        disabled={disableClose}
                    >
                        ✕
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

export default function ReceiptsInboxPage() {
    const { token, lastRoute, setLastRoute } = useAuth();
    const nav = useNavigate();

    const uploadRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState("");

    const [receipts, setReceipts] = useState([]);
    const [properties, setProperties] = useState([]);

    const [busyUpload, setBusyUpload] = useState(false);
    const [busyDeleteId, setBusyDeleteId] = useState("");
    const [busyRescanId, setBusyRescanId] = useState("");

    // filters
    const [status, setStatus] = useState("unattached");
    const [q, setQ] = useState("");

    // preview modal
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewBusy, setPreviewBusy] = useState(false);
    const [previewErr, setPreviewErr] = useState("");
    const [previewUrl, setPreviewUrl] = useState("");
    const [previewName, setPreviewName] = useState("");
    const [previewType, setPreviewType] = useState("");

    // review modal
    const [reviewOpen, setReviewOpen] = useState(false);
    const [reviewBusy, setReviewBusy] = useState(false);
    const [reviewErr, setReviewErr] = useState("");
    const [reviewDoc, setReviewDoc] = useState(null);
    const [reviewFields, setReviewFields] = useState({
        vendor: "",
        amount: "",
        date: "",
        category: "General",
        titleSuggestion: "",
    });

    // attach modal
    const [attachOpen, setAttachOpen] = useState(false);
    const [attachBusy, setAttachBusy] = useState(false);
    const [attachErr, setAttachErr] = useState("");
    const [attachTarget, setAttachTarget] = useState(null);
    const [attachPropertyId, setAttachPropertyId] = useState("");
    const [attachLogs, setAttachLogs] = useState([]);
    const [attachLogsLoading, setAttachLogsLoading] = useState(false);
    const [attachLogId, setAttachLogId] = useState("");

    // create log modal
    const [createOpen, setCreateOpen] = useState(false);
    const [createBusy, setCreateBusy] = useState(false);
    const [createErr, setCreateErr] = useState("");
    const [createTarget, setCreateTarget] = useState(null);
    const [createPropertyId, setCreatePropertyId] = useState("");
    const [overrides, setOverrides] = useState({
        title: "",
        category: "General",
        vendor: "",
        serviceDate: "",
        cost: 0,
        notes: "",
        nextDueDate: "",
        reminderEnabled: false,
    });

    async function loadAll() {
        setLoading(true);
        setPageError("");
        try {
            const [r, p] = await Promise.all([api.listReceipts({}, token), api.listProperties(token)]);
            setReceipts(r?.data?.receipts || r?.receipts || []);
            setProperties(p?.data?.properties || p?.properties || []);
        } catch (err) {
            setPageError(err?.message || "Failed to load receipts.");
            setReceipts([]);
            setProperties([]);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    const counts = useMemo(() => {
        const total = receipts.length;
        const unattached = receipts.filter((d) => d.status === "unattached").length;
        const attached = receipts.filter((d) => d.status === "attached").length;
        const needReview = receipts.filter((d) => d.status === "unattached" && needsReview(d)).length;
        return { total, unattached, attached, needReview };
    }, [receipts]);

    const filtered = useMemo(() => {
        const needle = String(q || "").trim().toLowerCase();
        let list = receipts.slice();

        if (status !== "all") list = list.filter((d) => d.status === status);

        if (needle) {
            list = list.filter((d) => {
                const ex = d?.extracted || {};
                const hay = [
                    d.originalName,
                    ex.vendor,
                    ex.category,
                    ex.titleSuggestion,
                    d.status,
                    d.kind,
                ]
                    .filter(Boolean)
                    .join(" | ")
                    .toLowerCase();
                return hay.includes(needle);
            });
        }

        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return list;
    }, [receipts, status, q]);

    // preview
    async function openPreview(doc) {
        setPreviewErr("");
        setPreviewBusy(true);
        setPreviewOpen(true);

        try {
            const res = await api.downloadReceipt(doc._id, token);
            if (previewUrl) URL.revokeObjectURL(previewUrl);

            const url = URL.createObjectURL(res.blob);
            setPreviewUrl(url);
            setPreviewName(res.filename || doc.originalName || "receipt");
            setPreviewType(res.contentType || doc.mimeType || "");
        } catch (err) {
            setPreviewErr(err?.message || "Preview failed.");
        } finally {
            setPreviewBusy(false);
        }
    }

    function closePreview() {
        if (previewBusy) return;
        setPreviewOpen(false);
        setPreviewErr("");
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl("");
        setPreviewName("");
        setPreviewType("");
    }

    // review
    function openReview(doc) {
        const ex = doc?.extracted || {};
        setReviewDoc(doc);
        setReviewErr("");
        setReviewFields({
            vendor: ex.vendor || "",
            amount: typeof ex.amount === "number" ? String(ex.amount) : "",
            date: ex.date ? toISODateInput(ex.date) : "",
            category: ex.category || "General",
            titleSuggestion: ex.titleSuggestion || "",
        });
        setReviewOpen(true);
    }

    function closeReview() {
        if (reviewBusy) return;
        setReviewOpen(false);
        setReviewErr("");
        setReviewDoc(null);
    }

    async function saveReviewEdits() {
        if (!reviewDoc) return;
        setReviewBusy(true);
        setReviewErr("");

        try {
            // IMPORTANT: api.updateReceipt() now supports either flat fields or { extracted }
            const extracted = {
                vendor: String(reviewFields.vendor || "").trim(),
                amount: reviewFields.amount === "" ? null : Number(reviewFields.amount),
                date: reviewFields.date || null,
                category: String(reviewFields.category || "General").trim(),
                titleSuggestion: String(reviewFields.titleSuggestion || "").trim(),
            };

            await api.updateReceipt(reviewDoc._id, extracted, token);
            await loadAll();

            // keep modal open but updated record might have changed; close feels cleaner:
            closeReview();
        } catch (err) {
            setReviewErr(err?.message || "Failed to save receipt details.");
        } finally {
            setReviewBusy(false);
        }
    }

    // upload
    async function handleUpload(file) {
        setBusyUpload(true);
        setPageError("");

        try {
            const up = await api.uploadReceipt(file, token);
            const doc = up?.data?.document || up?.document || null;

            await loadAll();

            if (doc?._id) openReview(doc);
        } catch (err) {
            setPageError(err?.message || "Upload failed.");
        } finally {
            setBusyUpload(false);
            if (uploadRef.current) uploadRef.current.value = "";
        }
    }

    // rescan
    async function handleRescan(doc) {
        setBusyRescanId(doc._id);
        setPageError("");

        try {
            const res = await api.rescanReceipt(doc._id, token);
            const updated = res?.data?.receipt || doc;

            await loadAll();
            openReview(updated);
        } catch (err) {
            setPageError(err?.message || "Re-scan failed.");
        } finally {
            setBusyRescanId("");
        }
    }

    // delete
    async function handleDelete(docId) {
        const ok = window.confirm("Delete this receipt? This cannot be undone.");
        if (!ok) return;

        setBusyDeleteId(docId);
        setPageError("");

        try {
            await api.deleteReceipt(docId, token);
            await loadAll();
        } catch (err) {
            setPageError(err?.message || "Delete failed.");
        } finally {
            setBusyDeleteId("");
        }
    }

    // attach
    async function loadLogsForProperty(propertyId) {
        setAttachLogs([]);
        setAttachLogId("");
        if (!propertyId) return;

        setAttachLogsLoading(true);
        try {
            const res = await api.listMaintenance(propertyId, token);
            const list = res?.data?.logs || res?.data?.maintenance || res?.data || [];
            setAttachLogs(Array.isArray(list) ? list : []);
        } catch {
            setAttachLogs([]);
        } finally {
            setAttachLogsLoading(false);
        }
    }

    function openAttach(doc) {
        setAttachErr("");
        setAttachTarget(doc);

        const defaultProperty = lastRoute?.propertyId || doc?.property || "";
        setAttachPropertyId(defaultProperty);

        setAttachLogs([]);
        setAttachOpen(true);

        if (defaultProperty) {
            loadLogsForProperty(defaultProperty).then(() => {
                const defaultLog = lastRoute?.logId || "";
                if (defaultLog) setAttachLogId(defaultLog);
            });
        } else {
            setAttachLogId(lastRoute?.logId || "");
        }
    }

    function closeAttach() {
        if (attachBusy) return;
        setAttachOpen(false);
        setAttachErr("");
        setAttachTarget(null);
        setAttachPropertyId("");
        setAttachLogs([]);
        setAttachLogId("");
    }

    async function submitAttach() {
        if (!attachTarget) return;

        setAttachBusy(true);
        setAttachErr("");

        try {
            if (!attachPropertyId) throw new Error("Please choose a property.");
            if (!attachLogId) throw new Error("Please choose a maintenance log.");

            await api.attachReceipt(attachTarget._id, attachPropertyId, attachLogId, token);

            setLastRoute?.({ propertyId: attachPropertyId, logId: attachLogId });

            closeAttach();
            closeReview();
            await loadAll();
        } catch (err) {
            setAttachErr(err?.message || "Attach failed.");
        } finally {
            setAttachBusy(false);
        }
    }

    // create
    function openCreate(doc) {
        const ex = doc?.extracted || {};
        setCreateErr("");
        setCreateTarget(doc);

        const defaultProperty = lastRoute?.propertyId || doc?.property || "";
        setCreatePropertyId(defaultProperty);

        setOverrides({
            title: ex.titleSuggestion || doc.originalName || "Maintenance",
            category: ex.category || "General",
            vendor: ex.vendor || "",
            serviceDate: ex.date ? toISODateInput(ex.date) : "",
            cost: typeof ex.amount === "number" ? ex.amount : 0,
            notes: "",
            nextDueDate: "",
            reminderEnabled: false,
        });

        setCreateOpen(true);
    }

    function closeCreate() {
        if (createBusy) return;
        setCreateOpen(false);
        setCreateErr("");
        setCreateTarget(null);
        setCreatePropertyId("");
    }

    async function submitCreate() {
        if (!createTarget) return;

        setCreateBusy(true);
        setCreateErr("");

        try {
            if (!createPropertyId) throw new Error("Please choose a property.");
            if (!overrides.title || !String(overrides.title).trim()) throw new Error("Title is required.");
            if (!overrides.serviceDate) throw new Error("Service date is required.");

            const payload = {
                ...overrides,
                cost: Number(overrides.cost || 0),
                nextDueDate: overrides.nextDueDate || null,
                reminderEnabled: !!overrides.reminderEnabled,
            };

            const res = await api.createLogFromReceipt(createTarget._id, createPropertyId, payload, token);

            const propertyId = res?.data?.log?.property || createPropertyId;
            const logId = res?.data?.log?._id || "";

            setLastRoute?.({ propertyId: propertyId, logId });

            closeCreate();
            closeReview();
            await loadAll();

            nav(`/properties/${propertyId}/maintenance`);
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
                    <p className="hk-subtitle">Upload → review → route it.</p>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <span className="hk-pill">Total: {counts.total}</span>
                    <span className="hk-pill">Unattached: {counts.unattached}</span>
                    <span className="hk-pill">Attached: {counts.attached}</span>
                    <span className="hk-pill" title="Unattached receipts missing vendor/amount/date">
                        Needs review: {counts.needReview}
                    </span>
                </div>
            </div>

            {pageError ? <div className="hk-banner hk-banner-err">{pageError}</div> : null}

            <div className="hk-card hk-card-pad" style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Upload a receipt</div>
                <div className="hk-muted" style={{ fontSize: 13, marginBottom: 10 }}>
                    After upload, Review opens so you can edit fields before routing.
                </div>

                <input
                    ref={uploadRef}
                    type="file"
                    accept="application/pdf,image/*"
                    disabled={busyUpload}
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        handleUpload(f);
                    }}
                />
                {busyUpload ? <div className="hk-muted" style={{ marginTop: 8 }}>Uploading…</div> : null}
            </div>

            <div className="hk-card hk-card-pad" style={{ marginBottom: 12 }}>
                <div className="hk-grid" style={{ gridTemplateColumns: "1fr 220px", gap: 12 }}>
                    <label className="hk-label">
                        Search
                        <input
                            className="hk-input"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="vendor, file name, category..."
                        />
                    </label>

                    <label className="hk-label">
                        Status
                        <select className="hk-input" value={status} onChange={(e) => setStatus(e.target.value)}>
                            <option value="unattached">Inbox (unattached)</option>
                            <option value="attached">Attached</option>
                            <option value="all">All</option>
                        </select>
                    </label>
                </div>
            </div>

            {loading ? (
                <div className="hk-muted">Loading…</div>
            ) : filtered.length === 0 ? (
                <div className="hk-empty">
                    <div className="hk-empty-illus" />
                    <div className="hk-empty-title">Nothing here</div>
                    <div className="hk-empty-desc">Try switching status to “All”.</div>
                </div>
            ) : (
                <ul className="hk-list" style={{ marginTop: 0 }}>
                    {filtered.map((d) => {
                        const ex = d?.extracted || {};
                        const flag = d.status === "unattached" && needsReview(d);

                        return (
                            <li key={d._id}>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start" }}>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: 900, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                                            <span>{d.originalName || "Receipt"}</span>
                                            <span className="hk-pill">{d.status}</span>

                                            {flag ? (
                                                <span
                                                    className="hk-pill"
                                                    style={{
                                                        background: "rgba(239, 68, 68, 0.10)",
                                                        border: "1px solid rgba(239, 68, 68, 0.25)",
                                                        fontWeight: 900,
                                                    }}
                                                    title="Missing vendor / amount / date"
                                                >
                                                    Needs review
                                                </span>
                                            ) : null}
                                        </div>

                                        <div className="hk-muted" style={{ fontSize: 12, marginTop: 4 }}>
                                            Uploaded: {safeDateLabel(d.createdAt) || "—"}
                                            {typeof ex.amount === "number" ? ` • ${money(ex.amount)}` : ""}
                                            {ex.vendor ? ` • ${ex.vendor}` : ""}
                                            {ex.category ? ` • ${ex.category}` : ""}
                                        </div>

                                        <div className="hk-extract-grid">
                                            <div className="hk-extract-item">
                                                <div className="hk-extract-label">Vendor</div>
                                                <div className="hk-extract-value">{ex.vendor || "—"}</div>
                                            </div>
                                            <div className="hk-extract-item">
                                                <div className="hk-extract-label">Amount</div>
                                                <div className="hk-extract-value">{typeof ex.amount === "number" ? money(ex.amount) : "—"}</div>
                                            </div>
                                            <div className="hk-extract-item">
                                                <div className="hk-extract-label">Receipt date</div>
                                                <div className="hk-extract-value">{ex.date ? safeDateLabel(ex.date) : "—"}</div>
                                            </div>
                                            <div className="hk-extract-item" style={{ gridColumn: "span 3" }}>
                                                <div className="hk-extract-label">Title suggestion</div>
                                                <div className="hk-extract-value">{ex.titleSuggestion || "—"}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "stretch" }}>
                                        <button className="hk-btn hk-btn-sm" type="button" onClick={() => openReview(d)}>
                                            Review / Route…
                                        </button>

                                        <button className="hk-btn hk-btn-ghost hk-btn-sm" type="button" onClick={() => openPreview(d)}>
                                            Preview
                                        </button>

                                        <button
                                            className="hk-btn hk-btn-ghost hk-btn-sm"
                                            type="button"
                                            disabled={busyRescanId === d._id}
                                            onClick={() => handleRescan(d)}
                                        >
                                            {busyRescanId === d._id ? "Re-scanning…" : "Re-scan"}
                                        </button>

                                        <button
                                            className="hk-btn hk-btn-ghost hk-btn-sm"
                                            type="button"
                                            disabled={busyDeleteId === d._id}
                                            onClick={() => handleDelete(d._id)}
                                        >
                                            {busyDeleteId === d._id ? "Deleting…" : "Delete"}
                                        </button>

                                        {d.status === "attached" && d.property ? (
                                            <button className="hk-btn hk-btn-ghost hk-btn-sm" type="button" onClick={() => nav(`/properties/${d.property}/maintenance`)}>
                                                Open log →
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            <Modal open={reviewOpen} title="Review receipt (edit before routing)" onClose={closeReview} disableClose={reviewBusy}>
                {reviewErr ? <div className="hk-banner hk-banner-err">{reviewErr}</div> : null}

                {!reviewDoc ? null : (
                    <>
                        <div className="hk-muted" style={{ fontSize: 13, marginBottom: 10 }}>
                            File: <strong>{reviewDoc.originalName || "Receipt"}</strong> • Status: <strong>{reviewDoc.status}</strong>
                        </div>

                        <div className="hk-form">
                            <label className="hk-label">
                                Vendor
                                <input
                                    className="hk-input"
                                    value={reviewFields.vendor}
                                    onChange={(e) => setReviewFields((s) => ({ ...s, vendor: e.target.value }))}
                                    disabled={reviewBusy}
                                />
                            </label>

                            <div className="hk-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                <label className="hk-label">
                                    Amount
                                    <input
                                        className="hk-input"
                                        type="number"
                                        step="0.01"
                                        value={reviewFields.amount}
                                        onChange={(e) => setReviewFields((s) => ({ ...s, amount: e.target.value }))}
                                        disabled={reviewBusy}
                                    />
                                </label>

                                <label className="hk-label">
                                    Receipt date
                                    <input
                                        className="hk-input"
                                        type="date"
                                        value={reviewFields.date}
                                        onChange={(e) => setReviewFields((s) => ({ ...s, date: e.target.value }))}
                                        disabled={reviewBusy}
                                    />
                                </label>
                            </div>

                            <label className="hk-label">
                                Category
                                <input
                                    className="hk-input"
                                    value={reviewFields.category}
                                    onChange={(e) => setReviewFields((s) => ({ ...s, category: e.target.value }))}
                                    disabled={reviewBusy}
                                />
                            </label>

                            <label className="hk-label">
                                Title suggestion
                                <input
                                    className="hk-input"
                                    value={reviewFields.titleSuggestion}
                                    onChange={(e) => setReviewFields((s) => ({ ...s, titleSuggestion: e.target.value }))}
                                    disabled={reviewBusy}
                                />
                            </label>

                            <div style={{ display: "flex", gap: 10, justifyContent: "space-between", flexWrap: "wrap" }}>
                                <button className="hk-btn hk-btn-ghost" type="button" onClick={() => openPreview(reviewDoc)} disabled={reviewBusy}>
                                    Preview
                                </button>

                                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                                    <button className="hk-btn hk-btn-ghost" type="button" onClick={closeReview} disabled={reviewBusy}>
                                        Close
                                    </button>

                                    <button className="hk-btn" type="button" onClick={saveReviewEdits} disabled={reviewBusy}>
                                        {reviewBusy ? "Saving…" : "Save (keep in inbox)"}
                                    </button>

                                    <button className="hk-btn hk-btn-ghost" type="button" onClick={() => openAttach(reviewDoc)} disabled={reviewBusy}>
                                        Attach to log…
                                    </button>

                                    <button className="hk-btn hk-btn-ghost" type="button" onClick={() => openCreate(reviewDoc)} disabled={reviewBusy}>
                                        Create log…
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </Modal>

            <Modal open={previewOpen} title={`Preview: ${previewName || "receipt"}`} onClose={closePreview} disableClose={previewBusy}>
                {previewErr ? <div className="hk-banner hk-banner-err">{previewErr}</div> : null}
                {previewBusy ? <div className="hk-muted">Loading preview…</div> : null}

                {!previewBusy && previewUrl ? (
                    <div className="hk-card hk-card-pad hk-subcard">
                        {previewType.includes("pdf") ? (
                            <iframe title="Receipt preview" className="hk-iframe" src={previewUrl} />
                        ) : previewType.startsWith("image/") ? (
                            <img className="hk-preview-img" src={previewUrl} alt="Receipt preview" />
                        ) : (
                            <div className="hk-muted">Preview not available for this file type.</div>
                        )}
                    </div>
                ) : null}
            </Modal>

            <Modal open={attachOpen} title="Attach receipt to existing log" onClose={closeAttach} disableClose={attachBusy}>
                {attachErr ? <div className="hk-banner hk-banner-err">{attachErr}</div> : null}
                {!attachTarget ? null : (
                    <div className="hk-form">
                        <label className="hk-label">
                            Property
                            <select
                                className="hk-input"
                                value={attachPropertyId}
                                onChange={(e) => {
                                    const next = e.target.value;
                                    setAttachPropertyId(next);
                                    loadLogsForProperty(next);
                                }}
                                disabled={attachBusy}
                            >
                                <option value="">Select a property…</option>
                                {properties.map((p) => {
                                    const label = p.nickname || p.city || p.addressLine1 || "Property";
                                    return (
                                        <option key={p._id} value={p._id}>
                                            {label}
                                        </option>
                                    );
                                })}
                            </select>
                        </label>

                        <label className="hk-label">
                            Maintenance log
                            <select
                                className="hk-input"
                                value={attachLogId}
                                onChange={(e) => setAttachLogId(e.target.value)}
                                disabled={attachBusy || attachLogsLoading || !attachPropertyId}
                            >
                                <option value="">{attachLogsLoading ? "Loading logs…" : "Select a log…"}</option>
                                {attachLogs.map((l) => (
                                    <option key={l._id} value={l._id}>
                                        {l.title || "Log"} {l.serviceDate ? `• ${safeDateLabel(l.serviceDate)}` : ""}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                            <button className="hk-btn hk-btn-ghost" type="button" onClick={closeAttach} disabled={attachBusy}>
                                Cancel
                            </button>
                            <button className="hk-btn" type="button" onClick={submitAttach} disabled={attachBusy}>
                                {attachBusy ? "Attaching…" : "Attach"}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal open={createOpen} title="Create maintenance log from receipt" onClose={closeCreate} disableClose={createBusy}>
                {createErr ? <div className="hk-banner hk-banner-err">{createErr}</div> : null}
                {!createTarget ? null : (
                    <div className="hk-form">
                        <label className="hk-label">
                            Property
                            <select
                                className="hk-input"
                                value={createPropertyId}
                                onChange={(e) => setCreatePropertyId(e.target.value)}
                                disabled={createBusy}
                            >
                                <option value="">Select a property…</option>
                                {properties.map((p) => {
                                    const label = p.nickname || p.city || p.addressLine1 || "Property";
                                    return (
                                        <option key={p._id} value={p._id}>
                                            {label}
                                        </option>
                                    );
                                })}
                            </select>
                        </label>

                        <label className="hk-label">
                            Title
                            <input
                                className="hk-input"
                                value={overrides.title}
                                onChange={(e) => setOverrides((o) => ({ ...o, title: e.target.value }))}
                                disabled={createBusy}
                            />
                        </label>

                        <div className="hk-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <label className="hk-label">
                                Vendor
                                <input
                                    className="hk-input"
                                    value={overrides.vendor}
                                    onChange={(e) => setOverrides((o) => ({ ...o, vendor: e.target.value }))}
                                    disabled={createBusy}
                                />
                            </label>
                            <label className="hk-label">
                                Category
                                <input
                                    className="hk-input"
                                    value={overrides.category}
                                    onChange={(e) => setOverrides((o) => ({ ...o, category: e.target.value }))}
                                    disabled={createBusy}
                                />
                            </label>
                        </div>

                        <div className="hk-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <label className="hk-label">
                                Service date
                                <input
                                    className="hk-input"
                                    type="date"
                                    value={overrides.serviceDate}
                                    onChange={(e) => setOverrides((o) => ({ ...o, serviceDate: e.target.value }))}
                                    disabled={createBusy}
                                />
                            </label>
                            <label className="hk-label">
                                Cost
                                <input
                                    className="hk-input"
                                    type="number"
                                    step="0.01"
                                    value={overrides.cost}
                                    onChange={(e) => setOverrides((o) => ({ ...o, cost: e.target.value }))}
                                    disabled={createBusy}
                                />
                            </label>
                        </div>

                        <label className="hk-label">
                            Notes (optional)
                            <textarea
                                className="hk-textarea"
                                value={overrides.notes}
                                onChange={(e) => setOverrides((o) => ({ ...o, notes: e.target.value }))}
                                disabled={createBusy}
                            />
                        </label>

                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                            <button className="hk-btn hk-btn-ghost" type="button" onClick={closeCreate} disabled={createBusy}>
                                Cancel
                            </button>
                            <button className="hk-btn" type="button" onClick={submitCreate} disabled={createBusy}>
                                {createBusy ? "Creating…" : "Create log"}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}

