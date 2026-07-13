const router = require("express").Router();
const { generate } = require("../controllers/registrationNumber");
const { protect } = require("../middleware/auth");

router.post("/generate", protect, generate);

module.exports = router;
