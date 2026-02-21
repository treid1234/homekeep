// src/controllers/receiptController.js
const fs = require("fs");
const path = require("path");

const Document = require("../models/Document");
const Property = require("../models/Property");
const MaintenanceLog = require("../models/MaintenanceLog");

const { extractReceiptFields } = require("../utils/receiptExtractor");

const UPLOAD_DIR = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.resolve(process.cwd(), "uploads");

function safeString(v) {
    return typeof v === "string" ? v.trim() : "";
}

function toNumberOrNull(v) {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function toDateOrNull(v) {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
}

function filenameWithoutExt(name = "") {
    const base = String(name || "");
    return base.replace(/\.[^/.]+$/, "");
}

function normalizeExtracted(extracted = {}) {
    return {
        vendor: extracted.vendor ?? null,
        amount: typeof extracted.amount === "number" ? extracted.amount : null,
        date: extracted.date ? new Date(extracted.date) : null,
        category: extracted.category ?? null,
        titleSuggestion: extracted.titleSuggestion ?? null,
    };
}

function parsePositiveInt(v, fallback) {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    const i = Math.floor(n);
    return i < 0 ? fallback : i;
}

function safeUnlink(filePath) {
    try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
        // best-effort cleanup
    }
}

/**
 * 1) Upload receipt (unattached) and run extraction
 * POST /api/v1/documents/receipts
 */
exports.uploadReceipt = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: { message: "Please upload a file." },
            });
        }

        const ownerId = req.user._id || req.user.id;

        const filePath = req.file.path;
        const mimeType = req.file.mimetype || "application/octet-stream";

        // Extract fields (PDF text or OCR fallback)
        const extractedResult = await extractReceiptFields({
            filePath,
            mimeType,
        });

        const extracted = normalizeExtracted(extractedResult);

        const doc = await Document.create({
            owner: ownerId,
            property: null,
            maintenanceLog: null,

            originalName: req.file.originalname,
            storedName: req.file.filename,
            mimeType,
            size: req.file.size || 0,

            extracted,
            kind: "receipt",
            status: "unattached",
        });

        return res.json({
            success: true,
            data: {
                documentId: doc._id,
                document: doc,
                extracted: doc.extracted,
                textSample: extractedResult?.textSample || "",
            },
        });
    } catch (err) {
        console.error("uploadReceipt error:", err);
        return res.status(500).json({
            success: false,
            error: { message: "Server error." },
        });
    }
};

/**
 * 2) Attach a previously uploaded receipt to an existing maintenance log
 * POST /api/v1/documents/receipts/:documentId/attach
 * Body: { propertyId, logId }
 */
exports.attachReceiptToLog = async (req, res) => {
    try {
        const ownerId = req.user._id || req.user.id;
        const { documentId } = req.params;
        const { propertyId, logId } = req.body || {};

        if (!propertyId || !logId) {
            return res.status(400).json({
                success: false,
                error: { message: "propertyId and logId are required." },
            });
        }

        // Ensure log exists and belongs to user + property matches
        const log = await MaintenanceLog.findOne({
            _id: logId,
            owner: ownerId,
            property: propertyId,
        }).select("_id owner property");

        if (!log) {
            return res.status(404).json({
                success: false,
                error: { message: "Maintenance log not found." },
            });
        }

        // Ensure receipt doc exists and belongs to user
        const doc = await Document.findOne({
            _id: documentId,
            owner: ownerId,
            kind: "receipt",
        });

        if (!doc) {
            return res.status(404).json({
                success: false,
                error: { message: "Receipt document not found." },
            });
        }

        doc.property = propertyId;
        doc.maintenanceLog = logId;
        doc.status = "attached";
        await doc.save();

        return res.json({
            success: true,
            data: {
                message: "Receipt attached.",
                document: doc,
            },
        });
    } catch (err) {
        console.error("attachReceiptToLog error:", err);
        return res.status(500).json({
            success: false,
            error: { message: "Server error." },
        });
    }
};

