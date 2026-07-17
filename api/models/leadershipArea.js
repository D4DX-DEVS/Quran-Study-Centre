const mongoose = require("mongoose");

const CoordinatorSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    phone: {
      type: String,
      default: "",
      validate: {
        validator: function (value) {
          return !value || /^[0-9]{10}$/.test(value);
        },
        message: "Phone number must be 10 digits",
      },
    },
  },
  { _id: false }
);

const LeadershipAreaSchema = new mongoose.Schema(
  {
    areaName: { type: String, required: true, trim: true },
    coordinator1: { type: CoordinatorSchema, default: () => ({}) },
    coordinator2: { type: CoordinatorSchema, default: () => ({}) },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LeadershipArea", LeadershipAreaSchema);
