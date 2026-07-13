const mongoose = require("mongoose");
const { computeExamSortOrder, computeExamStageDigit } = require("../utils/examLevelOrder");

const ExamTypeSchema = new mongoose.Schema(
  {
    examType: {
      type: String,
    },
    examShortName: {
      type: String,
    },
    // Phase 3 — classify exam so certificate / rank list logic doesn't have to
    // guess from exam name strings. "State" = centralised (e.g. Preliminary VI,
    // Secondary III); "District" = conducted within each district.
    examLevel: {
      type: String,
      enum: ["State", "District"],
      default: "District",
    },
    // Phase 3 — same exam is offered in two flavours: one paper for Regular
    // students (those enrolled in affiliated study centres) and a separate
    // paper for Private students. Drives which exam a candidate is mapped to
    // based on their `status`, and which certificate template prints.
    examCategory: {
      type: String,
      enum: ["Regular", "Private"],
      default: "Regular",
    },
    // Curriculum-stage sort key (Preliminary I..VI, Secondary I..III, ...)
    // used by registration-number generation and any exam-ordered listing.
    // Auto-derived below from examType/examShortName.
    sortOrder: {
      type: Number,
      default: 0,
      index: true,
    },
    // Single-digit exam-stage code (1-9: Preliminary I-VI, Secondary I-III)
    // embedded as the 3rd character of a student's registration number.
    // Auto-derived below from examType/examShortName; null for any stage
    // outside this fixed 9-exam scheme (e.g. a future Higher Secondary).
    stageDigit: {
      type: Number,
      default: null,
    },
  },

  { timestamps: true }
);

ExamTypeSchema.pre("save", function (next) {
  if (this.isModified("examType") || this.isModified("examShortName") || this.isNew) {
    const text = this.examShortName || this.examType;
    this.sortOrder = computeExamSortOrder(text);
    this.stageDigit = computeExamStageDigit(text);
  }
  next();
});

module.exports = mongoose.model("ExamType", ExamTypeSchema);
