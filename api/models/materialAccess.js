const mongoose = require("mongoose");

const MaterialAccessSchema = new mongoose.Schema(
  {
    area: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Area",
      required: true,
      unique: true,
    },
    district: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "District",
      required: true,
    },
    password: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
  },
  { timestamps: true }
);

// Format: <district initial><area initial><2 random digits>, e.g. Malappuram +
// Kondotty -> "MK47". Non-alpha names fall back to "X", same convention as the
// DISTRICT_PREFIXES fallback in models/centerRegistration.js.
const initialOf = (name) => {
  const alpha = String(name || "").trim().toUpperCase().replace(/[^A-Z]/g, "");
  return alpha.slice(0, 1) || "X";
};

MaterialAccessSchema.statics.generatePassword = function (districtName, areaName) {
  const prefix = `${initialOf(districtName)}${initialOf(areaName)}`;
  const digits = String(Math.floor(Math.random() * 100)).padStart(2, "0");
  return `${prefix}${digits}`;
};

module.exports = mongoose.model("MaterialAccess", MaterialAccessSchema);
