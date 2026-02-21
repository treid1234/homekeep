const mongoose = require("mongoose");

const propertySchema = new mongoose.Schema(
    {
        owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

        nickname: { type: String, trim: true, required: true },
        addressLine1: { type: String, trim: true, required: true },
        addressLine2: { type: String, trim: true, default: "" },
        city: { type: String, trim: true, required: true },
        province: { type: String, trim: true, required: true },
        postalCode: { type: String, trim: true, default: "" },

        purchaseDate: { type: Date, default: null },
        notes: { type: String, trim: true, default: "" }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Property", propertySchema);
