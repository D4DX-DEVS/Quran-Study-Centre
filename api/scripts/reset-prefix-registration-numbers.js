// Renumber ONLY the students whose (area+centre) initials build to a given
// prefix (e.g. "KK") — same sort/seq rule as the full generator
// (controllers/registrationNumber.js), but scoped to one prefix so students
// under every other prefix are left untouched.
//
// Use this instead of the full generate-registration-numbers.js recompute
// when a stale/mismatched regno (wrong prefix) needs correcting: that one
// record joining its correct prefix group can shift the seq of every peer
// that sorts after it within the SAME prefix, so the whole group must be
// recomputed together, not just the one bad record.
//


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
const MAX_SEQUENCE = 10 ** SEQUENCE_DIGITS - 1;

async function loadAllSorted() {
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
  return normalized;
}

(async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not set. Aborting.");
    process.exit(1);
  }

  const write = process.argv.includes("--write");
  const targetPrefix = (process.argv[2] || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(targetPrefix)) {
    console.error('Usage: node scripts/reset-prefix-registration-numbers.js KK [--write]');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to Mongo.\n");

  const all = await loadAllSorted();
  const group = all.filter((s) => buildPrefix(s.areaName, s.centerName) === targetPrefix);

  const changes = [];
  const warnings = [];
  let seq = 0;
  for (const s of group) {
    seq++;
    if (seq > MAX_SEQUENCE) {
      throw new Error(`Prefix "${targetPrefix}" exceeds ${MAX_SEQUENCE} registrations (student ${s._id}).`);
    }
    let digit = s.examStageDigit;
    if (digit == null) {
      digit = 0;
      warnings.push(`Student ${s._id} (${s.nameOfApplicant}): exam "${s.examTypeLabel}" has no stage digit, used 0.`);
    }
    const newRegno = `${targetPrefix}${digit}${String(seq).padStart(SEQUENCE_DIGITS, "0")}`;
    if (newRegno !== s.regno) {
      changes.push({ _id: s._id, name: s.nameOfApplicant, oldRegno: s.regno, newRegno });
    }
  }

  console.log(`Prefix "${targetPrefix}": ${group.length} student(s) in group. ${changes.length} regno(s) would change.\n`);
  changes.forEach((c) => console.log(`  ${c.name}: ${c.oldRegno || "(none)"} -> ${c.newRegno}`));
  if (warnings.length) {
    console.log(`\n${warnings.length} warning(s):`);
    warnings.forEach((w) => console.log(`  ${w}`));
  }

  if (write && changes.length) {
    console.log("\nWriting changes...");
    const BATCH_SIZE = 1000;
    for (let i = 0; i < changes.length; i += BATCH_SIZE) {
      const ops = changes.slice(i, i + BATCH_SIZE).map(({ _id, newRegno }) => ({
        updateOne: { filter: { _id }, update: { $set: { regno: newRegno } } },
      }));
      await ExamRegistration.bulkWrite(ops, { ordered: false });
    }
    console.log(`Done. ${changes.length} regno(s) updated.`);
    console.log(`\nIMPORTANT: now re-run scripts/seed-registration-number-counters.js to resync the Counter collection for this prefix's keys.`);
  } else if (!write) {
    console.log("\n[dry run] No writes made. Re-run with --write to apply.");
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
