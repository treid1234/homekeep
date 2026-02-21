const mongoose = require("mongoose");

async function connectDB() {
  // 🔎 Fingerprint + env presence check (TEMP — keep until Render works)
  console.log("DB.JS VERSION: 2026-02-21 / MONGO_URI first enabled");
  console.log("ENV CHECK:", {
    hasMongoUri: Boolean(process.env.MONGO_URI),
    hasMongoUser: Boolean(process.env.MONGO_USER),
    hasMongoPass: Boolean(process.env.MONGO_PASS),
    hasMongoHost: Boolean(process.env.MONGO_HOST),
    mongoDb: process.env.MONGO_DB || "homekeep",
  });

  // ✅ Prefer single URI for production (Render)
  const uriFromEnv = process.env.MONGO_URI;

  if (uriFromEnv) {
    console.log("Mongo connect → using MONGO_URI");
    await mongoose.connect(uriFromEnv);
    console.log("Connected to MongoDB");
    return;
  }

  // ✅ Fallback for split vars (local/dev)
  const user = process.env.MONGO_USER;
  const passRaw = process.env.MONGO_PASS;
  const host = process.env.MONGO_HOST;
  const db = process.env.MONGO_DB || "homekeep";

  if (!user || !passRaw || !host) {
    throw new Error(
      "Missing Mongo env vars. Set MONGO_URI (recommended) OR set MONGO_USER, MONGO_PASS, MONGO_HOST (and optional MONGO_DB)."
    );
  }

  const pass = encodeURIComponent(passRaw);
  const uri = `mongodb+srv://${user}:${pass}@${host}/${db}?retryWrites=true&w=majority`;

  console.log(`Mongo connect → user=${user} host=${host} db=${db}`);
  await mongoose.connect(uri);
  console.log("Connected to MongoDB");
}

module.exports = { connectDB };
