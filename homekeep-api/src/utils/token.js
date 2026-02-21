const jwt = require("jsonwebtoken");

function signToken(userId) {
    const secret = process.env.JWT_SECRET;
    const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
    if (!secret) throw new Error("JWT_SECRET is missing in .env");

    return jwt.sign({ sub: userId }, secret, { expiresIn });
}

module.exports = { signToken };
