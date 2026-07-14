const mongoose = require("mongoose");

const AboutUsSchema = new mongoose.Schema(
  {
    title: {
      type: String,
    },
    description: {
      type: String,
    },
    image: {
      type: String,
    },
    landingTitle: {
      type: String,
    },
    landingDescription: {
      type: String,
    },
    landingMainbanner: {
      type: String,
    },
    landingStoryImage: {
      type: String,
    },
    welcomeEyebrow: {
      type: String,
      default: "Welcome to",
    },
    welcomeTitleLine1: {
      type: String,
      default: "Quran Study",
    },
    welcomeTitleHighlight: {
      type: String,
      default: "Centre Kerala",
    },
    welcomeDescription: {
      type: String,
      default:
        "A dedicated platform for learning, understanding and living by the Quran. Join our mission to spread Quranic knowledge and build a community of learners.",
    },
    welcomeImage: {
      type: String,
    },
    email: {
      type: String,
    },
    mobile: {
      type: String,
    },
    footerText: {
      type: String,
    },
  },

  { timestamps: true }
);

module.exports = mongoose.model("AboutUs", AboutUsSchema);
