// src/controllers/reminderController.js
const MaintenanceLog = require("../models/MaintenanceLog");

/**
 * We treat reminders as "maintenance logs that have nextDueDate + reminderEnabled".
 * No separate Reminder model needed.
 */

function safeInt(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function startOfDayUTC(date) {
    const d = new Date(date);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDaysUTC(date, days) {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
}

function badgeStatus(nextDueDate) {
    const now = startOfDayUTC(new Date());
    const due = startOfDayUTC(nextDueDate);

    const diffDays = Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { status: "overdue", diffDays };
    if (diffDays <= 7) return { status: "dueSoon", diffDays };
    return { status: "future", diffDays };
}

/**
 * GET /api/v1/reminders
 * Optional query: propertyId
 * Lists all reminder-enabled logs that have a nextDueDate, sorted by nextDueDate asc.
 */
async function listReminders(req, res) {
    try {
        const ownerId = req.user._id || req.user.id;
        const { propertyId } = req.query || {};

        const filter = {
            owner: ownerId,
            reminderEnabled: true,
            nextDueDate: { $ne: null },
        };
        if (propertyId) filter.property = propertyId;

        const logs = await MaintenanceLog.find(filter)
            .populate("property", "nickname city province")
            .sort({ nextDueDate: 1, createdAt: -1 });

        const reminders = logs.map((log) => {
            const nextDue = log.nextDueDate ? new Date(log.nextDueDate) : null;
            const meta = nextDue ? badgeStatus(nextDue) : { status: "future", diffDays: null };

            return {
                _id: log._id,
                property: log.property,
                title: log.title,
                category: log.category,
                vendor: log.vendor,
                serviceDate: log.serviceDate,
                cost: log.cost,
                nextDueDate: log.nextDueDate,
                reminderEnabled: log.reminderEnabled,
                reminderStatus: meta.status,
                dueInDays: meta.diffDays,
                createdAt: log.createdAt,
                updatedAt: log.updatedAt,
            };
        });

        return res.json({ success: true, data: { reminders } });
    } catch (err) {
        console.error("listReminders error:", err);
        return res.status(500).json({ success: false, error: { message: "Server error." } });
    }
}

/**
 * GET /api/v1/reminders/upcoming?windowDays=30
 * Returns reminders due within the next N days, plus overdue.
 */
async function getUpcomingReminders(req, res) {
    try {
        const ownerId = req.user._id || req.user.id;

        const windowDays = safeInt(req.query?.windowDays, 30);
        const now = startOfDayUTC(new Date());
        const windowEnd = addDaysUTC(now, windowDays);

        const logs = await MaintenanceLog.find({
            owner: ownerId,
            reminderEnabled: true,
            nextDueDate: { $ne: null, $lte: windowEnd },
        })
            .populate("property", "nickname city province")
            .sort({ nextDueDate: 1, createdAt: -1 });

        const reminders = logs.map((log) => {
            const nextDue = new Date(log.nextDueDate);
            const meta = badgeStatus(nextDue);

            return {
                _id: log._id,
                property: log.property,
                title: log.title,
                category: log.category,
                vendor: log.vendor,
                serviceDate: log.serviceDate,
                cost: log.cost,
                nextDueDate: log.nextDueDate,
                reminderEnabled: log.reminderEnabled,
                reminderStatus: meta.status,
                dueInDays: meta.diffDays,
                createdAt: log.createdAt,
                updatedAt: log.updatedAt,
            };
        });

        const overdueCount = reminders.filter((r) => r.reminderStatus === "overdue").length;
        const upcomingCount = reminders.filter((r) => r.reminderStatus !== "overdue").length;

        return res.json({
            success: true,
            data: {
                windowDays,
                overdueCount,
                upcomingCount,
                reminders,
            },
        });
    } catch (err) {
        console.error("getUpcomingReminders error:", err);
        return res.status(500).json({ success: false, error: { message: "Server error." } });
    }
}

/**
 * POST /api/v1/reminders/:logId/snooze
 * Body: { days?: number } default 7
 * Adds N days to nextDueDate (keeps reminderEnabled true).
 */
async function snoozeReminder(req, res) {
    try {
        const ownerId = req.user._id || req.user.id;
        const { logId } = req.params;
        const days = safeInt(req.body?.days, 7);

        const log = await MaintenanceLog.findOne({
            _id: logId,
            owner: ownerId,
            reminderEnabled: true,
            nextDueDate: { $ne: null },
        });

        if (!log) {
            return res.status(404).json({ success: false, error: { message: "Reminder not found." } });
        }

        const current = startOfDayUTC(log.nextDueDate);
        const next = addDaysUTC(current, days);
        log.nextDueDate = next;
        await log.save();

        return res.json({
            success: true,
            data: {
                message: `Snoozed ${days} day${days === 1 ? "" : "s"}.`,
                nextDueDate: log.nextDueDate,
            },
        });
    } catch (err) {
        console.error("snoozeReminder error:", err);
        return res.status(500).json({ success: false, error: { message: "Server error." } });
    }
}

/**
 * POST /api/v1/reminders/:logId/complete
 * Marks reminder as completed by turning off reminderEnabled and clearing nextDueDate.
 * (The log still exists as historical maintenance.)
 */
async function completeReminder(req, res) {
    try {
        const ownerId = req.user._id || req.user.id;
        const { logId } = req.params;

        const log = await MaintenanceLog.findOne({
            _id: logId,
            owner: ownerId,
        });

        if (!log) {
            return res.status(404).json({ success: false, error: { message: "Maintenance log not found." } });
        }

        log.reminderEnabled = false;
        log.nextDueDate = null;
        await log.save();

        return res.json({
            success: true,
            data: { message: "Reminder completed." },
        });
    } catch (err) {
        console.error("completeReminder error:", err);
        return res.status(500).json({ success: false, error: { message: "Server error." } });
    }
}

module.exports = {
    listReminders,
    getUpcomingReminders,
    snoozeReminder,
    completeReminder,
};

