const router = require("express").Router();
const { requireAuth } = require("../middleware/auth");

const {
    listMaintenance,
    createMaintenance,
    updateMaintenanceLog,
    deleteMaintenanceLog,
} = require("../controllers/maintenanceController");

function mustBeFn(fn, name) {
    if (typeof fn !== "function") {
        throw new Error(
            `maintenanceController.${name} is not a function. Check exports in src/controllers/maintenanceController.js`
        );
    }
    return fn;
}

router.get(
    "/properties/:propertyId/maintenance",
    requireAuth,
    mustBeFn(listMaintenance, "listMaintenance")
);

router.post(
    "/properties/:propertyId/maintenance",
    requireAuth,
    mustBeFn(createMaintenance, "createMaintenance")
);

router.put(
    "/properties/:propertyId/maintenance/:logId",
    requireAuth,
    mustBeFn(updateMaintenanceLog, "updateMaintenanceLog")
);

router.delete(
    "/properties/:propertyId/maintenance/:logId",
    requireAuth,
    mustBeFn(deleteMaintenanceLog, "deleteMaintenanceLog")
);

module.exports = router;
