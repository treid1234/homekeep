const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function requireAuth(req, res, next) {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

    if (!token) {
        return res.status(401).json({ success: false, error: { message: "Missing token." } });
    }

    try {
        const secret = process.env.JWT_SECRET;
        const payload = jwt.verify(token, secret);

        const user = await User.findById(payload.sub).select("_id name email");
        if (!user) {
            return res.status(401).json({ success: false, error: { message: "Invalid token." } });
        }

        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, error: { message: "Invalid token." } });
    }
}

module.exports = { requireAuth };
