// One-time (safe to re-run) backfill: (re)computes ExamType.sortOrder and
// ExamType.stageDigit for every existing exam type from its
// examType/examShortName text.
//
// Usage:
//   node scripts/backfill-examtype-sortorder.js

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "config", ".env") });
if (!process.env.MONGO_URI) require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const ExamType = require("../models/examtype");
const { computeExamSortOrder, computeExamStageDigit } = require("../utils/examLevelOrder");

(async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not set. Aborting.");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to Mongo.\n");

  const types = await ExamType.find({}).select("examType examShortName sortOrder stageDigit");
  const ops = [];
  for (const t of types) {
    const text = t.examShortName || t.examType;
    const sortOrder = computeExamSortOrder(text);
    const stageDigit = computeExamStageDigit(text);
    console.log(
      `${(text || "").slice(0, 60).padEnd(60)} -> sortOrder ${sortOrder}, stageDigit ${stageDigit}`
    );
    if (sortOrder !== t.sortOrder || stageDigit !== t.stageDigit) {
      ops.push({ updateOne: { filter: { _id: t._id }, update: { $set: { sortOrder, stageDigit } } } });
    }
  }

  if (ops.length) {
    const result = await ExamType.bulkWrite(ops, { ordered: false });
    console.log(`\nUpdated ${result.modifiedCount} exam type(s).`);
  } else {
    console.log("\nAll exam types already have the correct sortOrder/stageDigit.");
  }

  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
