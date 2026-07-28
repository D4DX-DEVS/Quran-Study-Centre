const mongoose = require("mongoose");

const HallTicketSchema = new mongoose.Schema(
  {
    nameOfApplicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamRegistration",
      required: true,
      // One ticket row per student. Every write to this collection is an
      // upsert keyed on this field, and without a unique index two concurrent
      // upserts (e.g. the post-registration hook and an admin regenerating at
      // the same moment) can both insert, leaving the student with duplicate
      // rows in the Hall Ticket list. Also makes the per-student lookups and
      // the sweep's $lookup an index hit instead of a full scan.
      unique: true,
      index: true,
    },
    pdfUrl: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "generated", "failed"],
      default: "pending",
    },
    error: {
      type: String,
      default: null,
    },
    generatedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("HallTicket", HallTicketSchema);
