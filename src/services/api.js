const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5050/api/v1";

async function request(path, options = {}) {
    const res = await fetch(`${BASE_URL}${path}`, options);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(data?.error?.message || "Request failed");
    }
    return data;
}

function authHeaders(token) {
    return { Authorization: `Bearer ${token}` };
}

function jsonHeaders(token) {
    return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

/* ================= Auth ================= */

async function login({ email, password }) {
    const result = await request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });

    const token = result?.data?.token;
    const user = result?.data?.user;
    if (!token) throw new Error("Login did not return a token.");
    return { user, token };
}

async function register({ name, email, password }) {
    const result = await request("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
    });

    const token = result?.data?.token;
    const user = result?.data?.user;
    if (!token) throw new Error("Registration did not return a token.");
    return { user, token };
}

async function me(token) {
    return request("/users/me", { headers: authHeaders(token) });
}

/* ================= Dashboard ================= */

async function dashboardSummary(token) {
    return request("/dashboard/summary", { headers: authHeaders(token) });
}

async function getUpcomingReminders(days, token) {
    return request(`/reminders/upcoming?days=${days}`, { headers: authHeaders(token) });
}

/* ================= Properties ================= */

async function listProperties(token) {
    return request("/properties", { headers: authHeaders(token) });
}

async function createProperty(payload, token) {
    return request("/properties", {
        method: "POST",
        headers: jsonHeaders(token),
        body: JSON.stringify(payload),
    });
}

/* ================= Maintenance ================= */

async function listMaintenance(propertyId, token) {
    return request(`/properties/${propertyId}/maintenance`, { headers: authHeaders(token) });
}

async function createMaintenance(propertyId, payload, token) {
    return request(`/properties/${propertyId}/maintenance`, {
        method: "POST",
        headers: jsonHeaders(token),
        body: JSON.stringify(payload),
    });
}

async function deleteMaintenanceLog(propertyId, logId, token) {
    return request(`/properties/${propertyId}/maintenance/${logId}`, {
        method: "DELETE",
        headers: authHeaders(token),
    });
}

/* ================= Maintenance Documents ================= */

async function uploadMaintenanceDocument(propertyId, logId, file, token) {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${BASE_URL}/properties/${propertyId}/maintenance/${logId}/documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || "Upload failed");
    return data;
}

async function listMaintenanceDocuments(propertyId, logId, token) {
    return request(`/properties/${propertyId}/maintenance/${logId}/documents`, {
        headers: authHeaders(token),
    });
}

async function downloadMaintenanceDocument(propertyId, logId, documentId, token) {
    const res = await fetch(
        `${BASE_URL}/properties/${propertyId}/maintenance/${logId}/documents/${documentId}/download`,
        {
            method: "GET",
            headers: authHeaders(token),
        }
    );

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message || "Download failed");
    }

    const contentDisposition = res.headers.get("content-disposition") || "";
    const match = contentDisposition.match(/filename="(.+?)"/i);
    const filename = match?.[1] || "document";

    const blob = await res.blob();
    return { blob, filename };
}

async function deleteMaintenanceDocument(propertyId, logId, documentId, token) {
    return request(`/properties/${propertyId}/maintenance/${logId}/documents/${documentId}`, {
        method: "DELETE",
        headers: authHeaders(token),
    });
}

/* ================= Receipts (Upload + Scan Flow) ================= */

/**
 * Upload an unattached receipt and return extracted fields.
 * POST /api/v1/documents/receipts
 */
async function uploadReceipt(file, token) {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${BASE_URL}/documents/receipts`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || "Receipt upload failed");
    return data;
}

/**
 * Attach an unattached receipt to a maintenance log.
 * POST /api/v1/documents/receipts/:documentId/attach
 */
async function attachReceipt(documentId, propertyId, logId, token) {
    return request(`/documents/receipts/${documentId}/attach`, {
        method: "POST",
        headers: jsonHeaders(token),
        body: JSON.stringify({ propertyId, logId }),
    });
}

/**
 * Download/view a receipt blob.
 * GET /api/v1/documents/receipts/:documentId
 */
async function getReceiptBlob(documentId, token) {
    const res = await fetch(`${BASE_URL}/documents/receipts/${documentId}`, {
        method: "GET",
        headers: authHeaders(token),
    });

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message || "Receipt download failed");
    }

    const contentDisposition = res.headers.get("content-disposition") || "";
    const match = contentDisposition.match(/filename="(.+?)"/i);
    const filename = match?.[1] || "receipt";

    const blob = await res.blob();
    return { blob, filename };
}

/**
 * Cleanup/delete an unattached receipt.
 * DELETE /api/v1/documents/receipts/:documentId
 */
async function deleteReceipt(documentId, token) {
    return request(`/documents/receipts/${documentId}`, {
        method: "DELETE",
        headers: authHeaders(token),
    });
}

/* ================= Export ================= */

export const api = {
    // auth
    login,
    register,
    me,

    // dashboard
    dashboardSummary,
    getUpcomingReminders,

    // properties
    listProperties,
    createProperty,

    // maintenance
    listMaintenance,
    createMaintenance,
    deleteMaintenanceLog,

    // maintenance documents
    uploadMaintenanceDocument,
    listMaintenanceDocuments,
    downloadMaintenanceDocument,
    deleteMaintenanceDocument,

    // receipts flow
    uploadReceipt,
    attachReceipt,
    getReceiptBlob,
    deleteReceipt,
};
