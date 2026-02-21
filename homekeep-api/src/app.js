const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const propertyRoutes = require("./routes/propertyRoutes");
const maintenanceRoutes = require("./routes/maintenanceRoutes");
const documentRoutes = require("./routes/documentRoutes");
const receiptRoutes = require("./routes/receiptRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const reminderRoutes = require("./routes/reminderRoutes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (req, res) => res.json({ ok: true }));

// API routes
app.use("/api/v1", authRoutes);
app.use("/api/v1", userRoutes);
app.use("/api/v1", propertyRoutes);
app.use("/api/v1", maintenanceRoutes);
app.use("/api/v1", documentRoutes);
app.use("/api/v1", receiptRoutes);
app.use("/api/v1", dashboardRoutes);
app.use("/api/v1", reminderRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: { message: "Route not found." },
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error("Unhandled error:", err);
    res.status(500).json({
        success: false,
        error: { message: "Server error." },
    });
});

module.exports = app;






