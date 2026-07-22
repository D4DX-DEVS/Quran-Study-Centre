// Read-only audit: check every ExamRegistration's stored regno against the
// area/centre/exam-stage it SHOULD encode (per registrationNumber.js rules).
// No writes. Usage: node scripts/verify-registration-numbers.js

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "config", ".env") });
if (!process.env.MONGO_URI) require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const ExamRegistration = require("../models/examRegistration");
require("../models/district");
const { resolveExamCenterName } = require("../utils/studentSort");
const { _internal } = require("../controllers/registrationNumber");
const { buildPrefix } = _internal;

(async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not set. Aborting.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to Mongo.\n");

  const students = await ExamRegistration.find({ regno: { $exists: true, $ne: null } })
    .populate("area", "area")
    .populate("centerRegistration", "nameOfCenter")
    .populate("assignedExamCenter", "nameOfCenter")
    .populate("nameOfExamAppearingNow", "stageDigit examType examShortName")
    .select("regno area centerRegistration assignedExamCenter nameOfExamAppearingNow")
    .lean();

  let mismatches = [];
  let noRegnoPattern = [];

  for (const s of students) {
    const regno = s.regno;
    if (!/^[A-Za-z]{2}\d{4,}$/.test(regno)) {
      noRegnoPattern.push({ _id: s._id, regno });
      continue;
    }

    const areaName = s.area?.area || "";
    const centerName = resolveExamCenterName(s);
    const expectedPrefix = buildPrefix(areaName, centerName);
    const expectedDigit = s.nameOfExamAppearingNow?.stageDigit;

    const actualPrefix = regno.slice(0, 2).toUpperCase();
    const actualDigit = Number(regno.slice(2, 3));

    const prefixOk = actualPrefix === expectedPrefix;
    const digitOk = expectedDigit == null ? true : actualDigit === expectedDigit;

    if (!prefixOk || !digitOk) {
      mismatches.push({
        _id: s._id,
        regno,
        areaName,
        centerName,
        examLabel: s.nameOfExamAppearingNow?.examShortName || s.nameOfExamAppearingNow?.examType || "(none)",
        expectedPrefix,
        actualPrefix,
        expectedDigit,
        actualDigit,
        prefixOk,
        digitOk,
      });
    }
  }

  console.log(`Checked ${students.length} student(s) with a regno.`);
  console.log(`Malformed regno (doesn't match AA#### pattern): ${noRegnoPattern.length}`);
  console.log(`Mismatched (area/centre/exam-stage doesn't match regno): ${mismatches.length}\n`);

  if (noRegnoPattern.length) {
    console.log("--- Malformed ---");
    noRegnoPattern.slice(0, 50).forEach((m) => console.log(`  ${m._id}: "${m.regno}"`));
    if (noRegnoPattern.length > 50) console.log(`  ...and ${noRegnoPattern.length - 50} more`);
    console.log();
  }

  if (mismatches.length) {
    console.log("--- Mismatched ---");
    mismatches.slice(0, 100).forEach((m) => {
      console.log(
        `  ${m._id}: regno="${m.regno}" area="${m.areaName}" centre="${m.centerName}" exam="${m.examLabel}"` +
          ` | expected prefix=${m.expectedPrefix} got=${m.actualPrefix} (${m.prefixOk ? "ok" : "BAD"})` +
          ` | expected digit=${m.expectedDigit} got=${m.actualDigit} (${m.digitOk ? "ok" : "BAD"})`
      );
    });
    if (mismatches.length > 100) console.log(`  ...and ${mismatches.length - 100} more`);
  }

  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
