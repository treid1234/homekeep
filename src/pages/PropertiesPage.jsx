import { useEffect, useState } from "react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext.jsx";
import { Link } from "react-router-dom";

export default function PropertiesPage() {
    const { token } = useAuth();

    const [properties, setProperties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState("");

    const [form, setForm] = useState({
        nickname: "Princeton House",
        addressLine1: "",
        addressLine2: "",
        city: "Princeton",
        province: "BC",
        postalCode: "",
        purchaseDate: "",
        notes: "",
    });

    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState("");

    async function load() {
        setLoading(true);
        setPageError("");

        try {
            const res = await api.listProperties(token);
            const props =
                res?.data?.properties ||
                res?.data?.data?.properties ||
                res?.data?.data?.data?.properties ||
                [];
            setProperties(props);
        } catch (err) {
            setPageError(err.message || "Failed to load properties.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    function updateField(key, value) {
        setForm((f) => ({ ...f, [key]: value }));
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setFormError("");

        if (
            !form.nickname.trim() ||
            !form.addressLine1.trim() ||
            !form.city.trim() ||
            !form.province.trim()
        ) {
            setFormError("Nickname, address line 1, city, and province are required.");
            return;
        }

        setSubmitting(true);

        try {
            await api.createProperty(
                {
                    ...form,
                    purchaseDate: form.purchaseDate ? form.purchaseDate : null,
                },
                token
            );

            setForm((f) => ({
                ...f,
                addressLine1: "",
                addressLine2: "",
                postalCode: "",
                notes: "",
            }));

            await load();
        } catch (err) {
            setFormError(err.message || "Failed to save property.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="hk-container">
            <div className="hk-header">
                <div>
                    <h2 className="hk-title">Properties</h2>
                    <p className="hk-subtitle">
                        Add and manage your properties. Each property can have its own
                        maintenance logs and documents.
                    </p>
                </div>
                <span className="hk-pill">HomeKeep</span>
            </div>

            <div className="hk-split">
                {/* Left: Add property */}
                <section className="hk-card hk-card-pad">
                    <div className="hk-row" style={{ marginBottom: 10 }}>
                        <h3 className="hk-section-title">Add a property</h3>
                        <span className="hk-pill">Required *</span>
                    </div>

                    <form onSubmit={handleSubmit} className="hk-form">
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
                            Address line 1 *
                            <input
                                className="hk-input"
                                value={form.addressLine1}
                                onChange={(e) => updateField("addressLine1", e.target.value)}
                                placeholder="e.g., 297 Lachine Avenue"
                            />
                        </label>

                        <label className="hk-label">
                            Address line 2
                            <input
                                className="hk-input"
                                value={form.addressLine2}
                                onChange={(e) => updateField("addressLine2", e.target.value)}
                                placeholder="Suite / Unit (optional)"
                            />
                        </label>

                        <div className="hk-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                            <label className="hk-label">
                                City *
                                <input
                                    className="hk-input"
                                    value={form.city}
                                    onChange={(e) => updateField("city", e.target.value)}
                                />
                            </label>

                            <label className="hk-label">
                                Province *
                                <input
                                    className="hk-input"
                                    value={form.province}
                                    onChange={(e) => updateField("province", e.target.value)}
                                />
                            </label>
                        </div>

                        <label className="hk-label">
                            Postal code
                            <input
                                className="hk-input"
                                value={form.postalCode}
                                onChange={(e) => updateField("postalCode", e.target.value)}
                                placeholder="e.g., V0X 1W0"
                            />
                        </label>

                        <label className="hk-label">
                            Purchase date
                            <input
                                className="hk-input"
                                type="date"
                                value={form.purchaseDate}
                                onChange={(e) => updateField("purchaseDate", e.target.value)}
                            />
                        </label>

                        <label className="hk-label">
                            Notes
                            <textarea
                                className="hk-textarea"
                                value={form.notes}
                                onChange={(e) => updateField("notes", e.target.value)}
                                rows={3}
                                placeholder="Anything you want to remember…"
                            />
                        </label>

                        {formError && <div className="hk-error">{formError}</div>}

                        <div className="hk-actions">
                            <button className="hk-btn" disabled={submitting} type="submit">
                                {submitting ? "Saving…" : "Save property"}
                            </button>
                            <span className="hk-muted" style={{ fontSize: 13 }}>
                                You can add maintenance logs after saving.
                            </span>
                        </div>
                    </form>
                </section>

                {/* Right: Your properties */}
                <section className="hk-card hk-card-pad">
                    <div className="hk-row" style={{ marginBottom: 10 }}>
                        <h3 className="hk-section-title">Your properties</h3>
                        <button className="hk-btn" onClick={load} disabled={loading}>
                            Refresh
                        </button>
                    </div>

                    {pageError && <div className="hk-error">{pageError}</div>}

                    {loading ? (
                        <div className="hk-muted">Loading…</div>
                    ) : properties.length === 0 ? (
                        <div className="hk-muted">No properties yet. Add your first one.</div>
                    ) : (
                        <ul className="hk-list" style={{ marginTop: 10 }}>
                            {properties.map((p) => (
                                <li key={p._id} style={{ marginBottom: 14 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                                        <div>
                                            <div style={{ fontWeight: 900 }}>{p.nickname}</div>
                                            <div className="hk-muted" style={{ fontSize: 13 }}>
                                                {p.addressLine1}
                                                {p.addressLine2 ? `, ${p.addressLine2}` : ""}, {p.city}, {p.province}{" "}
                                                {p.postalCode ? p.postalCode : ""}
                                            </div>

                                            {p.purchaseDate && (
                                                <div className="hk-muted" style={{ fontSize: 13 }}>
                                                    Purchased: {new Date(p.purchaseDate).toLocaleDateString()}
                                                </div>
                                            )}
                                        </div>

                                        <div style={{ display: "flex", alignItems: "center" }}>
                                            <Link className="hk-link" to={`/properties/${p._id}/maintenance`}>
                                                View maintenance →
                                            </Link>
                                        </div>
                                    </div>

                                    <div className="hk-divider" />
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </div>
    );
}
