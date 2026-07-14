const router = require("express").Router();
const { getLatestVideos } = require("../controllers/youtubeVideos");

router.get("/", getLatestVideos);

module.exports = router;
