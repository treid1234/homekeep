// src/services/api.js
const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5050/api/v1";

async function request(endpoint, { method = "GET", token, body, headers } = {}) {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
        method,
        headers: {
            ...(body ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(headers || {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    let json = null;
    const text = await res.text().catch(() => "");
    try {
        json = text ? JSON.parse(text) : null;
    } catch {
        json = null;
    }

    // Standardize errors
    if (!res.ok) {
        const msg =
            json?.error?.message ||
            json?.message ||
            `Request failed (${res.status})`;
        throw new Error(msg);
    }

    return json;
}

// -------------------- AUTH --------------------
async function login(payload) {
    return request("/auth/login", { method: "POST", body: payload });
}

async function register(payload) {
    return request("/auth/register", { method: "POST", body: payload });
}

// -------------------- USER --------------------
async function me(token) {
    return request("/me", { token });
}

// -------------------- PROPERTIES --------------------
async function listProperties(token) {
    return request("/properties", { token });
}

async function createProperty(payload, token) {
    return request("/properties", { method: "POST", token, body: payload });
}

async function getProperty(propertyId, token) {
    return request(`/properties/${propertyId}`, { token });
}

async function updateProperty(propertyId, payload, token) {
    return request(`/properties/${propertyId}`, { method: "PUT", token, body: payload });
}

async function deleteProperty(propertyId, token) {
    return request(`/properties/${propertyId}`, { method: "DELETE", token });
}

// -------------------- MAINTENANCE (MATCHES YOUR ROUTES) --------------------
async function listMaintenance(propertyId, token) {
    return request(`/properties/${propertyId}/maintenance`, { token });
}

async function createMaintenance(propertyId, payload, token) {
    return request(`/properties/${propertyId}/maintenance`, {
        method: "POST",
        token,
        body: payload,
    });
}

async function updateMaintenanceLog(propertyId, logId, payload, token) {
    // IMPORTANT: this MUST match your backend
    return request(`/properties/${propertyId}/maintenance/${logId}`, {
        method: "PUT",
        token,
        body: payload,
    });
}

async function deleteMaintenanceLog(propertyId, logId, token) {
    return request(`/properties/${propertyId}/maintenance/${logId}`, {
        method: "DELETE",
        token,
    });
}

// -------------------- DASHBOARD --------------------
async function dashboardSummary(token) {
    return request("/dashboard/summary", { token });
}

// -------------------- DOCUMENTS (PER-LOG) --------------------
// NOTE: your MaintenancePage calls listMaintenanceDocuments(propertyId, logId, token)
// You likely have these routes in documentRoutes.
// If your actual endpoints differ, tell me what your documentRoutes file says and I'll align.
async function listMaintenanceDocuments(propertyId, logId, token) {
    return request(`/documents?propertyId=${encodeURIComponent(propertyId)}&logId=${encodeURIComponent(logId)}`, {
        token,
    });
}

async function deleteMaintenanceDocument(propertyId, logId, documentId, token) {
    return request(
        `/documents/${encodeURIComponent(documentId)}?propertyId=${encodeURIComponent(propertyId)}&logId=${encodeURIComponent(logId)}`,
        { method: "DELETE", token }
    );
}

// Download must return blob, so it cannot use request()
async function downloadMaintenanceDocument(propertyId, logId, documentId, token) {
    const url = `${BASE_URL}/documents/${encodeURIComponent(documentId)}/download?propertyId=${encodeURIComponent(
        propertyId
    )}&logId=${encodeURIComponent(logId)}`;

    const res = await fetch(url, {
        method: "GET",
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    });

    if (!res.ok) {
        let msg = `Download failed (${res.status})`;
        try {
            const j = await res.json();
            msg = j?.error?.message || msg;
        } catch { }
        throw new Error(msg);
    }

    const blob = await res.blob();

    // Try to read filename from Content-Disposition
    const cd = res.headers.get("content-disposition") || "";
    const match = cd.match(/filename="(.+?)"/i);
    const filename = match?.[1] || "document";

    return { blob, filename };
}

// -------------------- RECEIPTS --------------------
async function uploadReceipt(file, token) {
    const url = `${BASE_URL}/documents/receipts`;
    const form = new FormData();
    form.append("file", file);

    const res = await fetch(url, {
        method: "POST",
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            // DO NOT set Content-Type for multipart; browser will set boundary
        },
        body: form,
    });

    const text = await res.text().catch(() => "");
    let json = null;
    try {
        json = text ? JSON.parse(text) : null;
    } catch {
        json = null;
    }

    if (!res.ok) {
        const msg = json?.error?.message || `Upload failed (${res.status})`;
        throw new Error(msg);
    }

    return json;
}

async function attachReceipt(documentId, propertyId, logId, token) {
    return request(`/documents/receipts/${documentId}/attach`, {
        method: "POST",
        token,
        body: { propertyId, logId },
    });
}

async function createLogFromReceipt(documentId, propertyId, overrides, token) {
    return request(`/documents/receipts/${documentId}/create-log`, {
        method: "POST",
        token,
        body: { propertyId, overrides },
    });
}

async function listReceipts(params = {}, token) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    });
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/documents/receipts${suffix}`, { token });
}

async function deleteReceipt(documentId, token) {
    return request(`/documents/receipts/${documentId}`, { method: "DELETE", token });
}

// -------------------- REMINDERS --------------------
async function getUpcomingReminders(token) {
    return request("/reminders/upcoming", { token });
}

export const api = {
    // core
    request,

    // auth
    login,
    register,
    me,

    // properties
    listProperties,
    createProperty,
    getProperty,
    updateProperty,
    deleteProperty,

    // maintenance
    listMaintenance,
    createMaintenance,
    updateMaintenanceLog,
    deleteMaintenanceLog,

    // dashboard
    dashboardSummary,

    // documents
    listMaintenanceDocuments,
    downloadMaintenanceDocument,
    deleteMaintenanceDocument,

    // receipts
    uploadReceipt,
    attachReceipt,
    createLogFromReceipt,
    listReceipts,
    deleteReceipt,

    // reminders
    getUpcomingReminders,
};
