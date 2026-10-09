const router = require("express").Router();
// controllers
const { addResultAndCertificates, select, updateResultAndCertificates, deleteResultAndCertificates, getResultAndCertificates } = require("../controllers/resultAndCertificates");
// middleware
const { protect, authorize } = require("../middleware/auth");
const { reqFilter } = require("../middleware/filter");

// Legacy results store — nothing public reads it, so keep it staff-only.
const staff = [protect, authorize("Admin", "District Admin")];

router.route("/").post(...staff, addResultAndCertificates).get(reqFilter, ...staff, getResultAndCertificates).put(...staff, updateResultAndCertificates).delete(...staff, deleteResultAndCertificates);

router.route("/select").get(reqFilter, ...staff, select);

module.exports = router;
