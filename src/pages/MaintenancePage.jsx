import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext.jsx";

const CATEGORY_OPTIONS = [
    "General",
    "Plumbing",
    "Electrical",
    "HVAC",
    "Roof",
    "Appliances",
    "Exterior",
    "Pest Control",
    "Safety"
];

export default function MaintenancePage() {
    const { propertyId } = useParams();
    const { token } = useAuth();

    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState("");

    const [form, setForm] = useState({
        title: "",
        category: "General",
        vendor: "",
        serviceDate: "",
        cost: "",
        notes: ""
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

        if (!form.title.trim() || !form.serviceDate) {
            setFormError("Title and service date are required.");
            return;
        }

        setSubmitting(true);
        try {
            await api.createMaintenance(
                propertyId,
                {
                    title: form.title,
                    category: form.category,
                    vendor: form.vendor,
                    serviceDate: form.serviceDate,
                    cost: form.cost ? Number(form.cost) : 0,
                    notes: form.notes
                },
                token
            );

            setForm({ title: "", category: "General", vendor: "", serviceDate: "", cost: "", notes: "" });
            await load();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <h2 style={{ margin: 0 }}>Maintenance</h2>
                <Link to="/properties">← Back to properties</Link>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16, alignItems: "start" }}>
                <section style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
                    <h3 style={{ marginTop: 0 }}>Add a maintenance entry</h3>

                    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10 }}>
                        <label>
                            Title *
                            <input value={form.title} onChange={(e) => updateField("title", e.target.value)} style={{ width: "100%" }} />
                        </label>

                        <label>
                            Category
                            <select value={form.category} onChange={(e) => updateField("category", e.target.value)} style={{ width: "100%" }}>
                                {CATEGORY_OPTIONS.map((c) => (
                                    <option key={c} value={c}>
                                        {c}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label>
                            Vendor
                            <input value={form.vendor} onChange={(e) => updateField("vendor", e.target.value)} style={{ width: "100%" }} />
                        </label>

                        <label>
                            Service date *
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

                        {formError && <div style={{ color: "crimson" }}>{formError}</div>}

                        <button disabled={submitting} type="submit">
                            {submitting ? "Saving..." : "Save entry"}
                        </button>
                    </form>
                </section>

                <section style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                        <h3 style={{ marginTop: 0 }}>Entries</h3>
                        <button onClick={load} disabled={loading}>
                            Refresh
                        </button>
                    </div>

                    {pageError && <div style={{ color: "crimson" }}>{pageError}</div>}

                    {loading ? (
                        <div>Loading...</div>
                    ) : logs.length === 0 ? (
                        <div>No maintenance entries yet.</div>
                    ) : (
                        <ul style={{ paddingLeft: 18 }}>
                            {logs.map((log) => (
                                <li key={log._id} style={{ marginBottom: 12 }}>
                                    <div style={{ fontWeight: 600 }}>{log.title}</div>
                                    <div style={{ fontSize: 14 }}>
                                        {log.category} • {new Date(log.serviceDate).toLocaleDateString()}
                                        {typeof log.cost === "number" ? ` • $${log.cost.toFixed(2)}` : ""}
                                    </div>
                                    {(log.vendor || log.notes) && (
                                        <div style={{ fontSize: 13, opacity: 0.8, marginTop: 3 }}>
                                            {log.vendor ? `Vendor: ${log.vendor}` : ""}
                                            {log.vendor && log.notes ? " • " : ""}
                                            {log.notes ? log.notes : ""}
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </div>
    );
}
