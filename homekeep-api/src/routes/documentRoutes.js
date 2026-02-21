const router = require("express").Router();
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { requireAuth } = require("../middleware/auth");
const docCtrl = require("../controllers/documentController");

// -------------------- Multer setup --------------------
const UPLOAD_DIR = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.resolve(process.cwd(), "uploads");

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || "");
        const base = path
            .basename(file.originalname || "upload", ext)
            .replace(/[^a-zA-Z0-9-_]/g, "_")
            .slice(0, 60);
        cb(null, `${Date.now()}_${Math.random().toString(16).slice(2)}_${base}${ext}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

// -------------------- ROUTES --------------------

// GET /api/v1/documents?propertyId=...&logId=...
router.get("/documents", requireAuth, docCtrl.listDocuments);

// GET /api/v1/documents/:documentId/download?propertyId=...&logId=...
router.get("/documents/:documentId/download", requireAuth, docCtrl.downloadDocument);

// DELETE /api/v1/documents/:documentId?propertyId=...&logId=...
router.delete("/documents/:documentId", requireAuth, docCtrl.deleteDocument);

// ✅ Receipts inbox
// POST /api/v1/documents/receipts (multipart file upload -> req.file)
router.post("/documents/receipts", requireAuth, upload.single("file"), docCtrl.uploadReceipt);

// GET /api/v1/documents/receipts
router.get("/documents/receipts", requireAuth, docCtrl.listReceipts);

// GET /api/v1/documents/receipts/:documentId/download
router.get("/documents/receipts/:documentId/download", requireAuth, docCtrl.downloadReceipt);

// POST /api/v1/documents/receipts/:documentId/rescan
router.post("/documents/receipts/:documentId/rescan", requireAuth, docCtrl.rescanReceipt);

// PATCH /api/v1/documents/receipts/:documentId (edit extracted fields)
router.patch("/documents/receipts/:documentId", requireAuth, docCtrl.updateReceipt);

// POST /api/v1/documents/receipts/:documentId/attach
router.post("/documents/receipts/:documentId/attach", requireAuth, docCtrl.attachReceipt);

// POST /api/v1/documents/receipts/:documentId/create-log
router.post("/documents/receipts/:documentId/create-log", requireAuth, docCtrl.createLogFromReceipt);

// DELETE /api/v1/documents/receipts/:documentId
router.delete("/documents/receipts/:documentId", requireAuth, docCtrl.deleteReceipt);

module.exports = router;
