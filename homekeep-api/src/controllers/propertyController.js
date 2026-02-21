const Property = require("../models/Property");

function safeString(v) {
    return typeof v === "string" ? v.trim() : "";
}

/**
 * GET /api/v1/properties
 */
async function listProperties(req, res) {
    try {
        const ownerId = req.user._id || req.user.id;

        const properties = await Property.find({ owner: ownerId })
            .sort({ createdAt: -1 })
            .lean();

        return res.json({
            success: true,
            data: { properties },
        });
    } catch (err) {
        console.error("listProperties error:", err);
        return res.status(500).json({
            success: false,
            error: { message: "Server error." },
        });
    }
}

/**
 * GET /api/v1/properties/:id
 */
async function getProperty(req, res) {
    try {
        const ownerId = req.user._id || req.user.id;
        const { id } = req.params;

        const property = await Property.findOne({
            _id: id,
            owner: ownerId,
        }).lean();

        if (!property) {
            return res.status(404).json({
                success: false,
                error: { message: "Property not found." },
            });
        }

        return res.json({
            success: true,
            data: { property },
        });
    } catch (err) {
        console.error("getProperty error:", err);
        return res.status(500).json({
            success: false,
            error: { message: "Server error." },
        });
    }
}

/**
 * POST /api/v1/properties
 */
async function createProperty(req, res) {
    try {
        const ownerId = req.user._id || req.user.id;

        const nickname = safeString(req.body.nickname);
        const addressLine1 =
            safeString(req.body.addressLine1) || safeString(req.body.address) || "";
        const addressLine2 = safeString(req.body.addressLine2) || "";
        const city = safeString(req.body.city);
        const province = safeString(req.body.province) || "BC";
        const postalCode = safeString(req.body.postalCode) || "";

        if (!nickname || !addressLine1 || !city || !province) {
            return res.status(400).json({
                success: false,
                error: { message: "Nickname, address, city, and province are required." },
            });
        }

        const property = await Property.create({
            owner: ownerId,
            nickname,
            addressLine1,
            addressLine2,
            city,
            province,
            postalCode,
        });

        return res.status(201).json({
            success: true,
            data: { property },
        });
    } catch (err) {
        console.error("createProperty error:", err);
        return res.status(500).json({
            success: false,
            error: { message: "Server error." },
        });
    }
}

module.exports = {
    listProperties,
    getProperty,
    createProperty,
};

