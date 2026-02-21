const router = require("express").Router();
const { requireAuth } = require("../middleware/auth");
const dashboardCtrl = require("../controllers/dashboardController");

// GET /api/v1/dashboard/summary?windowDays=30|90|365
router.get("/summary", requireAuth, dashboardCtrl.getDashboardSummary);

module.exports = router;
