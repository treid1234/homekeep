import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext.jsx";

export default function MaintenancePage() {
    const { token } = useAuth();
    const { propertyId } = useParams();

    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState("");
    const [actionMsg, setActionMsg] = useState("");

    const [logs, setLogs] = useState([]);

    // Create form (manual + can be auto-filled)
    const [form, setForm] = useState({
        title: "",
        category: "General",
        vendor: "",
        serviceDate: "",
        cost: "",
        notes: "",
        nextDueDate: "",
        reminderEnabled: true,
    });

    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState("");

    // Documents state (per maintenance log)
    const [docsByLogId, setDocsByLogId] = useState({});
    const [docsLoadingByLogId, setDocsLoadingByLogId] = useState({});
    const [docsErrorByLogId, setDocsErrorByLogId] = useState({});
    const [docActionLoadingById, setDocActionLoadingById] = useState({});

    // Upload + Scan state (per existing log)
    const [scanFileByLogId, setScanFileByLogId] = useState({});
    const [scanStatusByLogId, setScanStatusByLogId] = useState({});
    const [scanBusyByLogId, setScanBusyByLogId] = useState({});
    const [scanExtractedByLogId, setScanExtractedByLogId] = useState({});

    // NEW: Create from receipt (unattached receipt -> extracted -> create log -> attach)
    const [newReceiptFile, setNewReceiptFile] = useState(null);
    const [newReceiptBusy, setNewReceiptBusy] = useState(false);
    const [newReceiptStatus, setNewReceiptStatus] = useState("");
    const [newReceiptDocId, setNewReceiptDocId] = useState(null);
    const [newExtracted, setNewExtracted] = useState(null);

    // Track which fields were extracted for badges (for the create form)
    const [extractedFields, setExtractedFields] = useState({
        title: false,
        vendor: false,
        category: false,
        cost: false,
        serviceDate: false,
    });

    // Preview modal
    const [preview, setPreview] = useState(null); // { url, mimeType, name }
    const previewUrlRef = useRef(null);

    function unwrap(result) {
        const body = result?.data ? result.data : result;
        if (!body) return null;
        if (typeof body === "object" && body.data && typeof body.data === "object") return body.data;
        return body;
    }

    function updateField(key, value) {
        setForm((f) => ({ ...f, [key]: value }));
        // If user edits a field manually, remove extracted badge for that field (nice UX)
        if (key in extractedFields) {
            setExtractedFields((prev) => ({ ...prev, [key]: false }));
        }
    }

    function applyExtractedToForm(extracted) {
        if (!extracted) return;

        const hasTitle = !!extracted.titleSuggestion;
        const hasVendor = !!extracted.vendor;
        const hasCategory = !!extracted.category;
        const hasCost = typeof extracted.amount === "number";
        const hasDate = !!extracted.date;

        setForm((prev) => ({
            ...prev,
            title: hasTitle ? extracted.titleSuggestion : prev.title,
            vendor: hasVendor ? extracted.vendor : prev.vendor,
            category: hasCategory ? extracted.category : prev.category,
            cost: hasCost ? Number(extracted.amount).toFixed(2) : prev.cost,
            serviceDate: hasDate ? new Date(extracted.date).toISOString().slice(0, 10) : prev.serviceDate,
        }));

        setExtractedFields({
            title: hasTitle,
            vendor: hasVendor,
            category: hasCategory,
            cost: hasCost,
            serviceDate: hasDate,
        });
    }

    async function loadDocumentsForLog(logId) {
        setDocsLoadingByLogId((prev) => ({ ...prev, [logId]: true }));
        setDocsErrorByLogId((prev) => ({ ...prev, [logId]: "" }));

        try {
            const res = await api.listMaintenanceDocuments(propertyId, logId, token);
            const payload = unwrap(res);
            const docs = payload?.documents || payload?.docs || payload?.items || [];
            setDocsByLogId((prev) => ({ ...prev, [logId]: Array.isArray(docs) ? docs : [] }));
        } catch (err) {
            setDocsErrorByLogId((prev) => ({
                ...prev,
                [logId]: err.message || "Failed to load documents.",
            }));
        } finally {
            setDocsLoadingByLogId((prev) => ({ ...prev, [logId]: false }));
        }
    }

    async function load() {
        setLoading(true);
        setPageError("");
        setActionMsg("");

        try {
            const res = await api.listMaintenance(propertyId, token);
            const payload = unwrap(res);

            const items = payload?.logs || payload?.maintenance || payload?.items || [];
            const arr = Array.isArray(items) ? items : [];
            setLogs(arr);

            await Promise.all(arr.map((log) => loadDocumentsForLog(log._id)));
        } catch (err) {
            setPageError(err.message || "Failed to load maintenance logs.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [propertyId]);

    // Cleanup preview object URL on unmount / change
    useEffect(() => {
        return () => {
            if (previewUrlRef.current) {
                URL.revokeObjectURL(previewUrlRef.current);
                previewUrlRef.current = null;
            }
        };
    }, []);

    // Cleanup: if user uploaded a new receipt (unattached) but navigates away without saving log
    useEffect(() => {
        return () => {
            // best-effort cleanup; do not throw
            if (newReceiptDocId && token && api?.deleteReceipt) {
                api.deleteReceipt(newReceiptDocId, token).catch(() => { });
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [newReceiptDocId]);

    async function handleCreate(e) {
        e.preventDefault();
        setFormError("");
        setActionMsg("");

        if (!form.title.trim()) {
            setFormError("Title is required.");
            return;
        }

        const payload = {
            title: form.title.trim(),
            category: form.category?.trim() || "General",
            vendor: form.vendor?.trim() || "",
            serviceDate: form.serviceDate ? form.serviceDate : null,
            cost: form.cost === "" ? null : Number(form.cost),
            notes: form.notes?.trim() || "",
            nextDueDate: form.nextDueDate ? form.nextDueDate : null,
            reminderEnabled: !!form.reminderEnabled,
        };

        setSubmitting(true);
        try {
            await api.createMaintenance(propertyId, payload, token);

            setForm((f) => ({
                ...f,
                title: "",
                vendor: "",
                serviceDate: "",
                cost: "",
                notes: "",
                nextDueDate: "",
            }));

            setExtractedFields({
                title: false,
                vendor: false,
                category: false,
                cost: false,
                serviceDate: false,
            });

            await load();
            setActionMsg("Maintenance log saved ✅");
        } catch (err) {
            setFormError(err.message || "Failed to create maintenance log.");
        } finally {
            setSubmitting(false);
        }
    }

    /* ================= NEW FLOW: Upload & Scan -> Create Log -> Attach Receipt ================= */

    async function handleNewUploadAndScan() {
        setActionMsg("");
        setNewReceiptStatus("");

        if (!newReceiptFile) {
            setNewReceiptStatus("Please select a receipt file first.");
            return;
        }

        setNewReceiptBusy(true);
        try {
            setNewReceiptStatus("Uploading…");
            const uploadRes = await api.uploadReceipt(newReceiptFile, token);
            const payload = unwrap(uploadRes) || {};

            const documentId =
                payload?.documentId ||
                payload?.document?._id ||
                payload?._id ||
                uploadRes?.data?.documentId ||
                uploadRes?.data?.document?._id;

            const extracted =
                payload?.extracted ||
                payload?.document?.extracted ||
                uploadRes?.data?.extracted ||
                uploadRes?.data?.document?.extracted ||
                null;

            if (!documentId) throw new Error("Receipt upload succeeded but no documentId was returned.");

            setNewReceiptDocId(documentId);
            setNewExtracted(extracted || {});
            applyExtractedToForm(extracted || {});

            setNewReceiptStatus("Scanned ✅ (review fields, then Save log / attach receipt)");
            setActionMsg("Receipt scanned — review the suggested fields ✅");
        } catch (err) {
            setNewReceiptStatus(err.message || "Upload and scan failed.");
        } finally {
            setNewReceiptBusy(false);
        }
    }

    async function handleSaveLogAndAttachReceipt(e) {
        e.preventDefault();
        setFormError("");
        setActionMsg("");
        setNewReceiptStatus("");

        if (!newReceiptDocId) {
            setFormError("Please upload and scan a receipt first.");
            return;
        }

        if (!form.title.trim()) {
            setFormError("Title is required.");
            return;
        }

        // IMPORTANT: serviceDate is required in your MaintenanceLog schema
        if (!form.serviceDate) {
            setFormError("Service date is required (add it or scan a receipt that contains it).");
            return;
        }

        const payload = {
            title: form.title.trim(),
            category: form.category?.trim() || "General",
            vendor: form.vendor?.trim() || "",
            serviceDate: form.serviceDate,
            cost: form.cost === "" ? 0 : Number(form.cost),
            notes: form.notes?.trim() || "",
            nextDueDate: form.nextDueDate ? form.nextDueDate : null,
            reminderEnabled: !!form.reminderEnabled,
        };

        setSubmitting(true);
        try {
            // 1) Create log
            const createdRes = await api.createMaintenance(propertyId, payload, token);
            const createdPayload = unwrap(createdRes) || {};
            const createdLog =
                createdPayload?.log || createdPayload?.maintenanceLog || createdPayload?.item || createdPayload;

            const logId = createdLog?._id;
            if (!logId) {
                throw new Error("Log created but could not find logId. Check createMaintenance response shape.");
            }

            // 2) Attach receipt to newly created log
            await api.attachReceipt(newReceiptDocId, propertyId, logId, token);

            // 3) Clear receipt state so cleanup doesn't delete it
            setNewReceiptFile(null);
            setNewReceiptDocId(null);
            setNewExtracted(null);

            // 4) Reset form
            setForm((f) => ({
                ...f,
                title: "",
                vendor: "",
                serviceDate: "",
                cost: "",
                notes: "",
                nextDueDate: "",
            }));

            setExtractedFields({
                title: false,
                vendor: false,
                category: false,
                cost: false,
                serviceDate: false,
            });

            await load();
            setActionMsg("Log created + receipt attached ✅");
        } catch (err) {
            setFormError(err.message || "Server error while saving and attaching receipt.");
        } finally {
            setSubmitting(false);
        }
    }

    async function handleCancelNewReceipt() {
        setActionMsg("");
        setNewReceiptStatus("");

        const docId = newReceiptDocId;
        setNewReceiptFile(null);
        setNewReceiptDocId(null);
        setNewExtracted(null);

        // reset extracted badges (but keep user values)
        setExtractedFields({
            title: false,
            vendor: false,
            category: false,
            cost: false,
            serviceDate: false,
        });

        if (docId) {
            try {
                await api.deleteReceipt(docId, token);
                setActionMsg("Unattached receipt removed ✅");
            } catch {
                // ignore
            }
        }
    }

    /* ================= EXISTING LOG FLOW: Upload & Scan & Attach ================= */

    function setScanStatus(logId, msg) {
        setScanStatusByLogId((prev) => ({ ...prev, [logId]: msg }));
    }

    async function handleUploadAndScan(logId) {
        setActionMsg("");
        setScanStatus(logId, "");

        const file = scanFileByLogId[logId];
        if (!file) {
            setScanStatus(logId, "Please select a receipt file first.");
            return;
        }

        if (!api.uploadReceipt) {
            setScanStatus(logId, "api.uploadReceipt is missing in src/services/api.js");
            return;
        }
        if (!api.attachReceipt) {
            setScanStatus(logId, "api.attachReceipt is missing in src/services/api.js");
            return;
        }

        setScanBusyByLogId((prev) => ({ ...prev, [logId]: true }));

        try {
            setScanStatus(logId, "Uploading…");

            const uploadRes = await api.uploadReceipt(file, token);
            const uploadPayload = unwrap(uploadRes) || {};

            const documentId =
                uploadPayload?.documentId ||
                uploadPayload?.document?._id ||
                uploadPayload?._id ||
                uploadRes?.data?.documentId ||
                uploadRes?.data?.document?._id;

            const extracted =
                uploadPayload?.extracted ||
                uploadPayload?.document?.extracted ||
                uploadRes?.data?.extracted ||
                uploadRes?.data?.document?.extracted ||
                null;

            if (!documentId) {
                throw new Error("Receipt upload succeeded but no documentId was returned.");
            }

            setScanStatus(logId, "Attaching…");
            await api.attachReceipt(documentId, propertyId, logId, token);

            setScanExtractedByLogId((prev) => ({ ...prev, [logId]: extracted || {} }));
            setScanFileByLogId((prev) => ({ ...prev, [logId]: null }));

            await loadDocumentsForLog(logId);

            setScanStatus(logId, "Uploaded + attached ✅");
            setActionMsg("Receipt uploaded and scanned ✅");
        } catch (err) {
            setScanStatus(logId, err.message || "Upload and scan failed.");
        } finally {
            setScanBusyByLogId((prev) => ({ ...prev, [logId]: false }));
        }
    }

    /* ================= Docs download / delete / preview ================= */

    async function handleDownloadDoc(logId, documentId) {
        setActionMsg("Starting download…");

        try {
            setDocActionLoadingById((prev) => ({ ...prev, [documentId]: true }));

            const { blob, filename } = await api.downloadMaintenanceDocument(propertyId, logId, documentId, token);

            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename || "document";
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);

            setActionMsg("Download started ✅");
        } catch (err) {
            setActionMsg(err.message || "Download failed.");
        } finally {
            setDocActionLoadingById((prev) => ({ ...prev, [documentId]: false }));
        }
    }

    async function handlePreviewDoc(logId, doc) {
        setActionMsg("");

        try {
            setDocActionLoadingById((prev) => ({ ...prev, [doc._id]: true }));

            const { blob, filename } = await api.downloadMaintenanceDocument(propertyId, logId, doc._id, token);

            // cleanup old preview url
            if (previewUrlRef.current) {
                URL.revokeObjectURL(previewUrlRef.current);
                previewUrlRef.current = null;
            }

            const url = URL.createObjectURL(blob);
            previewUrlRef.current = url;

            setPreview({
                url,
                mimeType: doc.mimeType || blob.type || "application/octet-stream",
                name: doc.originalName || filename || "Receipt",
            });
        } catch (err) {
            setActionMsg(err.message || "Preview failed.");
        } finally {
            setDocActionLoadingById((prev) => ({ ...prev, [doc._id]: false }));
        }
    }

    function closePreview() {
        if (previewUrlRef.current) {
            URL.revokeObjectURL(previewUrlRef.current);
            previewUrlRef.current = null;
        }
        setPreview(null);
    }

    async function handleDeleteDoc(logId, documentId) {
        setActionMsg("");

        try {
            const ok = window.confirm("Delete this document?");
            if (!ok) return;

            setDocActionLoadingById((prev) => ({ ...prev, [documentId]: true }));

            await api.deleteMaintenanceDocument(propertyId, logId, documentId, token);
            await loadDocumentsForLog(logId);

            setActionMsg("Document deleted ✅");
        } catch (err) {
            setActionMsg(err.message || "Delete failed.");
        } finally {
            setDocActionLoadingById((prev) => ({ ...prev, [documentId]: false }));
        }
    }

    async function handleDeleteLog(logId) {
        setActionMsg("");

        try {
            const ok = window.confirm("Delete this maintenance log? (Any attached documents will be removed too.)");
            if (!ok) return;

            await api.deleteMaintenanceLog(propertyId, logId, token);
            await load();

            setActionMsg("Maintenance log deleted ✅");
        } catch (err) {
            setActionMsg(err.message || "Delete failed.");
        }
    }

    const logCountLabel = useMemo(() => {
        const n = logs.length;
        return `${n} log${n === 1 ? "" : "s"}`;
    }, [logs.length]);

    return (
        <div className="hk-container">
            <div className="hk-header">
                <div>
                    <h2 className="hk-title">Maintenance</h2>
                    <p className="hk-subtitle">Track repairs and upkeep. Upload receipts and auto-fill details.</p>
                </div>

                <Link className="hk-link" to="/properties">
                    ← Back to properties
                </Link>
            </div>

            {actionMsg && (
                <div className={actionMsg.includes("✅") ? "hk-muted" : "hk-error"} style={{ marginBottom: 12 }}>
                    {actionMsg}
                </div>
            )}

            <div className="hk-split">
                {/* LEFT */}
                <section className="hk-card hk-card-pad">
                    <div className="hk-row" style={{ marginBottom: 10 }}>
                        <h3 className="hk-section-title">Add maintenance log</h3>
                        <span className="hk-pill">HomeKeep</span>
                    </div>

                    {/* ✅ NEW: Upload receipt first -> auto-fill -> Save log + attach */}
                    <div style={{ marginBottom: 14 }}>
                        <div className="hk-muted" style={{ fontSize: 13, marginBottom: 6, fontWeight: 800 }}>
                            Create from receipt (Upload & Scan)
                        </div>

                        <div className="hk-actions" style={{ alignItems: "center" }}>
                            <input
                                className="hk-input"
                                type="file"
                                accept="application/pdf,image/*"
                                onChange={(e) => setNewReceiptFile(e.target.files?.[0] || null)}
                                style={{ maxWidth: 360 }}
                            />

                            <button
                                type="button"
                                className="hk-btn"
                                disabled={newReceiptBusy}
                                onClick={handleNewUploadAndScan}
                            >
                                {newReceiptBusy ? "Working…" : "Upload & scan"}
                            </button>

                            {!!newReceiptDocId && (
                                <button type="button" className="hk-btn hk-btn-ghost" onClick={handleCancelNewReceipt}>
                                    Cancel
                                </button>
                            )}
                        </div>

                        {newReceiptStatus && (
                            <div className={newReceiptStatus.includes("✅") ? "hk-muted" : "hk-error"} style={{ fontSize: 13, marginTop: 8 }}>
                                {newReceiptStatus}
                            </div>
                        )}

                        {newExtracted && (
                            <div className="hk-muted" style={{ fontSize: 12, marginTop: 6 }}>
                                <strong>Scan summary:</strong>{" "}
                                {newExtracted.vendor ? `Vendor: ${newExtracted.vendor} • ` : ""}
                                {typeof newExtracted.amount === "number" ? `Amount: $${newExtracted.amount.toFixed(2)} • ` : ""}
                                {newExtracted.date ? `Date: ${new Date(newExtracted.date).toLocaleDateString()}` : ""}
                            </div>
                        )}

                        <div className="hk-divider" style={{ marginTop: 12 }} />
                    </div>

                    {/* Form (manual OR auto-filled from scan) */}
                    <form onSubmit={newReceiptDocId ? handleSaveLogAndAttachReceipt : handleCreate} className="hk-form">
                        <label className="hk-label">
                            Title * {extractedFields.title && <ExtractedBadge />}
                            <input
                                className="hk-input"
                                value={form.title}
                                onChange={(e) => updateField("title", e.target.value)}
                                placeholder="e.g., Dishwasher replacement"
                            />
                        </label>

                        <label className="hk-label">
                            Category {extractedFields.category && <ExtractedBadge />}
                            <input
                                className="hk-input"
                                value={form.category}
                                onChange={(e) => updateField("category", e.target.value)}
                                placeholder="General / Electrical / Plumbing…"
                            />
                        </label>

                        <label className="hk-label">
                            Vendor {extractedFields.vendor && <ExtractedBadge />}
                            <input
                                className="hk-input"
                                value={form.vendor}
                                onChange={(e) => updateField("vendor", e.target.value)}
                                placeholder="e.g., The Brick"
                            />
                        </label>

                        <div className="hk-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                            <label className="hk-label">
                                Service date {extractedFields.serviceDate && <ExtractedBadge />}
                                <input
                                    className="hk-input"
                                    type="date"
                                    value={form.serviceDate}
                                    onChange={(e) => updateField("serviceDate", e.target.value)}
                                />
                            </label>

                            <label className="hk-label">
                                Cost {extractedFields.cost && <ExtractedBadge />}
                                <input
                                    className="hk-input"
                                    inputMode="decimal"
                                    value={form.cost}
                                    onChange={(e) => updateField("cost", e.target.value)}
                                    placeholder="e.g., 537.60"
                                />
                            </label>
                        </div>

                        <div className="hk-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                            <label className="hk-label">
                                Next due date
                                <input
                                    className="hk-input"
                                    type="date"
                                    value={form.nextDueDate}
                                    onChange={(e) => updateField("nextDueDate", e.target.value)}
                                />
                            </label>

                            <label className="hk-label" style={{ alignContent: "end" }}>
                                <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                    <input
                                        type="checkbox"
                                        checked={!!form.reminderEnabled}
                                        onChange={(e) => updateField("reminderEnabled", e.target.checked)}
                                    />
                                    Enable reminders
                                </span>
                            </label>
                        </div>

                        <label className="hk-label">
                            Notes
                            <textarea
                                className="hk-textarea"
                                rows={3}
                                value={form.notes}
                                onChange={(e) => updateField("notes", e.target.value)}
                                placeholder="Anything you want to remember…"
                            />
                        </label>

                        {formError && <div className="hk-error">{formError}</div>}

                        <div className="hk-actions">
                            <button className="hk-btn" disabled={submitting} type="submit">
                                {submitting
                                    ? "Saving…"
                                    : newReceiptDocId
                                        ? "Save log / attach receipt"
                                        : "Save log"}
                            </button>
                        </div>
                    </form>
                </section>

                {/* RIGHT */}
                <section className="hk-card hk-card-pad">
                    <div className="hk-row" style={{ marginBottom: 10 }}>
                        <div>
                            <h3 className="hk-section-title">Logs</h3>
                            <div className="hk-muted" style={{ fontSize: 13 }}>
                                {logCountLabel}
                            </div>
                        </div>

                        <button type="button" className="hk-btn" onClick={load} disabled={loading}>
                            Refresh
                        </button>
                    </div>

                    {pageError && <div className="hk-error">{pageError}</div>}

                    {loading ? (
                        <div className="hk-muted">Loading…</div>
                    ) : logs.length === 0 ? (
                        <div className="hk-muted">No maintenance logs yet.</div>
                    ) : (
                        <ul className="hk-list" style={{ marginTop: 0 }}>
                            {logs.map((log) => {
                                const docs = docsByLogId[log._id] || [];
                                const docsLoading = !!docsLoadingByLogId[log._id];
                                const docsError = docsErrorByLogId[log._id];

                                const scanBusy = !!scanBusyByLogId[log._id];
                                const scanStatus = scanStatusByLogId[log._id];
                                const extracted = scanExtractedByLogId[log._id] || null;

                                return (
                                    <li key={log._id} style={{ marginBottom: 14 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                                            <div>
                                                <div style={{ fontWeight: 900 }}>{log.title}</div>

                                                <div className="hk-muted" style={{ fontSize: 13 }}>
                                                    {log.category ? `${log.category} • ` : ""}
                                                    {log.serviceDate ? new Date(log.serviceDate).toLocaleDateString() : "No service date"}
                                                    {typeof log.cost === "number" ? ` • $${log.cost.toFixed(2)}` : ""}
                                                </div>

                                                <div className="hk-muted" style={{ fontSize: 13 }}>
                                                    Next due: {log.nextDueDate ? new Date(log.nextDueDate).toLocaleDateString() : "—"}
                                                </div>
                                            </div>

                                            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                                <span className="hk-pill">{log.reminderEnabled ? "Reminders On" : "Reminders Off"}</span>

                                                <button type="button" className="hk-btn" onClick={() => handleDeleteLog(log._id)}>
                                                    Delete log
                                                </button>
                                            </div>
                                        </div>

                                        {/* Upload & Scan for existing */}
                                        <div style={{ marginTop: 10 }}>
                                            <div className="hk-muted" style={{ fontSize: 13, marginBottom: 6, fontWeight: 700 }}>
                                                Upload & scan receipt (attach to this log)
                                            </div>

                                            <div className="hk-actions" style={{ alignItems: "center" }}>
                                                <input
                                                    className="hk-input"
                                                    type="file"
                                                    accept="application/pdf,image/*"
                                                    onChange={(e) =>
                                                        setScanFileByLogId((prev) => ({
                                                            ...prev,
                                                            [log._id]: e.target.files?.[0] || null,
                                                        }))
                                                    }
                                                    style={{ maxWidth: 360 }}
                                                />

                                                <button
                                                    type="button"
                                                    className="hk-btn"
                                                    disabled={scanBusy}
                                                    onClick={() => handleUploadAndScan(log._id)}
                                                >
                                                    {scanBusy ? "Working…" : "Upload and scan"}
                                                </button>

                                                {scanStatus && (
                                                    <span
                                                        className={scanStatus.includes("✅") ? "hk-muted" : "hk-error"}
                                                        style={{ fontSize: 13 }}
                                                    >
                                                        {scanStatus}
                                                    </span>
                                                )}
                                            </div>

                                            {extracted && Object.keys(extracted).length > 0 && (
                                                <div className="hk-muted" style={{ fontSize: 13, marginTop: 8 }}>
                                                    <strong>Extracted:</strong>{" "}
                                                    {extracted.vendor ? `Vendor: ${extracted.vendor} • ` : ""}
                                                    {typeof extracted.amount === "number" ? `Amount: $${extracted.amount.toFixed(2)} • ` : ""}
                                                    {extracted.date ? `Date: ${new Date(extracted.date).toLocaleDateString()}` : ""}
                                                </div>
                                            )}
                                        </div>

                                        {/* Documents list */}
                                        <div style={{ marginTop: 12 }}>
                                            <div className="hk-muted" style={{ fontSize: 13, marginBottom: 6, fontWeight: 700 }}>
                                                Documents
                                            </div>

                                            {docsLoading ? (
                                                <div className="hk-muted" style={{ fontSize: 13 }}>
                                                    Loading documents…
                                                </div>
                                            ) : docsError ? (
                                                <div className="hk-error" style={{ fontSize: 13 }}>
                                                    {docsError}
                                                </div>
                                            ) : docs.length === 0 ? (
                                                <div className="hk-muted" style={{ fontSize: 13 }}>
                                                    No documents uploaded yet.
                                                </div>
                                            ) : (
                                                <ul className="hk-list" style={{ marginTop: 0 }}>
                                                    {docs.map((d) => {
                                                        const busy = !!docActionLoadingById[d._id];

                                                        return (
                                                            <li key={d._id} style={{ marginBottom: 10 }}>
                                                                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                                                                    <div>
                                                                        <div style={{ fontWeight: 800 }}>{d.originalName || "Document"}</div>
                                                                        <div className="hk-muted" style={{ fontSize: 12 }}>
                                                                            {typeof d.size === "number" ? `${Math.round(d.size / 1024)} KB` : ""}
                                                                            {d.extracted?.vendor ? ` • ${d.extracted.vendor}` : ""}
                                                                            {typeof d.extracted?.amount === "number" ? ` • $${d.extracted.amount.toFixed(2)}` : ""}
                                                                            {d.extracted?.date ? ` • ${new Date(d.extracted.date).toLocaleDateString()}` : ""}
                                                                        </div>
                                                                    </div>

                                                                    <div style={{ display: "flex", gap: 8 }}>
                                                                        <button
                                                                            type="button"
                                                                            className="hk-btn"
                                                                            disabled={busy}
                                                                            onClick={() => handlePreviewDoc(log._id, d)}
                                                                        >
                                                                            {busy ? "Working…" : "Preview"}
                                                                        </button>

                                                                        <button
                                                                            type="button"
                                                                            className="hk-btn"
                                                                            disabled={busy}
                                                                            onClick={() => handleDownloadDoc(log._id, d._id)}
                                                                        >
                                                                            {busy ? "Working…" : "Download"}
                                                                        </button>

                                                                        <button
                                                                            type="button"
                                                                            className="hk-btn"
                                                                            disabled={busy}
                                                                            onClick={() => handleDeleteDoc(log._id, d._id)}
                                                                        >
                                                                            {busy ? "Working…" : "Delete"}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            )}
                                        </div>

                                        <div className="hk-divider" />
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>
            </div>

            {/* Preview Modal */}
            <ReceiptPreviewModal preview={preview} onClose={closePreview} />
        </div>
    );
}

/* ================= Small UI bits ================= */

function ExtractedBadge() {
    return (
        <span
            style={{
                marginLeft: 6,
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 999,
                background: "rgba(99,102,241,0.12)",
                color: "#6366f1",
                fontWeight: 700,
                verticalAlign: "middle",
            }}
        >
            extracted
        </span>
    );
}

function ReceiptPreviewModal({ preview, onClose }) {
    if (!preview) return null;

    const isPdf = (preview.mimeType || "").includes("pdf");

    return (
        <div
            className="hk-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="Receipt preview"
            onClick={onClose}
        >
            <div className="hk-modal" onClick={(e) => e.stopPropagation()}>
                <div className="hk-row" style={{ marginBottom: 10 }}>
                    <div style={{ fontWeight: 900 }}>{preview.name || "Receipt preview"}</div>
                    <button type="button" className="hk-btn" onClick={onClose}>
                        Close
                    </button>
                </div>

                {isPdf ? (
                    <iframe
                        src={preview.url}
                        title="Receipt PDF preview"
                        style={{ width: "100%", height: "70vh", border: "none", borderRadius: 10 }}
                    />
                ) : (
                    <img
                        src={preview.url}
                        alt="Receipt preview"
                        style={{ width: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: 10 }}
                    />
                )}
            </div>
        </div>
    );
}
