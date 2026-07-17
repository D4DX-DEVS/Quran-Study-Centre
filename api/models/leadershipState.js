const mongoose = require("mongoose");

const LeaderSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    position: { type: String, default: "" },
    photo: { type: String, default: "" },
  },
  { _id: false }
);

const LeadershipStateSchema = new mongoose.Schema(
  {
    director: { type: LeaderSchema, default: () => ({}) },
    coordinator1: { type: LeaderSchema, default: () => ({}) },
    coordinator2: { type: LeaderSchema, default: () => ({}) },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LeadershipState", LeadershipStateSchema);
