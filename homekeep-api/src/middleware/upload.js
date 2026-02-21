const path = require("path");
const fs = require("fs");
const multer = require("multer");

// Where uploads go (default: <project>/uploads)
const UPLOAD_DIR = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.resolve(process.cwd(), "uploads");

// Ensure the upload folder exists (prevents random 500s)
function ensureUploadDir() {
    if (!fs.existsSync(UPLOAD_DIR)) {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
}

ensureUploadDir();

function safeBaseName(name = "file") {
    // Avoid weird characters; keep it filesystem-safe
    return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        try {
            ensureUploadDir();
            cb(null, UPLOAD_DIR);
        } catch (err) {
            cb(err);
        }
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || "");
        const base = safeBaseName(path.basename(file.originalname || "upload", ext));
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${base}-${unique}${ext}`);
    },
});

const upload = multer({
    storage,
    limits: {
        fileSize: 15 * 1024 * 1024, // 15MB
    },
});

module.exports = upload;
module.exports.UPLOAD_DIR = UPLOAD_DIR;

