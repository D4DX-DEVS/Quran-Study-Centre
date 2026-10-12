const router = require("express").Router();
const { createAboutUs, getAboutUs, updateAboutUs, deleteAboutUs, select } = require("../controllers/aboutUs");

// middleware
const { protect, authorize } = require("../middleware/auth");
const { reqFilter } = require("../middleware/filter");
const { getS3Middleware } = require("../middleware/s3client");
const getUploadMiddleware = require("../middleware/upload");

// Homepage story gallery: several images in one request, validated server-side
// (same rules the admin screen states: JPG/JPEG/PNG/GIF/WEBP, up to 5MB each).
const STORY_IMAGE_FIELD = {
  name: "landingStoryImageFiles",
  maxCount: 12,
  imageOnly: true,
  allowedExtensions: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
  maxFileSize: 5 * 1024 * 1024,
};

const uploadFields = ["image", "landingMainbanner", "landingStoryImage", "welcomeImage", STORY_IMAGE_FIELD];
const singleImageFields = ["image", "landingMainbanner", "landingStoryImage", "welcomeImage"];

router
  .route("/")
  .post(protect, getUploadMiddleware("uploads/about", uploadFields), getS3Middleware(singleImageFields), getS3Middleware([STORY_IMAGE_FIELD.name], false), createAboutUs)
  .get(reqFilter, getAboutUs)
  .put(protect, getUploadMiddleware("uploads/about", uploadFields), getS3Middleware(singleImageFields), getS3Middleware([STORY_IMAGE_FIELD.name], false), updateAboutUs)
  .delete(protect, deleteAboutUs);

router.get("/select", reqFilter, protect, select);

module.exports = router;
