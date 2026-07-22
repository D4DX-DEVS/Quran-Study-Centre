// One-time (safe to re-run) backfill: splits each existing ExamType's
// combined `examType` string ("Name: syllabus text") into the new
// `description` field, so the CMS can edit name/description separately
// instead of hand-editing the combined string.
//
// Non-destructive: only fills `description` when currently empty, and
// leaves `examType`/`examShortName` untouched (they already hold the
// correct combined/short values).
//
// Usage:
//   node scripts/backfill-examtype-description.js

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "config", ".env") });
if (!process.env.MONGO_URI) require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const ExamType = require("../models/examtype");

(async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not set. Aborting.");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to Mongo.\n");

  const types = await ExamType.find({}).select("examType examShortName description");
  const ops = [];
  for (const t of types) {
    if (t.description?.trim()) {
      console.log(`${(t.examShortName || "").padEnd(30)} already has description, skipping.`);
      continue;
    }
    const parts = (t.examType || "").split(":");
    const description = parts.slice(1).join(":").trim();
    console.log(`${(t.examShortName || "").padEnd(30)} -> description: ${description ? description.slice(0, 60) + (description.length > 60 ? "..." : "") : "(none)"}`);
    if (description) {
      ops.push({ updateOne: { filter: { _id: t._id }, update: { $set: { description } } } });
    }
  }

  if (ops.length) {
    const result = await ExamType.bulkWrite(ops, { ordered: false });
    console.log(`\nUpdated ${result.modifiedCount} exam type(s).`);
  } else {
    console.log("\nNo exam types needed a description backfill.");
  }

  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
