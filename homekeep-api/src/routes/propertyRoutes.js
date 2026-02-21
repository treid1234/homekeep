const router = require("express").Router();
const { requireAuth } = require("../middleware/auth");
const {
    listProperties,
    getProperty,
    createProperty,
} = require("../controllers/propertyController");

// Because server.js mounts this router at:
//   app.use("/api/v1/properties", propertyRoutes);
//
// The routes here must be relative to that base path.

// GET /api/v1/properties
router.get("/", requireAuth, listProperties);

// GET /api/v1/properties/:id
router.get("/:id", requireAuth, getProperty);

// POST /api/v1/properties
router.post("/", requireAuth, createProperty);

module.exports = router;




