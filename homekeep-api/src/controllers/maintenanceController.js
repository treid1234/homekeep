const MaintenanceLog = require("../models/MaintenanceLog");
const Property = require("../models/Property");

function pickOwnerId(req) {
    return req.user?._id || req.user?.id;
}

function clampInt(n, { min, max, fallback }) {
    const x = Number.parseInt(String(n), 10);
    if (!Number.isFinite(x)) return fallback;
    return Math.max(min, Math.min(max, x));
}

// Supports:
//   sort=-serviceDate
//   sort=serviceDate
//   sort=-createdAt
//   sort=createdAt
//   sort=-cost
//   sort=cost
function parseSort(sortRaw) {
    const allowed = new Set(["serviceDate", "createdAt", "cost", "title"]);
    const raw = String(sortRaw || "").trim();
    if (!raw) return { serviceDate: -1, createdAt: -1 };

    const desc = raw.startsWith("-");
    const key = desc ? raw.slice(1) : raw;
    if (!allowed.has(key)) return { serviceDate: -1, createdAt: -1 };

    return { [key]: desc ? -1 : 1 };
}

// GET /api/v1/properties/:propertyId/maintenance?page=1&limit=25&sort=-serviceDate
async function listMaintenance(req, res) {
    try {
        const owner = pickOwnerId(req);
        const { propertyId } = req.params;

        if (!owner) return res.status(401).json({ success: false, error: { message: "Unauthorized." } });
        if (!propertyId) return res.status(400).json({ success: false, error: { message: "propertyId is required." } });

        // Ensure property belongs to owner
        const prop = await Property.findOne({ _id: propertyId, owner }).select("_id");
        if (!prop) return res.status(404).json({ success: false, error: { message: "Property not found." } });

        const page = clampInt(req.query.page, { min: 1, max: 999999, fallback: 1 });
        const limit = clampInt(req.query.limit, { min: 1, max: 100, fallback: 25 });
        const sort = parseSort(req.query.sort);

        const query = { owner, property: propertyId };

        const [totalItems, logs] = await Promise.all([
            MaintenanceLog.countDocuments(query),
            MaintenanceLog.find(query)
                .sort(sort)
                .skip((page - 1) * limit)
                .limit(limit),
        ]);

        const totalPages = Math.max(1, Math.ceil(totalItems / limit));

        // ✅ Backwards-compatible shape: logs array remains in data.logs
        // ✅ Adds pagination meta for UI
        return res.json({
            success: true,
            data: {
                logs,
                pagination: {
                    page,
                    limit,
                    totalItems,
                    totalPages,
                    sort,
                },
            },
        });
    } catch (err) {
        console.error("listMaintenance error:", err);
        return res.status(500).json({ success: false, error: { message: "Server error." } });
    }
}

// POST /api/v1/properties/:propertyId/maintenance
async function createMaintenance(req, res) {
    try {
        const owner = pickOwnerId(req);
        const { propertyId } = req.params;

        if (!owner) return res.status(401).json({ success: false, error: { message: "Unauthorized." } });
        if (!propertyId) return res.status(400).json({ success: false, error: { message: "propertyId is required." } });

        const prop = await Property.findOne({ _id: propertyId, owner }).select("_id");
        if (!prop) return res.status(404).json({ success: false, error: { message: "Property not found." } });

        const payload = req.body || {};
        if (!payload.title || !String(payload.title).trim()) {
            return res.status(400).json({ success: false, error: { message: "title is required." } });
        }
        if (!payload.serviceDate) {
            return res.status(400).json({ success: false, error: { message: "serviceDate is required." } });
        }

        const log = await MaintenanceLog.create({
            owner,
            property: propertyId,
            title: String(payload.title).trim(),
            category: String(payload.category || "General").trim(),
            vendor: String(payload.vendor || "").trim(),
            serviceDate: payload.serviceDate,
            cost: Number(payload.cost || 0),
            notes: String(payload.notes || "").trim(),
            nextDueDate: payload.nextDueDate || null,
            reminderEnabled: !!payload.reminderEnabled,
        });

        return res.status(201).json({ success: true, data: { log } });
    } catch (err) {
        console.error("createMaintenance error:", err);
        return res.status(500).json({ success: false, error: { message: "Server error." } });
    }
}

// PUT /api/v1/properties/:propertyId/maintenance/:logId
async function updateMaintenanceLog(req, res) {
    try {
        const owner = pickOwnerId(req);
        const { propertyId, logId } = req.params;

        if (!owner) return res.status(401).json({ success: false, error: { message: "Unauthorized." } });
        if (!propertyId || !logId) {
            return res.status(400).json({ success: false, error: { message: "propertyId and logId are required." } });
        }

        const prop = await Property.findOne({ _id: propertyId, owner }).select("_id");
        if (!prop) return res.status(404).json({ success: false, error: { message: "Property not found." } });

        const log = await MaintenanceLog.findOne({ _id: logId, owner, property: propertyId });
        if (!log) return res.status(404).json({ success: false, error: { message: "Maintenance log not found." } });

        const payload = req.body || {};

        if (payload.title !== undefined) log.title = String(payload.title || "").trim();
        if (payload.category !== undefined) log.category = String(payload.category || "General").trim();
        if (payload.vendor !== undefined) log.vendor = String(payload.vendor || "").trim();
        if (payload.serviceDate !== undefined) log.serviceDate = payload.serviceDate;
        if (payload.cost !== undefined) log.cost = Number(payload.cost || 0);
        if (payload.notes !== undefined) log.notes = String(payload.notes || "").trim();
        if (payload.nextDueDate !== undefined) log.nextDueDate = payload.nextDueDate || null;
        if (payload.reminderEnabled !== undefined) log.reminderEnabled = !!payload.reminderEnabled;

        await log.save();

        return res.json({ success: true, data: { log } });
    } catch (err) {
        console.error("updateMaintenanceLog error:", err);
        return res.status(500).json({ success: false, error: { message: "Server error." } });
    }
}

// DELETE /api/v1/properties/:propertyId/maintenance/:logId
async function deleteMaintenanceLog(req, res) {
    try {
        const owner = pickOwnerId(req);
        const { propertyId, logId } = req.params;

        if (!owner) return res.status(401).json({ success: false, error: { message: "Unauthorized." } });
        if (!propertyId || !logId) {
            return res.status(400).json({ success: false, error: { message: "propertyId and logId are required." } });
        }

        const log = await MaintenanceLog.findOne({ _id: logId, owner, property: propertyId });
        if (!log) return res.status(404).json({ success: false, error: { message: "Maintenance log not found." } });

        await log.deleteOne();
        return res.json({ success: true, data: { ok: true } });
    } catch (err) {
        console.error("deleteMaintenanceLog error:", err);
        return res.status(500).json({ success: false, error: { message: "Server error." } });
    }
}

module.exports = {
    listMaintenance,
    createMaintenance,
    updateMaintenanceLog,
    deleteMaintenanceLog,
};
