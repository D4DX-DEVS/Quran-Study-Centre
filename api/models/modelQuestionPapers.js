const mongoose = require("mongoose");
const { computeExamStageDigit } = require("../utils/examLevelOrder");

// The two kinds of file a category can hold.
const MODEL_PAPER_KINDS = ["Model Question Paper", "Answer Key"];

// Kept apart from the Question Bank (oldQuestionPaper): nothing uploaded there
// is ever treated as a model paper or answer key, and vice versa.
const ModelQuestionPaperSchema = new mongoose.Schema(
  {
    // One of the nine exam stages, by its exam name: "Preliminary I" ..
    // "Preliminary VI", "Secondary I" .. "Secondary III". Validated with the
    // same stage parser the exam types and registration numbers use.
    category: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (value) => computeExamStageDigit(value) !== null,
        message: "Category must be one of Preliminary I-VI or Secondary I-III",
      },
    },
    kind: {
      type: String,
      required: true,
      enum: MODEL_PAPER_KINDS,
    },
    title: {
      type: String,
      trim: true,
    },
    // Object-storage key of the uploaded PDF (same upload pipeline as the Question Bank).
    attachment: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

ModelQuestionPaperSchema.index({ category: 1, kind: 1 });

module.exports = mongoose.model("modelQuestionPaper", ModelQuestionPaperSchema);
module.exports.MODEL_PAPER_KINDS = MODEL_PAPER_KINDS;