/**
 * 3) Create NEW maintenance log + attach receipt
 * POST /api/v1/documents/receipts/:documentId/create-log
 * Body: { propertyId, overrides?: { title, category, vendor, serviceDate, cost, notes, nextDueDate, reminderEnabled } }
 */
exports.createLogFromReceipt = async (req, res) => {
    try {
        const ownerId = req.user._id || req.user.id;
        const { documentId } = req.params;

        const { propertyId, overrides } = req.body || {};
        const o = overrides || {};

        if (!propertyId) {
            return res.status(400).json({
                success: false,
                error: { message: "propertyId is required." },
            });
        }

        // Confirm property belongs to this user
        const property = await Property.findOne({ _id: propertyId, owner: ownerId }).select("_id");
        if (!property) {
            return res.status(404).json({
                success: false,
                error: { message: "Property not found." },
            });
        }

        const doc = await Document.findOne({
            _id: documentId,
            owner: ownerId,
            kind: "receipt",
        });

        if (!doc) {
            return res.status(404).json({
                success: false,
                error: { message: "Receipt document not found." },
            });
        }

        // Defaults from extraction
        const extracted = doc.extracted || {};
        const extractedVendor = safeString(extracted.vendor);
        const extractedCategory = safeString(extracted.category) || "General";
        const extractedTitle = safeString(extracted.titleSuggestion);
        const extractedAmount = typeof extracted.amount === "number" ? extracted.amount : null;
        const extractedDate = extracted.date ? new Date(extracted.date) : null;

        // Apply overrides (UI can override anything)
        const title =
            safeString(o.title) ||
            extractedTitle ||
            filenameWithoutExt(doc.originalName) ||
            "New maintenance log";

        const category = safeString(o.category) || extractedCategory || "General";
        const vendor = safeString(o.vendor) || extractedVendor || "";

        // serviceDate is REQUIRED by MaintenanceLog schema
        const serviceDate =
            toDateOrNull(o.serviceDate) ||
            (extractedDate && !isNaN(extractedDate.getTime()) ? extractedDate : null) ||
            new Date(); // fallback so schema doesn't throw

        const cost =
            toNumberOrNull(o.cost) ??
            (typeof extractedAmount === "number" ? extractedAmount : 0);

        const notes = safeString(o.notes) || "";
        const nextDueDate = toDateOrNull(o.nextDueDate);
        const reminderEnabled =
            typeof o.reminderEnabled === "boolean" ? o.reminderEnabled : true;

        // Create the log
        const log = await MaintenanceLog.create({
            owner: ownerId,
            property: propertyId,
            title,
            category,
            vendor,
            serviceDate,
            cost: Number.isFinite(cost) ? cost : 0,
            notes,
            nextDueDate: nextDueDate || null,
            reminderEnabled,
        });

        // Attach the receipt to the new log
        doc.property = propertyId;
        doc.maintenanceLog = log._id;
        doc.status = "attached";
        await doc.save();

        return res.json({
            success: true,
            data: {
                message: "Maintenance log created and receipt attached.",
                log,
                document: doc,
            },
        });
    } catch (err) {
        console.error("createLogFromReceipt error:", err);
        return res.status(500).json({
            success: false,
            error: { message: "Server error." },
        });
    }
};

/**
 * 4) List receipts (filters: propertyId, logId, status, kind, limit, skip)
 * GET /api/v1/documents/receipts?propertyId=&logId=&status=&kind=&limit=&skip=
 */
