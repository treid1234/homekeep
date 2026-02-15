import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext.jsx";

export default function PropertiesPage() {
    const { token } = useAuth();

    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState("");
    const [actionMsg, setActionMsg] = useState("");

    const [properties, setProperties] = useState([]);

    const [form, setForm] = useState({
        nickname: "",
        address: "",
        city: "",
        province: "BC",
    });

    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState("");

    async function load() {
        setLoading(true);
        setPageError("");
        setActionMsg("");
        try {
            const res = await api.listProperties(token);
            const items = res?.data?.properties || res?.data?.items || res?.data || [];
            setProperties(Array.isArray(items) ? items : []);
        } catch (err) {
            setPageError(err?.message || "Failed to load properties.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function updateField(key, value) {
        setForm((f) => ({ ...f, [key]: value }));
    }

    async function handleCreate(e) {
        e.preventDefault();
        setFormError("");
        setActionMsg("");

        if (!form.nickname.trim()) {
            setFormError("Nickname is required.");
            return;
        }

        const payload = {
            nickname: form.nickname.trim(),
            addressLine1: form.address?.trim() || "",
            city: form.city?.trim() || "",
            province: form.province?.trim() || "BC",
        };

        setSubmitting(true);
        try {
            await api.createProperty(payload, token);
            setForm({ nickname: "", address: "", city: "", province: "BC" });
            await load();
            setActionMsg("Property saved ✅");
        } catch (err) {
            setFormError(err?.message || "Failed to create property.");
        } finally {
            setSubmitting(false);
        }
    }

    const countLabel = useMemo(() => {
        const n = properties.length;
        return `${n} propert${n === 1 ? "y" : "ies"}`;
    }, [properties.length]);

    return (
        <div className="hk-container">
            <div className="hk-header">
                <div>
                    <h2 className="hk-title">Properties</h2>
                    <p className="hk-subtitle">
                        Create a property, then track maintenance logs and receipts.
                    </p>
                </div>

                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <Link className="hk-link" to="/dashboard">
                        ← Back to dashboard
                    </Link>
                    <button className="hk-btn" type="button" onClick={load} disabled={loading}>
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

            <div className="hk-split">
                {/* Left: create property */}
                <section className="hk-card hk-card-pad">
                    <div className="hk-row" style={{ marginBottom: 10 }}>
                        <h3 className="hk-section-title">Add property</h3>
                        <span className="hk-pill">HomeKeep</span>
                    </div>

                    <form onSubmit={handleCreate} className="hk-form">
                        <label className="hk-label">
                            Nickname *
                            <input
                                className="hk-input"
                                value={form.nickname}
                                onChange={(e) => updateField("nickname", e.target.value)}
                                placeholder="e.g., Princeton House"
                            />
                        </label>

                        <label className="hk-label">
                            Address
                            <input
                                className="hk-input"
                                value={form.address}
                                onChange={(e) => updateField("address", e.target.value)}
                                placeholder="Optional"
                            />
                        </label>

                        <div className="hk-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                            <label className="hk-label">
                                City
                                <input
                                    className="hk-input"
                                    value={form.city}
                                    onChange={(e) => updateField("city", e.target.value)}
                                    placeholder="e.g., Princeton"
                                />
                            </label>

                            <label className="hk-label">
                                Province
                                <input
                                    className="hk-input"
                                    value={form.province}
                                    onChange={(e) => updateField("province", e.target.value)}
                                    placeholder="e.g., BC"
                                />
                            </label>
                        </div>

                        {formError && <div className="hk-error">{formError}</div>}

                        <div className="hk-actions">
                            <button className="hk-btn" disabled={submitting} type="submit">
                                {submitting ? "Saving…" : "Save property"}
                            </button>
                        </div>
                    </form>
                </section>

                {/* Right: list */}
                <section className="hk-card hk-card-pad">
                    <div className="hk-row" style={{ marginBottom: 10 }}>
                        <div>
                            <h3 className="hk-section-title">Your properties</h3>
                            <div className="hk-muted" style={{ fontSize: 13 }}>
                                {countLabel}
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="hk-muted">Loading…</div>
                    ) : properties.length === 0 ? (
                        <div className="hk-muted">No properties yet.</div>
                    ) : (
                        <ul className="hk-list" style={{ marginTop: 0 }}>
                            {properties.map((p) => (
                                <li key={p._id} style={{ marginBottom: 12 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                                        <div>
                                            <div style={{ fontWeight: 900 }}>{p.nickname}</div>
                                            <div className="hk-muted" style={{ fontSize: 12 }}>
                                                {p.city ? `${p.city}, ` : ""}{p.province || ""}
                                            </div>
                                        </div>

                                        <Link className="hk-link" to={`/properties/${p._id}/maintenance`}>
                                            Open →
                                        </Link>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </div>
    );
}
