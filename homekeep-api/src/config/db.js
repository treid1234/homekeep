const mongoose = require("mongoose");

async function connectDB() {
    const user = process.env.MONGO_USER;
    const passRaw = process.env.MONGO_PASS;
    const host = process.env.MONGO_HOST;
    const db = process.env.MONGO_DB || "homekeep";

    if (!user || !passRaw || !host) {
        throw new Error(
            "Missing Mongo env vars. Need MONGO_USER, MONGO_PASS, MONGO_HOST (and optional MONGO_DB)."
        );
    }

    const pass = encodeURIComponent(passRaw);
    const uri = `mongodb+srv://${user}:${pass}@${host}/${db}?retryWrites=true&w=majority`;

    console.log(`Mongo connect → user=${user} host=${host} db=${db}`);

    await mongoose.connect(uri);
    console.log("Connected to MongoDB");
}

module.exports = { connectDB };

