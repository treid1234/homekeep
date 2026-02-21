// src/controllers/documentController.js
const fs = require("fs");
const path = require("path");
const { extractReceiptFields } = require("../utils/receiptExtractor");
const Document = require("../models/Document");
const Property = require("../models/Property");
const MaintenanceLog = require("../models/MaintenanceLog");

// -------------------- helpers --------------------
const UPLOAD_DIR = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.resolve(process.cwd(), "uploads");

function safeUnlink(filePath) {
    try {
        if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch { }
}

function pickUserId(req) {
    return req.user?._id || req.user?.id || null;
}

function resolveDiskPath(doc) {
    // Prefer stored filePath if present; otherwise derive from storedName + UPLOAD_DIR
    const fp = doc?.filePath ? path.resolve(doc.filePath) : null;
    if (fp) return fp;
    const stored = doc?.storedName ? String(doc.storedName) : "";
    return path.join(UPLOAD_DIR, stored);
}

function normalizeExtractedPayload(body = {}) {
    // Accept BOTH:
    // 1) { extracted: {...} }
    // 2) { vendor, amount, date, category, titleSuggestion }
    const ex = body.extracted && typeof body.extracted === "object" ? body.extracted : body;

    const vendor =
        typeof ex.vendor === "string" ? ex.vendor.trim() : ex.vendor == null ? null : String(ex.vendor).trim();

    const category =
        typeof ex.category === "string" ? ex.category.trim() : ex.category == null ? null : String(ex.category).trim();

    const titleSuggestion =
        typeof ex.titleSuggestion === "string"
            ? ex.titleSuggestion.trim()
            : ex.titleSuggestion == null
                ? null
                : String(ex.titleSuggestion).trim();

    let amount = ex.amount;
    if (amount === "" || amount === undefined) amount = null;
    if (amount !== null) {
        const n = Number(amount);
        amount = Number.isFinite(n) ? n : null;
    }

    let date = ex.date;
    if (date === "" || date === undefined) date = null;
    if (date !== null) {
        const dt = new Date(date);
        date = Number.isNaN(dt.getTime()) ? null : dt;
    }

    return {
        vendor: vendor === "" ? null : vendor,
        amount,
        date,
        category: category === "" ? null : category,
        titleSuggestion: titleSuggestion === "" ? null : titleSuggestion,
    };
}

// -------------------- DOCUMENTS (PER-LOG) --------------------
// GET /api/v1/documents?propertyId=...&logId=...
async function listDocuments(req, res, next) {
    try {
        const owner = pickUserId(req);
        const { propertyId, logId } = req.query;

        if (!owner) return res.status(401).json({ error: { message: "Unauthorized." } });
        if (!propertyId || !logId) {
            return res.status(400).json({ error: { message: "propertyId and logId are required." } });
        }

        // Optional but safer: ensure property exists and belongs to owner
        const prop = await Property.findOne({ _id: propertyId, owner });
        if (!prop) return res.status(404).json({ error: { message: "Property not found." } });

        // Optional but safer: ensure log exists under that property (and belongs to owner if schema supports owner)
        const log = await MaintenanceLog.findOne({ _id: logId, property: propertyId });
        if (!log) return res.status(404).json({ error: { message: "Maintenance log not found." } });

        const docs = await Document.find({
            owner,
            property: propertyId,
            maintenanceLog: logId,
            kind: "attachment",
        }).sort({ createdAt: -1 });

        return res.json({ documents: docs });
    } catch (err) {
        return next(err);
    }
}

// GET /api/v1/documents/:documentId/download?propertyId=...&logId=...
async function downloadDocument(req, res, next) {
    try {
        const owner = pickUserId(req);
        const { documentId } = req.params;
        const { propertyId, logId } = req.query;

        if (!owner) return res.status(401).json({ error: { message: "Unauthorized." } });
        if (!propertyId || !logId) {
            return res.status(400).json({ error: { message: "propertyId and logId are required." } });
        }

        const doc = await Document.findOne({
            _id: documentId,
            owner,
            property: propertyId,
            maintenanceLog: logId,
            kind: "attachment",
        });

        if (!doc) return res.status(404).json({ error: { message: "Document not found." } });

        const filePath = resolveDiskPath(doc);
        if (!filePath || !fs.existsSync(filePath)) {
            return res.status(404).json({ error: { message: "File missing on disk." } });
        }

        const filename = doc.originalName || "document";
        res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        return fs.createReadStream(filePath).pipe(res);
    } catch (err) {
        return next(err);
    }
}

// DELETE /api/v1/documents/:documentId?propertyId=...&logId=...
async function deleteDocument(req, res, next) {
    try {
        const owner = pickUserId(req);
        const { documentId } = req.params;
        const { propertyId, logId } = req.query;

        if (!owner) return res.status(401).json({ error: { message: "Unauthorized." } });
        if (!propertyId || !logId) {
            return res.status(400).json({ error: { message: "propertyId and logId are required." } });
        }

        const doc = await Document.findOne({
            _id: documentId,
            owner,
            property: propertyId,
            maintenanceLog: logId,
            kind: "attachment",
        });

        if (!doc) return res.status(404).json({ error: { message: "Document not found." } });

        const filePath = resolveDiskPath(doc);
        safeUnlink(filePath);

        await doc.deleteOne();
        return res.json({ ok: true });
    } catch (err) {
        return next(err);
    }
}

// -------------------- RECEIPTS INBOX --------------------

// POST /api/v1/documents/receipts
async function uploadReceipt(req, res, next) {
    try {
        const owner = pickUserId(req);
        if (!owner) return res.status(401).json({ error: { message: "Unauthorized." } });

        if (!req.file) {
            return res.status(400).json({ error: { message: "No file uploaded." } });
        }

        const filePath = req.file.path; // multer disk path
        const mimeType = req.file.mimetype || "application/octet-stream";
        const originalName = req.file.originalname || "receipt";
        const storedName = req.file.filename || path.basename(filePath);

        const extracted = await extractReceiptFields({
            filePath,
            mimeType,
            originalName,
        });

        const doc = await Document.create({
            owner,

            // receipts inbox
            kind: "receipt",
            status: "unattached",
            property: null,
            maintenanceLog: null,

            originalName,
            storedName,
            filePath, // IMPORTANT: supports direct reads later
            mimeType,
            size: req.file.size || 0,

            extracted: extracted || {},
        });

        return res.status(201).json({ document: doc });
    } catch (err) {
        // If DB fails, clean uploaded file so it doesn't orphan
        if (req.file?.path) safeUnlink(req.file.path);
        return next(err);
    }
}

// GET /api/v1/documents/receipts
async function listReceipts(req, res, next) {
    try {
        const owner = pickUserId(req);
        if (!owner) return res.status(401).json({ error: { message: "Unauthorized." } });

        const { status } = req.query;

        const query = { owner, kind: "receipt" };
        if (status) query.status = status;

        const receipts = await Document.find(query).sort({ createdAt: -1 });
        return res.json({ receipts });
    } catch (err) {
        return next(err);
    }
}

// GET /api/v1/documents/receipts/:documentId/download
async function downloadReceipt(req, res, next) {
    try {
        const owner = pickUserId(req);
        const { documentId } = req.params;

        if (!owner) return res.status(401).json({ error: { message: "Unauthorized." } });

        const doc = await Document.findOne({ _id: documentId, owner, kind: "receipt" });
        if (!doc) return res.status(404).json({ error: { message: "Receipt not found." } });

        const filePath = resolveDiskPath(doc);
        if (!filePath || !fs.existsSync(filePath)) {
            return res.status(404).json({ error: { message: "Receipt file missing on disk." } });
        }

        const filename = doc.originalName || "receipt";
        res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        return fs.createReadStream(filePath).pipe(res);
    } catch (err) {
        return next(err);
    }
}

// POST /api/v1/documents/receipts/:documentId/rescan
async function rescanReceipt(req, res, next) {
    try {
        const owner = pickUserId(req);
        const { documentId } = req.params;

        if (!owner) return res.status(401).json({ error: { message: "Unauthorized." } });

        const doc = await Document.findOne({ _id: documentId, owner, kind: "receipt" });
        if (!doc) return res.status(404).json({ error: { message: "Receipt not found." } });

        const filePath = resolveDiskPath(doc);
        if (!filePath || !fs.existsSync(filePath)) {
            return res.status(404).json({ error: { message: "Receipt file missing on disk." } });
        }

        const extracted = await extractReceiptFields({
            filePath,
            mimeType: doc.mimeType || "application/octet-stream",
            originalName: doc.originalName || "receipt",
        });

        doc.extracted = extracted || {};
        await doc.save();

        return res.json({ receipt: doc });
    } catch (err) {
        return next(err);
    }
}

// PATCH /api/v1/documents/receipts/:documentId
async function updateReceipt(req, res, next) {
    try {
        const owner = pickUserId(req);
        const { documentId } = req.params;

        if (!owner) return res.status(401).json({ error: { message: "Unauthorized." } });

        const doc = await Document.findOne({ _id: documentId, owner, kind: "receipt" });
        if (!doc) return res.status(404).json({ error: { message: "Receipt not found." } });

        const normalized = normalizeExtractedPayload(req.body || {});
        doc.extracted = { ...(doc.extracted || {}), ...normalized };
        await doc.save();

        return res.json({ receipt: doc });
    } catch (err) {
        return next(err);
    }
}

// POST /api/v1/documents/receipts/:documentId/attach
async function attachReceipt(req, res, next) {
    try {
        const owner = pickUserId(req);
        const { documentId } = req.params;
        const { propertyId, logId } = req.body || {};

        if (!owner) return res.status(401).json({ error: { message: "Unauthorized." } });
        if (!propertyId || !logId) {
            return res.status(400).json({ error: { message: "propertyId and logId are required." } });
        }

        const doc = await Document.findOne({ _id: documentId, owner, kind: "receipt" });
        if (!doc) return res.status(404).json({ error: { message: "Receipt not found." } });

        if (doc.status === "attached") {
            return res.status(400).json({ error: { message: "Receipt is already attached." } });
        }

        const prop = await Property.findOne({ _id: propertyId, owner });
        if (!prop) return res.status(404).json({ error: { message: "Property not found." } });

        const log = await MaintenanceLog.findOne({ _id: logId, property: propertyId });
        if (!log) return res.status(404).json({ error: { message: "Maintenance log not found." } });

        doc.property = propertyId;
        doc.maintenanceLog = logId;
        doc.status = "attached";
        await doc.save();

        return res.json({ receipt: doc });
    } catch (err) {
        return next(err);
    }
}

// POST /api/v1/documents/receipts/:documentId/create-log
async function createLogFromReceipt(req, res, next) {
    try {
        const owner = pickUserId(req);
        const { documentId } = req.params;
        const { propertyId, overrides } = req.body || {};

        if (!owner) return res.status(401).json({ error: { message: "Unauthorized." } });
        if (!propertyId) return res.status(400).json({ error: { message: "propertyId is required." } });

        const doc = await Document.findOne({ _id: documentId, owner, kind: "receipt" });
        if (!doc) return res.status(404).json({ error: { message: "Receipt not found." } });

        const prop = await Property.findOne({ _id: propertyId, owner });
        if (!prop) return res.status(404).json({ error: { message: "Property not found." } });

        const title = String(overrides?.title || "").trim();
        const serviceDate = overrides?.serviceDate;

        if (!title) return res.status(400).json({ error: { message: "overrides.title is required." } });
        if (!serviceDate) return res.status(400).json({ error: { message: "overrides.serviceDate is required." } });

        const ex = doc.extracted || {};
        const costNum = Number(overrides?.cost ?? ex.amount ?? 0);
        const cost = Number.isFinite(costNum) ? costNum : 0;

        const log = await MaintenanceLog.create({
            owner,
            property: propertyId,
            title,
            serviceDate,
            vendor: (overrides?.vendor ?? ex.vendor ?? "") || "",
            cost,
            category: (overrides?.category ?? ex.category ?? "General") || "General",
            notes: overrides?.notes || "",
            nextDueDate: overrides?.nextDueDate || null,
            reminderEnabled: !!overrides?.reminderEnabled,
        });

        doc.property = propertyId;
        doc.maintenanceLog = log._id;
        doc.status = "attached";
        await doc.save();

        return res.status(201).json({ log, receipt: doc });
    } catch (err) {
        return next(err);
    }
}

// DELETE /api/v1/documents/receipts/:documentId
async function deleteReceipt(req, res, next) {
    try {
        const owner = pickUserId(req);
        const { documentId } = req.params;

        if (!owner) return res.status(401).json({ error: { message: "Unauthorized." } });

        const doc = await Document.findOne({ _id: documentId, owner, kind: "receipt" });
        if (!doc) return res.status(404).json({ error: { message: "Receipt not found." } });

        const filePath = resolveDiskPath(doc);
        safeUnlink(filePath);

        await doc.deleteOne();
        return res.json({ ok: true });
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    // per-log documents
    listDocuments,
    downloadDocument,
    deleteDocument,

    // receipts inbox
    uploadReceipt,
    listReceipts,
    downloadReceipt,
    rescanReceipt,
    updateReceipt,
    attachReceipt,
    createLogFromReceipt,
    deleteReceipt,
};
