const router = require("express").Router();
const { getState, updateState, addDistrict, getDistricts, updateDistrict, deleteDistrict, addArea, getAreas, updateArea, deleteArea } = require("../controllers/leadership");

// middleware
const { protect } = require("../middleware/auth");
const { getS3Middleware } = require("../middleware/s3client");
const getUploadMiddleware = require("../middleware/upload");

const STATE_PHOTO_FIELDS = ["directorPhoto", "coordinator1Photo", "coordinator2Photo"];

router
  .route("/state")
  .get(getState)
  .put(protect, getUploadMiddleware("uploads/leadership", STATE_PHOTO_FIELDS), getS3Middleware(STATE_PHOTO_FIELDS), updateState);

router.route("/districts").post(protect, addDistrict).get(getDistricts).put(protect, updateDistrict).delete(protect, deleteDistrict);

router.route("/areas").post(protect, addArea).get(getAreas).put(protect, updateArea).delete(protect, deleteArea);

module.exports = router;
