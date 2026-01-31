const BASE_URL = import.meta.env.VITE_API_BASE_URL;

async function request(path, { method = "GET", body, token } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const message = data?.error?.message || "Request failed.";
        throw new Error(message);
    }
    return data;
}

export const api = {
    register: (payload) => request("/auth/register", { method: "POST", body: payload }),
    login: (payload) => request("/auth/login", { method: "POST", body: payload }),
    me: (token) => request("/users/me", { token }),
    listProperties: (token) => request("/properties", { token }),
    createProperty: (payload, token) => request("/properties", { method: "POST", body: payload, token }),
    listMaintenance: (propertyId, token) =>
        request(`/properties/${propertyId}/maintenance`, { token }),
    createMaintenance: (propertyId, payload, token) =>
        request(`/properties/${propertyId}/maintenance`, { method: "POST", body: payload, token }),
    dashboardSummary: (token) => request("/dashboard/summary", { token }),
};
