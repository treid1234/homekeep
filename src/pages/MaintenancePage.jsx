// homekeep-client/src/pages/MaintenancePage.jsx
// If your file name differs, paste it and I’ll adapt it 1:1.

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext.jsx";

export default function MaintenancePage() {
    const { token } = useAuth();
    const { propertyId } = useParams();

    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState("");

    const [form, setForm] = useState({
        title: "",
        category: "",
        vendor: "",
        serviceDate: "",
        cost: "",
        notes: "",
        // ✅ Week 3 reminders
        nextDueDate: "",
        reminderEnabled: true
    });

    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState("");

    async function load() {
        setLoading(true);
        setPageError("");
        try {
            const res = await api.listMaintenance(propertyId, token);
            setLogs(res.data.logs || []);
        } catch (err) {
            setPageError(err.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [propertyId]);

    function updateField(key, value) {
        setForm((f) => ({ ...f, [key]: value }));
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setFormError("");

        if (!form.title.trim()) {
            setFormError("Title is required.");
            return;
        }

        setSubmitting(true);
        try {
            await api.createMaintenance(
                propertyId,
                {
                    title: form.title.trim(),
                    category: form.category.trim(),
                    vendor: form.vendor.trim(),
                    serviceDate: form.serviceDate ? form.serviceDate : null,
                    cost: form.cost === "" ? null : Number(form.cost),
                    notes: form.notes.trim(),

                    // ✅ reminders payload
                    nextDueDate: form.nextDueDate ? form.nextDueDate : null,
                    reminderEnabled: Boolean(form.reminderEnabled)
                },
                token
            );

            setForm({
                title: "",
                category: "",
                vendor: "",
                serviceDate: "",
                cost: "",
                notes: "",
                nextDueDate: "",
                reminderEnabled: true
            });

            await load();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div>
            <h2>Maintenance</h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
                {/* ===== Add maintenance form ===== */}
                <section style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
                    <h3 style={{ marginTop: 0 }}>Add maintenance</h3>

                    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10 }}>
                        <label>
                            Title *
                            <input value={form.title} onChange={(e) => updateField("title", e.target.value)} style={{ width: "100%" }} />
                        </label>

                        <label>
                            Category
                            <input value={form.category} onChange={(e) => updateField("category", e.target.value)} style={{ width: "100%" }} />
                        </label>

                        <label>
                            Vendor
                            <input value={form.vendor} onChange={(e) => updateField("vendor", e.target.value)} style={{ width: "100%" }} />
                        </label>

                        <label>
                            Service date
                            <input type="date" value={form.serviceDate} onChange={(e) => updateField("serviceDate", e.target.value)} style={{ width: "100%" }} />
                        </label>

                        <label>
                            Cost
                            <input
                                type="number"
                                step="0.01"
                                value={form.cost}
                                onChange={(e) => updateField("cost", e.target.value)}
                                style={{ width: "100%" }}
                            />
                        </label>

                        <label>
                            Notes
                            <textarea value={form.notes} onChange={(e) => updateField("notes", e.target.value)} rows={3} style={{ width: "100%" }} />
                        </label>

                        {/* ✅ Week 3 Reminders UI */}
                        <div style={{ padding: 10, border: "1px solid #eee", borderRadius: 8, background: "#fafafa" }}>
                            <div style={{ fontWeight: 700, marginBottom: 6 }}>Reminder</div>

                            <label style={{ display: "grid", gap: 6 }}>
                                Next due date
                                <input
                                    type="date"
                                    value={form.nextDueDate}
                                    onChange={(e) => updateField("nextDueDate", e.target.value)}
                                    style={{ width: "100%" }}
                                />
                            </label>

                            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                                <input
                                    type="checkbox"
                                    checked={Boolean(form.reminderEnabled)}
                                    onChange={(e) => updateField("reminderEnabled", e.target.checked)}
                                />
                                Enable reminder
                            </label>

                            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
                                If you set a next due date, it will appear on your dashboard under Upcoming Maintenance.
                            </div>
                        </div>

                        {formError && <div style={{ color: "crimson" }}>{formError}</div>}

                        <button disabled={submitting} type="submit">
                            {submitting ? "Saving..." : "Save maintenance"}
                        </button>
                    </form>
                </section>

                {/* ===== Logs list ===== */}
                <section style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                        <h3 style={{ marginTop: 0 }}>Maintenance logs</h3>
                        <button onClick={load} disabled={loading}>
                            Refresh
                        </button>
                    </div>

                    {pageError && <div style={{ color: "crimson" }}>{pageError}</div>}

                    {loading ? (
                        <div>Loading...</div>
                    ) : logs.length === 0 ? (
                        <div>No maintenance logs yet. Add your first one.</div>
                    ) : (
                        <ul style={{ paddingLeft: 18 }}>
                            {logs.map((log) => (
                                <li key={log._id} style={{ marginBottom: 12 }}>
                                    <div style={{ fontWeight: 700 }}>{log.title}</div>

                                    <div style={{ fontSize: 14 }}>
                                        {log.category ? `${log.category} • ` : ""}
                                        {log.vendor ? `${log.vendor} • ` : ""}
                                        {log.serviceDate ? `Service: ${new Date(log.serviceDate).toLocaleDateString()} • ` : ""}
                                        {log.cost !== null && log.cost !== undefined ? `Cost: $${Number(log.cost).toFixed(2)}` : ""}
                                    </div>

                                    {/* ✅ Show nextDueDate if set */}
                                    {log.nextDueDate ? (
                                        <div style={{ fontSize: 13, marginTop: 4 }}>
                                            <span style={{ fontWeight: 600 }}>Next due:</span>{" "}
                                            {new Date(log.nextDueDate).toLocaleDateString()}
                                            {!log.reminderEnabled ? (
                                                <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.7 }}>(reminder off)</span>
                                            ) : null}
                                        </div>
                                    ) : null}

                                    {log.notes ? <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>{log.notes}</div> : null}
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </div>
    );
}
