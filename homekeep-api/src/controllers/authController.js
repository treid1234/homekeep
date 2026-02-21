const bcrypt = require("bcrypt");
const User = require("../models/User");
const { signToken } = require("../utils/token");

async function register(req, res) {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({
            success: false,
            error: { message: "Name, email, and password are required." }
        });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
        return res.status(409).json({
            success: false,
            error: { message: "An account with this email already exists." }
        });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email: email.toLowerCase(), passwordHash });

    const token = signToken(user._id);

    return res.status(201).json({
        success: true,
        data: {
            user: { id: user._id, name: user.name, email: user.email },
            token
        }
    });
}

async function login(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            error: { message: "Email and password are required." }
        });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
        return res.status(401).json({
            success: false,
            error: { message: "Invalid credentials." }
        });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
        return res.status(401).json({
            success: false,
            error: { message: "Invalid credentials." }
        });
    }

    const token = signToken(user._id);

    return res.json({
        success: true,
        data: {
            user: { id: user._id, name: user.name, email: user.email },
            token
        }
    });
}

module.exports = { register, login };
