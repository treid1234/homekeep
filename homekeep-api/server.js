require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

// ---------- Robust connectDB resolver ----------
function loadConnectDB() {
    const candidates = [
        "./src/db/connectDB",
        "./src/db/db",
        "./src/db/index",
        "./src/config/connectDB",
        "./src/config/db",
        "./src/config/database",
        "./src/database/connectDB",
        "./src/database/db",
        "./src/database/index",
        "./src/utils/connectDB",
    ];

    for (const rel of candidates) {
        try {
            const abs = path.resolve(__dirname, rel);
            // eslint-disable-next-line global-require, import/no-dynamic-require
            const mod = require(abs);

            if (typeof mod === "function") return mod; // module.exports = connectDB
            if (typeof mod.connectDB === "function") return mod.connectDB; // module.exports = { connectDB }
        } catch (e) {
            // keep trying
        }
    }

    const msg =
        "Missing connectDB module.\n" +
        "Tried:\n" +
        candidates.map((c) => `  - ${c}.js`).join("\n") +
        "\n\nFix: point server.js at the file that exports connectDB.\n" +
        "Run:\n" +
        "  find ./src -type f \\( -iname '*connect*db*.js' -o -iname '*db*.js' \\)\n";

    throw new Error(msg);
}

const connectDB = loadConnectDB();

// ---------- Route files ----------
const authRoutes = require("./src/routes/authRoutes");
const propertyRoutes = require("./src/routes/propertyRoutes");
const maintenanceRoutes = require("./src/routes/maintenanceRoutes");
const reminderRoutes = require("./src/routes/reminderRoutes");
const documentRoutes = require("./src/routes/documentRoutes");
const dashboardRoutes = require("./src/routes/dashboardRoutes");
const meRoutes = require("./src/routes/meRoutes"); // ✅ NEW

const app = express();

// middleware
app.use(cors({ origin: "*", credentials: false }));
app.use(express.json());

// ---- HEALTH (both) ----
app.get("/health", (req, res) => res.json({ ok: true }));
app.get("/api/v1/health", (req, res) => res.json({ ok: true }));

app.get("/api/v1", (req, res) => {
    res.json({ ok: true, name: "HomeKeep API", version: "v1" });
});

// ---- API ROUTES ----
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1", meRoutes); // ✅ NEW: /api/v1/me
app.use("/api/v1/properties", propertyRoutes);

// these routers define routes that already start with /properties/... or /reminders/... etc
app.use("/api/v1", maintenanceRoutes);
app.use("/api/v1", reminderRoutes);
app.use("/api/v1", documentRoutes);

app.use("/api/v1/dashboard", dashboardRoutes);

// ---- 404 handler ----
app.use((req, res) => {
    res.status(404).json({ success: false, error: { message: "Route not found." } });
});

// boot
(async () => {
    try {
        await connectDB();
        const PORT = process.env.PORT || 5050;
        app.listen(PORT, () => console.log(`API listening on ${PORT}`));
    } catch (err) {
        console.error("Failed to start server:", err.message);
        process.exit(1);
    }
})();
