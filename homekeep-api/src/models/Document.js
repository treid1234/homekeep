const mongoose = require("mongoose");

const DocumentSchema = new mongoose.Schema(
    {
        owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

        // MUST be optional for “unattached receipt” flow
        property: { type: mongoose.Schema.Types.ObjectId, ref: "Property", default: null, index: true },
        maintenanceLog: { type: mongoose.Schema.Types.ObjectId, ref: "MaintenanceLog", default: null, index: true },

        originalName: { type: String, required: true },
        storedName: { type: String, required: true },
        mimeType: { type: String, default: "application/octet-stream" },
        size: { type: Number, default: 0 },

        extracted: {
            vendor: { type: String, default: null },
            amount: { type: Number, default: null },
            date: { type: Date, default: null },
            category: { type: String, default: null },
            titleSuggestion: { type: String, default: null },
        },

        kind: { type: String, enum: ["receipt", "attachment"], default: "attachment", index: true },
        status: { type: String, enum: ["unattached", "attached"], default: "attached", index: true },
    },
    { timestamps: true }
);

// Helpful compound indexes
DocumentSchema.index({ owner: 1, kind: 1, status: 1, createdAt: -1 });
DocumentSchema.index({ owner: 1, property: 1, maintenanceLog: 1, createdAt: -1 });

module.exports = mongoose.model("Document", DocumentSchema);


