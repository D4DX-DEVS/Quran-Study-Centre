// One-time (safe to re-run) backfill: recomputes ExamScore.grade for every
// existing exam score using the current calculateGrade() thresholds
// (45-50 A+, 40-44 A, 35-39 B+, 30-34 B, 25-29 C+, 0-24 C).
//
// Usage:
//   node scripts/recompute-exam-score-grades.js

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "config", ".env") });
if (!process.env.MONGO_URI) require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const ExamScore = require("../models/examScore");

const calculateGrade = (score) => {
  if (score >= 45 && score <= 50) return "A+";
  if (score >= 40 && score <= 44) return "A";
  if (score >= 35 && score <= 39) return "B+";
  if (score >= 30 && score <= 34) return "B";
  if (score >= 25 && score <= 29) return "C+";
  if (score >= 0 && score <= 24) return "C";
  return "Grade Not Published";
};

(async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not set. Aborting.");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to Mongo.\n");

  const scores = await ExamScore.find({}).select("score grade");
  const ops = [];
  for (const s of scores) {
    const newGrade = calculateGrade(s.score);
    if (newGrade !== s.grade) {
      ops.push({
        updateOne: {
          filter: { _id: s._id },
          update: { grade: newGrade },
        },
      });
    }
  }

  if (ops.length === 0) {
    console.log("All exam score grades already correct. Nothing to update.");
  } else {
    const result = await ExamScore.bulkWrite(ops);
    console.log(`Updated ${result.modifiedCount} of ${scores.length} exam score records.`);
  }

  await mongoose.disconnect();
  process.exit(0);
})();
