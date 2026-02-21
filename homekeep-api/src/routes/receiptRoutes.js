const router = require("express").Router();
const { requireAuth } = require("../middleware/auth");
const upload = require("../middleware/upload");

const {
    uploadReceipt,
    attachReceiptToLog,
    createLogFromReceipt,
    listReceipts,
    cleanupUnattachedReceipts,
    getReceipt,
    deleteReceipt,
} = require("../controllers/receiptController");

// 1) Upload receipt (unattached) + scan/extract
router.post("/documents/receipts", requireAuth, upload.single("file"), uploadReceipt);

// 2) Attach receipt -> property/log
router.post("/documents/receipts/:documentId/attach", requireAuth, attachReceiptToLog);

// 3) Create NEW maintenance log from receipt + attach
router.post("/documents/receipts/:documentId/create-log", requireAuth, createLogFromReceipt);

// 4) List receipts (filters: propertyId, logId, status, kind, limit, skip)
router.get("/documents/receipts", requireAuth, listReceipts);

// 5) Cleanup unattached receipts older than N days (default 7)
router.delete("/documents/receipts/unattached", requireAuth, cleanupUnattachedReceipts);

// 6) View/download receipt bytes
router.get("/documents/receipts/:documentId", requireAuth, getReceipt);

// 7) Delete receipt + file
router.delete("/documents/receipts/:documentId", requireAuth, deleteReceipt);

module.exports = router;
