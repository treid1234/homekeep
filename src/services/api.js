const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5050/api/v1";

const HK_AUTH_EVENT = "hk:auth:unauthorized";

function emitUnauthorized(notice = "Your session expired. Please log in again.") {
    try {
        window.dispatchEvent(new CustomEvent(HK_AUTH_EVENT, { detail: { notice } }));
    } catch {
        // no-op
    }
}

async function request(endpoint, { method = "GET", token, body, headers, signal } = {}) {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
        method,
        signal,
        headers: {
            ...(body ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(headers || {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    // Read response safely
    let json = null;
    const text = await res.text().catch(() => "");
    try {
        json = text ? JSON.parse(text) : null;
    } catch {
        json = null;
    }

    // ✅ Centralized 401 handling (triggers AuthContext auto-logout listener)
    if (res.status === 401) {
        const msg =
            json?.error?.message ||
            json?.message ||
            "Your session expired. Please log in again.";
        emitUnauthorized(msg);
    }

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
async function login(payload, opts = {}) {
    return request("/auth/login", { method: "POST", body: payload, signal: opts.signal });
}

async function register(payload, opts = {}) {
    return request("/auth/register", { method: "POST", body: payload, signal: opts.signal });
}

// -------------------- USER --------------------
async function me(token, opts = {}) {
    return request("/me", { token, signal: opts.signal });
}

// -------------------- PROPERTIES --------------------
async function listProperties(token, opts = {}) {
    return request("/properties", { token, signal: opts.signal });
}

async function createProperty(payload, token, opts = {}) {
    return request("/properties", { method: "POST", token, body: payload, signal: opts.signal });
}

async function getProperty(propertyId, token, opts = {}) {
    return request(`/properties/${propertyId}`, { token, signal: opts.signal });
}

async function updateProperty(propertyId, payload, token, opts = {}) {
    return request(`/properties/${propertyId}`, { method: "PUT", token, body: payload, signal: opts.signal });
}

async function deleteProperty(propertyId, token, opts = {}) {
    return request(`/properties/${propertyId}`, { method: "DELETE", token, signal: opts.signal });
}

// -------------------- MAINTENANCE --------------------
async function listMaintenance(propertyId, token, opts = {}) {
    return request(`/properties/${propertyId}/maintenance`, { token, signal: opts.signal });
}

async function createMaintenance(propertyId, payload, token, opts = {}) {
    return request(`/properties/${propertyId}/maintenance`, { method: "POST", token, body: payload, signal: opts.signal });
}

async function updateMaintenanceLog(propertyId, logId, payload, token, opts = {}) {
    return request(`/properties/${propertyId}/maintenance/${logId}`, {
        method: "PUT",
        token,
        body: payload,
        signal: opts.signal,
    });
}

async function deleteMaintenanceLog(propertyId, logId, token, opts = {}) {
    return request(`/properties/${propertyId}/maintenance/${logId}`, { method: "DELETE", token, signal: opts.signal });
}

// -------------------- DASHBOARD --------------------
async function dashboardSummary(token, opts = {}) {
    return request("/dashboard/summary", { token, signal: opts.signal });
}

// -------------------- DOCUMENTS (PER-LOG) --------------------
async function listMaintenanceDocuments(propertyId, logId, token, opts = {}) {
    return request(
        `/documents?propertyId=${encodeURIComponent(propertyId)}&logId=${encodeURIComponent(logId)}`,
        { token, signal: opts.signal }
    );
}

async function deleteMaintenanceDocument(propertyId, logId, documentId, token, opts = {}) {
    return request(
        `/documents/${encodeURIComponent(documentId)}?propertyId=${encodeURIComponent(propertyId)}&logId=${encodeURIComponent(
            logId
        )}`,
        { method: "DELETE", token, signal: opts.signal }
    );
}

async function downloadMaintenanceDocument(propertyId, logId, documentId, token, opts = {}) {
    const url = `${BASE_URL}/documents/${encodeURIComponent(documentId)}/download?propertyId=${encodeURIComponent(
        propertyId
    )}&logId=${encodeURIComponent(logId)}`;

    const res = await fetch(url, {
        method: "GET",
        signal: opts.signal,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });

    if (res.status === 401) {
        emitUnauthorized("Your session expired. Please log in again.");
    }

    if (!res.ok) {
        let msg = `Download failed (${res.status})`;
        try {
            const j = await res.json();
            msg = j?.error?.message || msg;
        } catch { }
        throw new Error(msg);
    }

    const blob = await res.blob();
    const cd = res.headers.get("content-disposition") || "";
    const match = cd.match(/filename="(.+?)"/i);
    const filename = match?.[1] || "document";

    return { blob, filename };
}

// -------------------- RECEIPTS --------------------
async function uploadReceipt(file, token, opts = {}) {
    const url = `${BASE_URL}/documents/receipts`;
    const form = new FormData();
    form.append("file", file);

    const res = await fetch(url, {
        method: "POST",
        signal: opts.signal,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: form,
    });

    const text = await res.text().catch(() => "");
    let json = null;
    try {
        json = text ? JSON.parse(text) : null;
    } catch {
        json = null;
    }

    if (res.status === 401) {
        const msg =
            json?.error?.message ||
            json?.message ||
            "Your session expired. Please log in again.";
        emitUnauthorized(msg);
    }

    if (!res.ok) {
        const msg = json?.error?.message || `Upload failed (${res.status})`;
        throw new Error(msg);
    }

    return json;
}

async function listReceipts(params = {}, token, opts = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    });
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/documents/receipts${suffix}`, { token, signal: opts.signal });
}

async function deleteReceipt(documentId, token, opts = {}) {
    return request(`/documents/receipts/${documentId}`, { method: "DELETE", token, signal: opts.signal });
}

async function attachReceipt(documentId, propertyId, logId, token, opts = {}) {
    return request(`/documents/receipts/${documentId}/attach`, {
        method: "POST",
        token,
        body: { propertyId, logId },
        signal: opts.signal,
    });
}

async function createLogFromReceipt(documentId, propertyId, overrides, token, opts = {}) {
    return request(`/documents/receipts/${documentId}/create-log`, {
        method: "POST",
        token,
        body: { propertyId, overrides },
        signal: opts.signal,
    });
}

async function downloadReceipt(documentId, token, opts = {}) {
    const url = `${BASE_URL}/documents/receipts/${encodeURIComponent(documentId)}/download`;

    const res = await fetch(url, {
        method: "GET",
        signal: opts.signal,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });

    if (res.status === 401) {
        emitUnauthorized("Your session expired. Please log in again.");
    }

    if (!res.ok) {
        let msg = `Download failed (${res.status})`;
        try {
            const j = await res.json();
            msg = j?.error?.message || msg;
        } catch { }
        throw new Error(msg);
    }

    const blob = await res.blob();
    const contentType = res.headers.get("content-type") || "";

    const cd = res.headers.get("content-disposition") || "";
    const match = cd.match(/filename="(.+?)"/i);
    const filename = match?.[1] || "receipt";

    return { blob, filename, contentType };
}

async function rescanReceipt(documentId, token, opts = {}) {
    return request(`/documents/receipts/${documentId}/rescan`, { method: "POST", token, signal: opts.signal });
}

async function updateReceipt(documentId, extracted, token, opts = {}) {
    return request(`/documents/receipts/${documentId}`, {
        method: "PATCH",
        token,
        body: { extracted },
        signal: opts.signal,
    });
}

// -------------------- REMINDERS --------------------
async function getUpcomingReminders(token, opts = {}) {
    return request("/reminders/upcoming", { token, signal: opts.signal });
}

export const api = {
    request,

    // auth
    login,
    register,

    // user
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
    listReceipts,
    deleteReceipt,
    attachReceipt,
    createLogFromReceipt,
    downloadReceipt,
    rescanReceipt,
    updateReceipt,

    // reminders
    getUpcomingReminders,
};
