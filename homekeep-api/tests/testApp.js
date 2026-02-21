const express = require("express");
const cors = require("cors");
const propertyRoutes = require("../src/routes/propertyRoutes");

const authRoutes = require("../src/routes/authRoutes");
const meRoutes = require("../src/routes/meRoutes");

function makeTestApp() {
    const app = express();

    app.use(cors({ origin: "*", credentials: false }));
    app.use(express.json());
    app.use("/api/v1/properties", propertyRoutes);

    app.get("/health", (req, res) => res.json({ ok: true }));

    app.use("/api/v1/auth", authRoutes);
    app.use("/api/v1", meRoutes);

    return app;
}

module.exports = makeTestApp;