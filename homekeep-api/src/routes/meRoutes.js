const router = require("express").Router();
const { requireAuth } = require("../middleware/auth");
const { me } = require("../controllers/meController");

// GET /api/v1/me
router.get("/me", requireAuth, me);

module.exports = router;
