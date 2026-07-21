// Read-only: simulate the exact generator logic (district -> area -> centre ->
// exam -> gender -> mode -> _id sort, seq counted per prefix) and diff the
// computed regno against what's actually stored, for every student. This
// catches ordering/seq issues that a prefix+digit-only check would miss.
// No writes. Usage: node scripts/verify-full-sequence.js

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "config", ".env") });
if (!process.env.MONGO_URI) require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const ExamRegistration = require("../models/examRegistration");
require("../models/district");
require("../models/area");
require("../models/centerRegistration");
require("../models/examtype");

const { resolveExamCenterName, examSortOrder, compareBySpec } = require("../utils/studentSort");
const { _internal } = require("../controllers/registrationNumber");
const { buildPrefix } = _internal;

const SEQUENCE_DIGITS = 3;

(async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not set. Aborting.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to Mongo.\n");

  const students = await ExamRegistration.find({})
    .populate("district", "district")
    .populate("area", "area")
    .populate("centerRegistration", "nameOfCenter")
    .populate("assignedExamCenter", "nameOfCenter")
    .populate("nameOfExamAppearingNow", "sortOrder stageDigit examType examShortName")
    .select("district area centerRegistration assignedExamCenter nameOfExamAppearingNow gender status regno nameOfApplicant")
    .lean();

  const normalized = students.map((s) => ({
    _id: s._id,
    regno: s.regno,
    nameOfApplicant: s.nameOfApplicant,
    districtName: s.district?.district || "",
    areaName: s.area?.area || "",
    centerName: resolveExamCenterName(s),
    examSortOrder: examSortOrder(s.nameOfExamAppearingNow),
    examStageDigit: s.nameOfExamAppearingNow?.stageDigit ?? null,
    examTypeLabel: s.nameOfExamAppearingNow?.examShortName || s.nameOfExamAppearingNow?.examType || "",
    gender: s.gender,
    status: s.status,
  }));

  normalized.sort(compareBySpec);

  const prefixCounter = {};
  const mismatches = [];
  const missingRegno = [];

  for (const s of normalized) {
    const prefix = buildPrefix(s.areaName, s.centerName);
    prefixCounter[prefix] = (prefixCounter[prefix] || 0) + 1;
    const seq = prefixCounter[prefix];

    let digit = s.examStageDigit;
    if (digit == null) digit = 0;

    const expectedRegno = `${prefix}${digit}${String(seq).padStart(SEQUENCE_DIGITS, "0")}`;

    if (!s.regno) {
      missingRegno.push({ _id: s._id, name: s.nameOfApplicant, expectedRegno });
      continue;
    }

    if (s.regno !== expectedRegno) {
      mismatches.push({
        _id: s._id,
        name: s.nameOfApplicant,
        actual: s.regno,
        expected: expectedRegno,
        districtName: s.districtName,
        areaName: s.areaName,
        centerName: s.centerName,
        examTypeLabel: s.examTypeLabel,
        gender: s.gender,
        status: s.status,
      });
    }
  }

  console.log(`Simulated full generator over ${normalized.length} student(s).`);
  console.log(`Missing regno: ${missingRegno.length}`);
  console.log(`Sequence/order mismatches (stored regno != what full sort+seq would produce): ${mismatches.length}\n`);

  if (missingRegno.length) {
    console.log("--- Missing regno ---");
    missingRegno.slice(0, 30).forEach((m) => console.log(`  ${m._id} (${m.name}): would be ${m.expectedRegno}`));
    if (missingRegno.length > 30) console.log(`  ...and ${missingRegno.length - 30} more`);
    console.log();
  }

  if (mismatches.length) {
    console.log("--- Mismatches ---");
    mismatches.slice(0, 100).forEach((m) => {
      console.log(
        `  ${m._id} (${m.name}): stored=${m.actual} expected=${m.expected}` +
          ` | district=${m.districtName} area=${m.areaName} centre=${m.centerName} exam=${m.examTypeLabel} gender=${m.gender} mode=${m.status}`
      );
    });
    if (mismatches.length > 100) console.log(`  ...and ${mismatches.length - 100} more`);
  } else {
    console.log("All stored regnos exactly match the full district->area->centre->exam->gender->mode->_id sort + per-prefix sequence.");
  }

  await mongoose.disconnect();
  process.exit(0);
})().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
