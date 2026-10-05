const mongoose = require("mongoose");
const { type } = require("os");

const ExamScoreSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ExamRegistration",
  },
  exam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ExamType",
  },
  score: {
    type: Number,
  },
  grade: {
    // type: String,
    type: String,
  },
});

// One result per candidate per exam. addExamScore already checks for an
// existing mark, but that check alone lets a double-submit slip through.
// scripts/dedupe-exam-scores.js removes existing duplicates and builds this index.
ExamScoreSchema.index({ student: 1, exam: 1 }, { unique: true });

module.exports = mongoose.model("ExamScore", ExamScoreSchema);