exports.listReceipts = async (req, res) => {
    try {
        const ownerId = req.user._id || req.user.id;

        const propertyId = safeString(req.query.propertyId);
        const logId = safeString(req.query.logId);
        const status = safeString(req.query.status); // attached | unattached
        const kind = safeString(req.query.kind); // receipt | attachment (but receipts endpoint is typically receipt)
        const limit = parsePositiveInt(req.query.limit, 50);
        const skip = parsePositiveInt(req.query.skip, 0);

        const filter = { owner: ownerId };

        if (propertyId) filter.property = propertyId;
        if (logId) filter.maintenanceLog = logId;
        if (status) filter.status = status;
        if (kind) filter.kind = kind;
        else filter.kind = "receipt"; // default for this endpoint

        const docs = await Document.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Math.min(limit, 200));

        const total = await Document.countDocuments(filter);

        return res.json({
            success: true,
            data: {
                total,
                limit: Math.min(limit, 200),
                skip,
                receipts: docs,
            },
        });
    } catch (err) {
        console.error("listReceipts error:", err);
        return res.status(500).json({
            success: false,
            error: { message: "Server error." },
        });
    }
};

/**
 * 5) Cleanup unattached receipts older than N days (default 7)
 * DELETE /api/v1/documents/receipts/unattached?days=7
 */
exports.cleanupUnattachedReceipts = async (req, res) => {
    try {
        const ownerId = req.user._id || req.user.id;
        const days = parsePositiveInt(req.query.days, 7);

        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        // Find docs first so we can delete files too
        const toDelete = await Document.find({
            owner: ownerId,
            kind: "receipt",
            status: "unattached",
            createdAt: { $lt: cutoff },
        }).select("_id storedName");

        if (!toDelete.length) {
            return res.json({
                success: true,
                data: {
                    deletedCount: 0,
                    days,
                },
            });
        }

        const ids = toDelete.map((d) => d._id);

        // Delete DB records
        await Document.deleteMany({ _id: { $in: ids }, owner: ownerId });

        // Best-effort file cleanup
        for (const d of toDelete) {
            if (!d?.storedName) continue;
            const filePath = path.join(UPLOAD_DIR, d.storedName);
            safeUnlink(filePath);
        }

        return res.json({
            success: true,
            data: {
                deletedCount: ids.length,
                days,
            },
        });
    } catch (err) {
        console.error("cleanupUnattachedReceipts error:", err);
        return res.status(500).json({
            success: false,
            error: { message: "Server error." },
        });
    }
};

/**
 * 6) Secure view/download receipt bytes
 * GET /api/v1/documents/receipts/:documentId
 */
exports.getReceipt = async (req, res) => {
    try {
        const ownerId = req.user._id || req.user.id;
        const { documentId } = req.params;

        const doc = await Document.findOne({
            _id: documentId,
            owner: ownerId,
            kind: "receipt",
        });

        if (!doc) {
            return res.status(404).json({
                success: false,
                error: { message: "Receipt not found." },
            });
        }

        const filePath = path.join(UPLOAD_DIR, doc.storedName);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                error: { message: "File not found on server." },
            });
        }

        res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
        res.setHeader(
            "Content-Disposition",
            `inline; filename="${doc.originalName || "receipt"}"`
        );

        return fs.createReadStream(filePath).pipe(res);
    } catch (err) {
        console.error("getReceipt error:", err);
        return res.status(500).json({
            success: false,
            error: { message: "Server error." },
        });
    }
};

/**
 * 7) Delete receipt + file
 * DELETE /api/v1/documents/receipts/:documentId
 */
exports.deleteReceipt = async (req, res) => {
    try {
        const ownerId = req.user._id || req.user.id;
        const { documentId } = req.params;

        const doc = await Document.findOne({
            _id: documentId,
            owner: ownerId,
            kind: "receipt",
        });

        if (!doc) {
            return res.status(404).json({
                success: false,
                error: { message: "Receipt not found." },
            });
        }

        await Document.deleteOne({ _id: doc._id });

        const filePath = path.join(UPLOAD_DIR, doc.storedName);
        safeUnlink(filePath);

        return res.json({
            success: true,
            data: { message: "Receipt deleted." },
        });
    } catch (err) {
        console.error("deleteReceipt error:", err);
        return res.status(500).json({
            success: false,
            error: { message: "Server error." },
        });
    }
};
