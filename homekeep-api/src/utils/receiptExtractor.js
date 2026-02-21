// src/utils/receiptExtractor.js
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

let _pdfParseFn = null;

/* =========================
   Helpers: strings & casing
========================= */

function safeTrim(s) {
    return typeof s === "string" ? s.trim() : "";
}

function collapseSpaces(s) {
    return safeTrim(s).replace(/\s+/g, " ");
}

function pickFirstNonEmpty(...vals) {
    for (const v of vals) {
        const t = collapseSpaces(v);
        if (t) return t;
    }
    return null;
}

function toTitleCase(str) {
    const s = collapseSpaces(str);
    if (!s) return "";

    const lowerWords = new Set(["and", "or", "the", "of", "for", "to", "a", "an", "in", "on", "at", "by"]);
    return s
        .split(" ")
        .map((w, idx) => {
            if (/^[A-Z0-9]{2,}$/.test(w)) return w; // keep acronyms

            const lower = w.toLowerCase();
            if (idx > 0 && lowerWords.has(lower)) return lower;

            return lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join(" ");
}

function filenameToLabel(originalName) {
    if (!originalName) return null;
    const base = path.basename(originalName);
    const noExt = base.replace(/\.[a-z0-9]+$/i, "");
    const cleaned = collapseSpaces(noExt.replace(/[_-]+/g, " "));
    if (!cleaned) return null;

    const alphaCount = (cleaned.match(/[a-z]/gi) || []).length;
    if (alphaCount < 3) return null;

    return toTitleCase(cleaned);
}

/* =========================
   Data normalization
========================= */

const GENERIC_VENDOR_WORDS = new Set([
    "invoice",
    "receipt",
    "statement",
    "tax invoice",
    "sales receipt",
    "purchase receipt",
    "packing slip",
    "order confirmation",
    "confirmation",
    "estimate",
    "quotation",
    "quote",
    "bill",
    "bill of sale",
    "payment",
    "paid",
    "subtotal",
    "total",
    "gst",
    "pst",
    "hst",
    "visa",
    "mastercard",
    "amex",
]);

function normalizeVendor(vendor, originalName) {
    const v = collapseSpaces(vendor);
    if (!v) return null;

    const low = v.toLowerCase();
    if (GENERIC_VENDOR_WORDS.has(low)) {
        return filenameToLabel(originalName) || null;
    }

    const letters = (v.match(/[A-Za-z]/g) || []).length;
    if (letters < 3) return filenameToLabel(originalName) || null;

    return toTitleCase(v);
}

function normalizeCategory(category) {
    const c = collapseSpaces(category);
    if (!c) return "General";

    const map = new Map([
        ["general", "General"],
        ["plumbing", "Plumbing"],
        ["electrical", "Electrical"],
        ["hvac", "HVAC"],
        ["roof", "Roof"],
        ["appliances", "Appliances"],
        ["exterior", "Exterior"],
        ["interior", "Interior"],
    ]);

    const low = c.toLowerCase();
    return map.get(low) || toTitleCase(c);
}

/* =========================
   Parsing: amount/date
========================= */

function parseAmount(text) {
    const matches = text.match(/(\$?\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})|\$?\s*\d+(?:\.\d{2}))/g);
    if (!matches || matches.length === 0) return null;

    const nums = matches
        .map((m) => m.replace(/[^0-9.]/g, ""))
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n));

    if (nums.length === 0) return null;
    return Math.max(...nums);
}

