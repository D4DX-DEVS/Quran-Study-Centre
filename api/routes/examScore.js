const router = require("express").Router();
// controllers
const { addExamScore, updateExamScore, deleteExamScore, getExamScore, select, updateGradesForExamScores, getAreasByDistrict, getMarkEntryReport } = require("../controllers/examScore");
const { getRankList } = require("../controllers/rankList");
// middleware
const { protect, authorize } = require("../middleware/auth");
const { reqFilter } = require("../middleware/filter");

// Results are only for Admin (all districts) and District Admin (own district,
// enforced in the controller). No other role uses these endpoints.
const resultRoles = authorize("Admin", "District Admin");

router.route("/").post(protect, resultRoles, addExamScore).get(reqFilter, protect, resultRoles, getExamScore).put(protect, resultRoles, updateExamScore).delete(protect, resultRoles, deleteExamScore);

router.route("/select").get(reqFilter, protect, resultRoles, select);
router.route("/areas-by-district").get(protect, resultRoles, getAreasByDistrict);
router.route("/mark-entry-report").get(protect, resultRoles, getMarkEntryReport);
// Recomputes every grade — Admin only (scripts/recompute-exam-score-grades.js does the same offline).
router.put("/update", protect, authorize("Admin"), updateGradesForExamScores);

// Phase 2.6 — rank list (public read-only).
router.get("/ranklist", getRankList);

module.exports = router;
