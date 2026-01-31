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
        notes: ""
    });

    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState("");

    async function load() {
        setLoading(true);
        setPageError("");
        try {
            const res = await api.listProperties(token);
            setProperties(res.data.properties || []);
        } catch (err) {
            setPageError(err.message);
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

    async function handleSubmit(e) {
        e.preventDefault();
        setFormError("");

        if (!form.nickname.trim() || !form.addressLine1.trim() || !form.city.trim() || !form.province.trim()) {
            setFormError("Nickname, address line 1, city, and province are required.");
            return;
        }

        setSubmitting(true);
        try {
            await api.createProperty(
                {
                    ...form,
                    purchaseDate: form.purchaseDate ? form.purchaseDate : null
                },
                token
            );

            setForm((f) => ({
                ...f,
                addressLine1: "",
                addressLine2: "",
                postalCode: "",
                notes: ""
            }));

            await load();
        } catch (err) {
            setFormError(err.message);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div>
            <h2>Properties</h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
                <section style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
                    <h3 style={{ marginTop: 0 }}>Add a property</h3>

                    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10 }}>
                        <label>
                            Nickname *
                            <input
                                value={form.nickname}
                                onChange={(e) => updateField("nickname", e.target.value)}
                                style={{ width: "100%" }}
                            />
                        </label>

                        <label>
                            Address line 1 *
                            <input
                                value={form.addressLine1}
                                onChange={(e) => updateField("addressLine1", e.target.value)}
                                style={{ width: "100%" }}
                            />
                        </label>

                        <label>
                            Address line 2
                            <input
                                value={form.addressLine2}
                                onChange={(e) => updateField("addressLine2", e.target.value)}
                                style={{ width: "100%" }}
                            />
                        </label>

                        <label>
                            City *
                            <input
                                value={form.city}
                                onChange={(e) => updateField("city", e.target.value)}
                                style={{ width: "100%" }}
                            />
                        </label>

                        <label>
                            Province *
                            <input
                                value={form.province}
                                onChange={(e) => updateField("province", e.target.value)}
                                style={{ width: "100%" }}
                            />
                        </label>

                        <label>
                            Postal code
                            <input
                                value={form.postalCode}
                                onChange={(e) => updateField("postalCode", e.target.value)}
                                style={{ width: "100%" }}
                            />
                        </label>

                        <label>
                            Purchase date
                            <input
                                type="date"
                                value={form.purchaseDate}
                                onChange={(e) => updateField("purchaseDate", e.target.value)}
                                style={{ width: "100%" }}
                            />
                        </label>

                        <label>
                            Notes
                            <textarea
                                value={form.notes}
                                onChange={(e) => updateField("notes", e.target.value)}
                                rows={3}
                                style={{ width: "100%" }}
                            />
                        </label>

                        {formError && <div style={{ color: "crimson" }}>{formError}</div>}

                        <button disabled={submitting} type="submit">
                            {submitting ? "Saving..." : "Save property"}
                        </button>
                    </form>
                </section>

                <section style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                        <h3 style={{ marginTop: 0 }}>Your properties</h3>
                        <button onClick={load} disabled={loading}>
                            Refresh
                        </button>
                    </div>

                    {pageError && <div style={{ color: "crimson" }}>{pageError}</div>}

                    {loading ? (
                        <div>Loading...</div>
                    ) : properties.length === 0 ? (
                        <div>No properties yet. Add your first one.</div>
                    ) : (
                        <ul style={{ paddingLeft: 18 }}>
                            {properties.map((p) => (
                                <li key={p._id} style={{ marginBottom: 10 }}>
                                    <div style={{ fontWeight: 600 }}>{p.nickname}</div>

                                    <div style={{ fontSize: 14 }}>
                                        {p.addressLine1}
                                        {p.addressLine2 ? `, ${p.addressLine2}` : ""}, {p.city}, {p.province}{" "}
                                        {p.postalCode ? p.postalCode : ""}
                                    </div>

                                    <div style={{ marginTop: 6 }}>
                                        <Link to={`/properties/${p._id}/maintenance`}>View maintenance</Link>
                                    </div>

                                    {p.purchaseDate && (
                                        <div style={{ fontSize: 13, opacity: 0.8 }}>
                                            Purchased: {new Date(p.purchaseDate).toLocaleDateString()}
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
