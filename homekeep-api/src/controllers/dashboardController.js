const MaintenanceLog = require("../models/MaintenanceLog");
const Property = require("../models/Property");

function startOfMonthUTC(d = new Date()) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function startOfYearUTC(d = new Date()) {
    return new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
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

function pickOwnerId(req) {
    return req.user?._id || req.user?.id;
}

// GET /api/v1/dashboard/summary?windowDays=30|90|365
async function getDashboardSummary(req, res) {
    try {
        const ownerId = pickOwnerId(req);
        if (!ownerId) {
            return res.status(401).json({ success: false, error: { message: "Unauthorized." } });
        }

        const now = new Date();
        const monthStart = startOfMonthUTC(now);
        const yearStart = startOfYearUTC(now);

        // optional window for analytics lists/graphs
        let windowDays = Number(req.query.windowDays || 30);
        if (!Number.isFinite(windowDays) || windowDays <= 0) windowDays = 30;
        windowDays = Math.min(Math.max(windowDays, 7), 365);

        const windowStart = startOfDayUTC(addDaysUTC(now, -windowDays + 1));

        // Meta counts (safe, stable)
        const [totalProperties, totalLogs] = await Promise.all([
            Property.countDocuments({ owner: ownerId }),
            MaintenanceLog.countDocuments({ owner: ownerId }),
        ]);

        // Totals
        const [monthAgg, yearAgg, allAgg] = await Promise.all([
            MaintenanceLog.aggregate([
                { $match: { owner: ownerId, serviceDate: { $gte: monthStart } } },
                { $group: { _id: null, total: { $sum: { $ifNull: ["$cost", 0] } } } },
            ]),
            MaintenanceLog.aggregate([
                { $match: { owner: ownerId, serviceDate: { $gte: yearStart } } },
                { $group: { _id: null, total: { $sum: { $ifNull: ["$cost", 0] } } } },
            ]),
            MaintenanceLog.aggregate([
                { $match: { owner: ownerId } },
                { $group: { _id: null, total: { $sum: { $ifNull: ["$cost", 0] } } } },
            ]),
        ]);

        const totals = {
            month: monthAgg?.[0]?.total || 0,
            year: yearAgg?.[0]?.total || 0,
            allTime: allAgg?.[0]?.total || 0,
        };

        // Recent logs (for UI, optional)
        const recentLogs = await MaintenanceLog.find({ owner: ownerId })
            .populate("property", "nickname city province addressLine1")
            .sort({ serviceDate: -1, createdAt: -1 })
            .limit(8);

        // Spend by category (within window)
        const byCategory = await MaintenanceLog.aggregate([
            { $match: { owner: ownerId, serviceDate: { $gte: windowStart } } },
            {
                $group: {
                    _id: { $ifNull: ["$category", "Uncategorized"] },
                    total: { $sum: { $ifNull: ["$cost", 0] } },
                    count: { $sum: 1 },
                },
            },
            { $project: { _id: 0, category: "$_id", total: 1, count: 1 } },
            { $sort: { total: -1 } },
            { $limit: 10 },
        ]);

        // Top vendors (within window)
        const topVendors = await MaintenanceLog.aggregate([
            { $match: { owner: ownerId, serviceDate: { $gte: windowStart }, vendor: { $ne: "" } } },
            {
                $group: {
                    _id: "$vendor",
                    total: { $sum: { $ifNull: ["$cost", 0] } },
                    count: { $sum: 1 },
                },
            },
            { $project: { _id: 0, vendor: "$_id", total: 1, count: 1 } },
            { $sort: { total: -1 } },
            { $limit: 10 },
        ]);

        // Daily spend (within window) – returns only days with spend
        const dailyAgg = await MaintenanceLog.aggregate([
            { $match: { owner: ownerId, serviceDate: { $gte: windowStart } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$serviceDate" } },
                    total: { $sum: { $ifNull: ["$cost", 0] } },
                },
            },
            { $project: { _id: 0, date: "$_id", total: 1 } },
            { $sort: { date: 1 } },
        ]);

        // ---- Smart insights (safe additions) ----

        // Most expensive category THIS MONTH
        const topCategoryMonthAgg = await MaintenanceLog.aggregate([
            { $match: { owner: ownerId, serviceDate: { $gte: monthStart } } },
            {
                $group: {
                    _id: { $ifNull: ["$category", "Uncategorized"] },
                    total: { $sum: { $ifNull: ["$cost", 0] } },
                },
            },
            { $sort: { total: -1 } },
            { $limit: 1 },
            { $project: { _id: 0, category: "$_id", total: 1 } },
        ]);

        const topCategoryThisMonth = topCategoryMonthAgg?.[0] || { category: null, total: 0 };

        // Biggest single log in last 30 days (independent of window)
        const biggest30dStart = startOfDayUTC(addDaysUTC(now, -30 + 1));
        const biggestLogAgg = await MaintenanceLog.aggregate([
            { $match: { owner: ownerId, serviceDate: { $gte: biggest30dStart } } },
            {
                $project: {
                    title: 1,
                    vendor: 1,
                    category: 1,
                    serviceDate: 1,
                    cost: { $ifNull: ["$cost", 0] },
                    property: 1,
                },
            },
            { $sort: { cost: -1 } },
            { $limit: 1 },
        ]);

        const biggestLogLast30Days = biggestLogAgg?.[0] || null;

        return res.json({
            success: true,
            data: {
                meta: { totalProperties, totalLogs, windowDays },

                totals,
                recentLogs,

                byCategory,
                topVendors,
                dailySpend: dailyAgg,

                insights: {
                    topCategoryThisMonth,
                    biggestLogLast30Days,
                },

                // keep stable keys so UI never breaks if you expand later
                remindersSummary: { windowDays: 30, overdueCount: 0, upcomingCount: 0 },
                byProperty: [],
            },
        });
    } catch (err) {
        console.error("getDashboardSummary error:", err);
        return res.status(500).json({ success: false, error: { message: "Server error." } });
    }
}

module.exports = { getDashboardSummary };

