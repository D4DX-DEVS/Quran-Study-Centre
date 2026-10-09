const router = require("express").Router();
// controllers
const { addExamRegistration, select, updateExamRegistration, deleteExamRegistration, getExamRegistration, getExamResult, getPublicResult, downloadCertificate, getOutsideExamCenterByDistrict, getAttendanceSheet, getExamRegistrationList, getOutsideExamAttendanceSheet, getDistrictsExcludingOwn, getRegisteredStudentsList, getConsolidationReport, getExamCentreConsolidation } = require("../controllers/examRegistration");
const { selectAndExport, deduplicate } = require("../controllers/formexport");
// middleware
const { protect, authorize, optionalProtect, denyRoles } = require("../middleware/auth");
const { reqFilter } = require("../middleware/filter");
const { rateLimit } = require("../middleware/rateLimit");

// Public result endpoints: throttled per IP so numbers cannot be guessed quickly.
const resultLookupLimit = rateLimit({ windowMs: 60 * 1000, max: 40 });
const certificateLimit = rateLimit({ windowMs: 60 * 1000, max: 20 });
// Staff-only registration data: signed-in, and not the low-privilege Student login.
const staffOnly = [protect, denyRoles("Student")];

router.route("/").post(addExamRegistration).get(reqFilter, protect, getExamRegistration).put(updateExamRegistration).delete(...staffOnly, deleteExamRegistration);

router.route("/select").get(reqFilter, ...staffOnly, select);
router.get("/export", reqFilter, protect, selectAndExport);
// Permanently deletes duplicate registrations — Admin only.
router.get("/deduplicate", protect, authorize("Admin"), deduplicate);
router.get("/result", resultLookupLimit, getExamResult);
// Public Result page: published results only, minimal fields, signed certificate ref.
router.get("/student-result", resultLookupLimit, getPublicResult);
// Certificate PDF: signed ref (public), or signed-in Admin / District Admin / Student.
router.get("/download-state-certificate", certificateLimit, optionalProtect, downloadCertificate);
router.route("/district-center").get(reqFilter, getOutsideExamCenterByDistrict);
router.get("/attendance-sheet", reqFilter, protect, getAttendanceSheet);
router.get("/registered-list", reqFilter, protect, getRegisteredStudentsList);
router.get("/consolidation-report", reqFilter, protect, getConsolidationReport);
router.get("/centre-consolidation-report", reqFilter, protect, getExamCentreConsolidation);
router.get("/list", reqFilter, ...staffOnly, getExamRegistrationList);
router.get("/outside-center-list", reqFilter, ...staffOnly, getOutsideExamAttendanceSheet);
router.get("/districts-excluding-own", getDistrictsExcludingOwn);

module.exports = router;
