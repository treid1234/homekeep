const mongoose = require("mongoose");

const maintenanceLogSchema = new mongoose.Schema(
    {
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        property: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Property",
            required: true,
            index: true,
        },

        title: { type: String, trim: true, required: true },

        category: {
            type: String,
            trim: true,
            default: "General", // Plumbing, Electrical, HVAC, Roof, Appliances, etc.
        },

        vendor: { type: String, trim: true, default: "" },
        serviceDate: { type: Date, default: null },
        cost: { type: Number, default: null },

        notes: { type: String, trim: true, default: "" },

        nextDueDate: { type: Date, default: null },
        reminderEnabled: { type: Boolean, default: true },
    },
    { timestamps: true }
);

module.exports = mongoose.model("MaintenanceLog", maintenanceLogSchema);