function parseDate(text) {
    const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
    if (iso) {
        const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00.000Z`);
        return Number.isNaN(d.getTime()) ? null : d;
    }

    const slash = text.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
    if (slash) {
        const mm = String(slash[1]).padStart(2, "0");
        const dd = String(slash[2]).padStart(2, "0");
        const yyyy = slash[3];
        const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
        return Number.isNaN(d.getTime()) ? null : d;
    }

    const monthName = text.match(
        /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:,)?\s+(20\d{2})\b/i
    );
    if (monthName) {
        const d = new Date(`${monthName[1]} ${monthName[2]} ${monthName[3]} UTC`);
        return Number.isNaN(d.getTime()) ? null : d;
    }

    return null;
}

/* =========================
   Guessing: vendor/category/title
========================= */

function isJunkVendorLine(line) {
    const l = collapseSpaces(line);
    if (!l) return true;
    if (l.length < 3 || l.length > 80) return true;

    const letters = (l.match(/[A-Za-z]/g) || []).length;
    const digits = (l.match(/[0-9]/g) || []).length;
    if (letters < 3 && digits > 6) return true;

    const low = l.toLowerCase();
    if (GENERIC_VENDOR_WORDS.has(low)) return true;

    if (low.includes("www.") || low.includes("http")) return true;
    if (low.includes("@")) return true;
    if (/\b(tel|phone|ph)\b/.test(low)) return true;
    if (/\b(st|street|ave|avenue|rd|road|blvd|boulevard|hwy|highway|suite|unit)\b/.test(low)) return true;

    return false;
}

function guessVendor(text) {
    const lines = (text || "")
        .split("\n")
        .map((l) => collapseSpaces(l))
        .filter(Boolean);

    const top = lines.slice(0, 12);

    const candidates = top
        .filter((l) => !isJunkVendorLine(l))
        .map((l) => ({
            line: l,
            score:
                (l.match(/[A-Za-z]/g) || []).length * 2 -
                (l.match(/[0-9]/g) || []).length -
                Math.max(0, l.length - 40),
        }))
        .sort((a, b) => b.score - a.score);

    return candidates[0]?.line || null;
}

function guessCategory(text) {
    const t = (text || "").toLowerCase();
    if (t.includes("plumb")) return "Plumbing";
    if (t.includes("electric") || t.includes("wiring") || t.includes("panel")) return "Electrical";
    if (t.includes("hvac") || t.includes("furnace") || t.includes("heat pump")) return "HVAC";
    if (t.includes("roof")) return "Roof";
    if (t.includes("dishwasher") || t.includes("fridge") || t.includes("appliance")) return "Appliances";
    if (t.includes("lock") || t.includes("door") || t.includes("window")) return "Exterior";
    return "General";
}

function makeTitleSuggestion({ vendor, category, amount }) {
    const parts = [];
    const cat = normalizeCategory(category);

    if (cat && cat !== "General") parts.push(cat);
    if (vendor) parts.push(vendor);
    if (typeof amount === "number") parts.push(`$${amount.toFixed(2)}`);

    return parts.length ? parts.join(" • ") : null;
}

/* =========================
   pdf-parse loader
========================= */

async function getPdfParse() {
    if (_pdfParseFn) return _pdfParseFn;

    try {
        const mod = require("pdf-parse");
        if (typeof mod === "function") {
            _pdfParseFn = mod;
            return _pdfParseFn;
        }
        if (mod && typeof mod.default === "function") {
            _pdfParseFn = mod.default;
            return _pdfParseFn;
        }
        if (mod && typeof mod.pdfParse === "function") {
            _pdfParseFn = mod.pdfParse;
            return _pdfParseFn;
        }
    } catch {
        // fall through
    }

    try {
        const mod = await import("pdf-parse");
        if (typeof mod === "function") {
            _pdfParseFn = mod;
            return _pdfParseFn;
        }
        if (mod && typeof mod.default === "function") {
            _pdfParseFn = mod.default;
            return _pdfParseFn;
        }
        if (mod && typeof mod.pdfParse === "function") {
            _pdfParseFn = mod.pdfParse;
            return _pdfParseFn;
        }
    } catch {
        // ignore
    }

    throw new Error("pdf-parse import failed. Run: npm i pdf-parse (inside homekeep-api).");
}

async function extractTextFromPdf(filePath) {
    const pdfParse = await getPdfParse();
    const buf = fs.readFileSync(filePath);
    const data = await pdfParse(buf);
    return safeTrim(data?.text || "");
}

function ocrPdfFirstPage(filePath) {
    return new Promise((resolve, reject) => {
        const tmpDir = path.resolve(process.cwd(), "tmp_ocr");
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

        const base = path.join(tmpDir, `receipt-${Date.now()}`);
        const pngPath = `${base}.png`;

        execFile("pdftoppm", ["-png", "-f", "1", "-singlefile", filePath, base], (err) => {
            if (err) return reject(new Error(`pdftoppm failed: ${err.message}`));
            if (!fs.existsSync(pngPath)) return reject(new Error(`OCR image output not found: ${pngPath}`));

            execFile("tesseract", [pngPath, "stdout"], (err2, stdout) => {
                try {
                    fs.unlinkSync(pngPath);
                } catch {
                    // ignore
                }
                if (err2) return reject(new Error(`tesseract failed: ${err2.message}`));
                resolve(safeTrim(stdout || ""));
            });
        });
    });
}

/**
 * Returns: { vendor, amount, date, category, titleSuggestion, textSample }
 */
async function extractReceiptFields({ filePath, mimeType, originalName }) {
    let text = "";

    if (mimeType === "application/pdf") {
        try {
            text = await extractTextFromPdf(filePath);
        } catch (err) {
            console.error("pdf-parse failed:", err.message);
            text = "";
        }

        if (!text) {
            try {
                text = await ocrPdfFirstPage(filePath);
            } catch (err) {
                console.error("OCR fallback failed:", err.message);
                text = "";
            }
        }
    } else if (mimeType && mimeType.startsWith("image/")) {
        // Optional future OCR for images
        text = "";
    }

    const rawVendor = guessVendor(text);
    const vendor = normalizeVendor(rawVendor, originalName);
    const amount = parseAmount(text);
    const date = parseDate(text);
    const category = normalizeCategory(guessCategory(text));

    const vendorForTitle = vendor || filenameToLabel(originalName) || null;
    const titleSuggestion = makeTitleSuggestion({ vendor: vendorForTitle, category, amount });

    return {
        vendor: pickFirstNonEmpty(vendor),
        amount: typeof amount === "number" ? amount : null,
        date: date || null,
        category: pickFirstNonEmpty(category) || "General",
        titleSuggestion: pickFirstNonEmpty(titleSuggestion),
        textSample: text ? text.slice(0, 500) : "",
    };
}

module.exports = { extractReceiptFields };

