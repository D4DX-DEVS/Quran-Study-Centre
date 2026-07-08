const router = require("express").Router();
const { getList, updatePassword, verify, getAttendance } = require("../controllers/materialAccess");
const { protect } = require("../middleware/auth");
const { protectMaterialAccess } = require("../middleware/materialAccessAuth");
const { reqFilter } = require("../middleware/filter");

router.post("/verify", verify);
router.get("/attendance", protectMaterialAccess, getAttendance);

router.route("/").get(reqFilter, protect, getList).put(protect, updatePassword);

module.exports = router;
