async function me(req, res) {
    try {
        // requireAuth middleware should have already populated req.user
        const u = req.user || {};

        // Return a safe subset
        return res.json({
            success: true,
            data: {
                user: {
                    id: u._id || u.id || u.sub || null,
                    email: u.email || null,
                    name: u.name || u.fullName || null,
                },
            },
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: { message: err?.message || "Server error." },
        });
    }
}

module.exports = { me };
