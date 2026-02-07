// homekeep-client/src/services/api.js

const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5050/api/v1";

async function request(
    path,
    { method = "GET", token, body, isFormData = false, headers: extraHeaders = {} } = {}
) {
    const headers = { ...extraHeaders };

    if (token) headers.Authorization = `Bearer ${token}`;

    // Only set JSON headers when NOT sending FormData
    if (!isFormData) headers["Content-Type"] = "application/json";

    const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body ? (isFormData ? body : JSON.stringify(body)) : undefined
    });

    // Some endpoints (like document streaming) won't be JSON; request() is for JSON endpoints only.
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(data?.error?.message || "Request failed.");
    }

    return data;
}

/**
 * Fetch a protected file as a Blob (so we can open/download it while sending the JWT).
 */
async function fetchBlob(url, token) {
    const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    });

    if (!res.ok) {
        let msg = "Failed to fetch file.";
        try {
            const data = await res.json();
            msg = data?.error?.message || msg;
        } catch {
            // ignore
        }
        throw new Error(msg);
    }

    const blob = await res.blob();
    const contentType = res.headers.get("content-type") || "";
    return { blob, contentType };
}

export const api = {
    // ---- Health / Dashboard ----
    health: () => request("/health"),
    dashboardSummary: (token) => request("/dashboard/summary", { token }),

    // ---- Auth ----
    register: (payload) => request("/auth/register", { method: "POST", body: payload }),
    login: (payload) => request("/auth/login", { method: "POST", body: payload }),

    // ---- Users ----
    me: (token) => request("/users/me", { token }),

    // ---- Properties ----
    listProperties: (token) => request("/properties", { token }),
    createProperty: (payload, token) => request("/properties", { method: "POST", body: payload, token }),

    // ---- Maintenance ----
    listMaintenance: (propertyId, token) =>
        request(`/properties/${propertyId}/maintenance`, { token }),

    createMaintenance: (propertyId, payload, token) =>
        request(`/properties/${propertyId}/maintenance`, { method: "POST", body: payload, token }),

    // ---- Documents (Week 3) ----
    listMaintenanceDocuments: (propertyId, logId, token) =>
        request(`/properties/${propertyId}/maintenance/${logId}/documents`, { token }),

    uploadMaintenanceDocument: (propertyId, logId, file, token) => {
        const form = new FormData();
        form.append("file", file);

        return request(`/properties/${propertyId}/maintenance/${logId}/documents`, {
            method: "POST",
            token,
            body: form,
            isFormData: true
        });
    },

    // Returns the protected URL (requires JWT)
    documentUrl: (documentId) => `${BASE_URL}/documents/${documentId}`,

    // Fetches the document with JWT and returns a Blob we can open in the browser
    fetchDocumentBlob: (documentId, token) => fetchBlob(`${BASE_URL}/documents/${documentId}`, token),

    getUpcomingReminders: (days, token) =>
        request(`/reminders/upcoming?days=${days}`, { token }),

    updateMaintenance: (propertyId, logId, payload, token) =>
        request(`/properties/${propertyId}/maintenance/${logId}`, {
            method: "PATCH",
            body: payload,
            token
        })

};
