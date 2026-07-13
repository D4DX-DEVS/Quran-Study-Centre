const router = require("express").Router();
const { getFilterOptions, getStickerList, getStickerExportList, getStickerDetail } = require("../controllers/examCenterStickers");
const { protect } = require("../middleware/auth");
const { reqFilter } = require("../middleware/filter");

router.get("/select", reqFilter, protect, getFilterOptions);
router.get("/list", reqFilter, protect, getStickerList);
router.get("/export-list", reqFilter, protect, getStickerExportList);
router.get("/:examCenterId", reqFilter, protect, getStickerDetail);

module.exports = router;
