import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext.jsx";

function formatBytes(bytes) {
    if (bytes === null || bytes === undefined) return "";
    const sizes = ["B", "KB", "MB", "GB"];
    let i = 0;
    let n = Number(bytes);

    while (n >= 1024 && i < sizes.length - 1) {
        n /= 1024;
        i += 1;
    }

    const decimals = i === 0 ? 0 : 1;
    return `${n.toFixed(decimals)} ${sizes[i]}`;
}

function formatMoney(amount) {
    if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return "";
    return `$${Number(amount).toFixed(2)}`;
}

function hasSuggestions(extracted) {
    if (!extracted) return false;
    const vendorOk = extracted.vendor && extracted.vendor.trim();
    const amountOk = extracted.amount !== null && extracted.amount !== undefined;
    const dateOk = extracted.date;
    return Boolean(vendorOk || amountOk || dateOk);
}

export default function MaintenanceDocuments({ propertyId, logId, onApplied }) {
    const { token } = useAuth();

    const [docs, setDocs] = useState([]);
    const [open, setOpen] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState("");
    const [selectedFile, setSelectedFile] = useState(null);

    const [openingId, setOpeningId] = useState("");
    const [applyingId, setApplyingId] = useState("");
    const [applyMsg, setApplyMsg] = useState("");

    const docCountLabel = useMemo(() => {
        return docs.length === 0 ? "Documents" : `Documents (${docs.length})`;
    }, [docs.length]);

    async function load() {
        setLoading(true);
        setError("");
        try {
            const res = await api.listMaintenanceDocuments(propertyId, logId, token);
            setDocs(res.data.documents || []);
        } catch (e) {
            setError(e.message || "Failed to load documents.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (open) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    async function handleUpload(e) {
        e.preventDefault();
        setUploadError("");
        setApplyMsg("");

        if (!selectedFile) {
            setUploadError("Please choose a file first.");
            return;
        }

        setUploading(true);
        try {
            await api.uploadMaintenanceDocument(propertyId, logId, selectedFile, token);

            setSelectedFile(null);
            const input = document.getElementById(`doc-file-${logId}`);
            if (input) input.value = "";

            await load();
        } catch (err) {
            setUploadError(err.message || "Upload failed.");
        } finally {
            setUploading(false);
        }
    }

    async function handleOpen(doc) {
        setOpeningId(doc._id);
        try {
            const { blob } = await api.fetchDocumentBlob(doc._id, token);
            const blobUrl = URL.createObjectURL(blob);
            window.open(blobUrl, "_blank", "noopener,noreferrer");
            setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
        } catch (err) {
            alert(err.message || "Could not open document.");
        } finally {
            setOpeningId("");
        }
    }

    async function applySuggestions(doc) {
        setApplyMsg("");

        const extracted = doc.extracted || {};
        const payload = {};

        if (extracted.vendor && extracted.vendor.trim()) payload.vendor = extracted.vendor.trim();
        if (extracted.amount !== null && extracted.amount !== undefined) payload.cost = Number(extracted.amount);
        if (extracted.date) payload.serviceDate = extracted.date; // backend converts to Date

        if (Object.keys(payload).length === 0) {
            setApplyMsg("No extracted suggestions found on this document yet.");
            return;
        }

        setApplyingId(doc._id);
        try {
            await api.updateMaintenance(propertyId, logId, payload, token);
            setApplyMsg("Applied suggestions to this maintenance record.");

            // optional: parent can reload logs to reflect new vendor/cost/serviceDate
            if (typeof onApplied === "function") onApplied();
        } catch (err) {
            setApplyMsg(err.message || "Could not apply suggestions.");
        } finally {
            setApplyingId("");
        }
    }

    return (
        <div
            style={{
                marginTop: 10,
                padding: 10,
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: "#fff"
            }}
        >
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    border: "none",
                    background: "transparent",
                    padding: 0,
                    cursor: "pointer",
                    fontWeight: 700,
                    color: "#111827"
                }}
            >
                <span>{docCountLabel}</span>
                <span style={{ fontSize: 12, opacity: 0.7 }}>{open ? "Hide" : "Show"}</span>
            </button>

            {open ? (
                <div style={{ marginTop: 10 }}>
                    <form onSubmit={handleUpload} style={{ display: "grid", gap: 8 }}>
                        <label style={{ fontSize: 13, fontWeight: 600 }}>
                            Upload receipt / invoice / warranty (PDF or image)
                        </label>

                        <input
                            id={`doc-file-${logId}`}
                            type="file"
                            accept="application/pdf,image/png,image/jpeg,image/webp"
                            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        />

                        {uploadError ? <div style={{ color: "crimson", fontSize: 13 }}>{uploadError}</div> : null}

                        <button
                            type="submit"
                            disabled={uploading}
                            style={{
                                padding: "8px 10px",
                                borderRadius: 10,
                                border: "1px solid #e5e7eb",
                                background: uploading ? "#f9fafb" : "#111827",
                                color: uploading ? "#6b7280" : "#fff",
                                cursor: uploading ? "not-allowed" : "pointer",
                                width: "fit-content"
                            }}
                        >
                            {uploading ? "Uploading..." : "Upload document"}
                        </button>
                    </form>

                    {applyMsg ? (
                        <div style={{ marginTop: 10, fontSize: 13, color: applyMsg.includes("Applied") ? "#065f46" : "#374151" }}>
                            {applyMsg}
                        </div>
                    ) : null}

                    <div style={{ marginTop: 12 }}>
                        {loading ? <div style={{ color: "#6b7280" }}>Loading documents…</div> : null}
                        {error ? <div style={{ color: "crimson" }}>{error}</div> : null}

                        {!loading && !error && docs.length === 0 ? (
                            <div style={{ color: "#374151", fontSize: 13 }}>No documents attached yet.</div>
                        ) : null}

                        {!loading && !error && docs.length > 0 ? (
                            <ul style={{ paddingLeft: 18, margin: "8px 0 0" }}>
                                {docs.map((d) => (
                                    <li key={d._id} style={{ marginBottom: 12 }}>
                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                gap: 10,
                                                alignItems: "baseline",
                                                flexWrap: "wrap"
                                            }}
                                        >
                                            <div style={{ fontWeight: 650 }}>{d.originalName}</div>
                                            <div style={{ fontSize: 12, opacity: 0.75 }}>
                                                {formatBytes(d.size)} • {new Date(d.createdAt).toLocaleDateString()}
                                            </div>
                                        </div>

                                        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 6 }}>
                                            <button
                                                type="button"
                                                onClick={() => handleOpen(d)}
                                                disabled={openingId === d._id}
                                                style={{
                                                    padding: 0,
                                                    border: "none",
                                                    background: "transparent",
                                                    color: "#2563eb",
                                                    cursor: openingId === d._id ? "not-allowed" : "pointer",
                                                    textDecoration: "underline",
                                                    fontSize: 13,
                                                    opacity: openingId === d._id ? 0.6 : 1
                                                }}
                                            >
                                                {openingId === d._id ? "Opening..." : "Open"}
                                            </button>
                                        </div>

                                        {/* Suggested extraction */}
                                        {hasSuggestions(d.extracted) ? (
                                            <div
                                                style={{
                                                    marginTop: 8,
                                                    padding: 10,
                                                    borderRadius: 10,
                                                    border: "1px solid #eef2ff",
                                                    background: "#f8fafc"
                                                }}
                                            >
                                                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                                                    Suggested from document
                                                </div>

                                                <div style={{ fontSize: 13, color: "#374151", display: "grid", gap: 4 }}>
                                                    {d.extracted?.vendor?.trim() ? (
                                                        <div>
                                                            <strong>Vendor:</strong> {d.extracted.vendor.trim()}
                                                        </div>
                                                    ) : null}

                                                    {d.extracted?.amount !== null && d.extracted?.amount !== undefined ? (
                                                        <div>
                                                            <strong>Amount:</strong> {formatMoney(d.extracted.amount)}
                                                        </div>
                                                    ) : null}

                                                    {d.extracted?.date ? (
                                                        <div>
                                                            <strong>Date:</strong> {new Date(d.extracted.date).toLocaleDateString()}
                                                        </div>
                                                    ) : null}
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => applySuggestions(d)}
                                                    disabled={applyingId === d._id}
                                                    style={{
                                                        marginTop: 10,
                                                        padding: "8px 10px",
                                                        borderRadius: 10,
                                                        border: "1px solid #e5e7eb",
                                                        background: applyingId === d._id ? "#f9fafb" : "#111827",
                                                        color: applyingId === d._id ? "#6b7280" : "#fff",
                                                        cursor: applyingId === d._id ? "not-allowed" : "pointer",
                                                        width: "fit-content"
                                                    }}
                                                >
                                                    {applyingId === d._id ? "Applying..." : "Apply to maintenance record"}
                                                </button>

                                                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                                                    You can always edit these values if the document isn’t accurate.
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.65 }}>
                                                No extracted suggestions on this document yet.
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

<MaintenanceDocuments
    propertyId={propertyId}
    logId={log._id}
    onApplied={load} // reload maintenance logs so vendor/cost/serviceDate update visually
/>


