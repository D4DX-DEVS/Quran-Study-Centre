const router = require("express").Router();
// controllers
const { addFloatingSettings, select, updateFloatingSettings, deleteFloatingSettings, getFloatingSettings } = require("../controllers/floatingMenuSettings");
// middleware
const { protect, authorize } = require("../middleware/auth");
const { reqFilter } = require("../middleware/filter");

// GET is public (the landing page reads it). Writes include the "Result" publication
// switch, so only the state Admin may change them.
router.route("/").post(protect, authorize("Admin"), addFloatingSettings).get(reqFilter, getFloatingSettings).put(protect, authorize("Admin"), updateFloatingSettings).delete(protect, authorize("Admin"), deleteFloatingSettings);

router.route("/select").get(reqFilter, protect, select);

module.exports = router;
