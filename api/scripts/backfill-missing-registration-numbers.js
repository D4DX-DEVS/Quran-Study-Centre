// Assigns register numbers ONLY to students who don't have one yet —
// additive-only, never touches or renumbers an already-assigned regno.
//
// Why this exists instead of just re-running generate-registration-numbers.js:
// that generator recomputes EVERY student's number from scratch each run,
// sorted by district -> area -> exam centre -> exam stage -> gender -> mode
// of study. If a newly-added/reassigned student sorts BEFORE an existing
// peer within the same area+centre prefix, a full re-run shifts that peer's
// sequence number too — disruptive if their hall ticket has already been
// printed. This script instead finds the current highest sequence number
// already in use for each (area+centre+exam-stage) prefix and appends the
// missing students after it, in the same district/area/centre/exam/gender/
// status/_id order the main generator uses — so it's safe to run anytime,
// as many times as needed, with zero risk to existing numbers.
//
// Usage:
//   node scripts/backfill-missing-registration-numbers.js            # writes regno for students missing one
//   node scripts/backfill-missing-registration-numbers.js --dry-run  # preview only, no writes

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "config", ".env") });
if (!process.env.MONGO_URI) require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const ExamRegistration = require("../models/examRegistration");
require("../models/district");
require("../models/area");
require("../models/centerRegistration");
require("../models/examtype");

const { _internal } = require("../controllers/registrationNumber");
const { buildPrefix, compareBySpec } = _internal;
const { resolveExamCenterName, examSortOrder } = require("../utils/studentSort");

const SEQUENCE_DIGITS = 3;
const MAX_SEQUENCE = 10 ** SEQUENCE_DIGITS - 1;

async function loadExistingMaxSeqByKey() {
  const existing = await ExamRegistration.find({ regno: { $exists: true, $nin: [null, ""] } })
    .select("regno")
    .lean();

  const maxByKey = new Map();
  for (const doc of existing) {
    const regno = String(doc.regno);
    if (regno.length < 4) continue; // malformed, ignore rather than crash the backfill
    const key = regno.slice(0, 3); // 2-char area+centre initials + 1-digit exam stage
    const seq = parseInt(regno.slice(3), 10);
    if (Number.isNaN(seq)) continue;
    maxByKey.set(key, Math.max(maxByKey.get(key) || 0, seq));
  }
  return maxByKey;
}

async function loadMissingStudentsSorted() {
  const missing = await ExamRegistration.find({ $or: [{ regno: null }, { regno: "" }, { regno: { $exists: false } }] })
    .populate("district", "district")
    .populate("area", "area")
    .populate("centerRegistration", "nameOfCenter")
    .populate("assignedExamCenter", "nameOfCenter")
    .populate("nameOfExamAppearingNow", "sortOrder stageDigit examType examShortName")
    .select("district area centerRegistration assignedExamCenter nameOfExamAppearingNow gender status nameOfApplicant")
    .lean();

  const normalized = missing.map((s) => ({
    _id: s._id,
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

async function backfillMissingRegistrationNumbers({ dryRun = false } = {}) {
  const [maxByKey, sortedMissing] = await Promise.all([loadExistingMaxSeqByKey(), loadMissingStudentsSorted()]);

  const assignments = [];
  const warnings = [];

  for (const s of sortedMissing) {
    const prefix = buildPrefix(s.areaName, s.centerName);

    let digit = s.examStageDigit;
    if (digit == null) {
      digit = 0;
      warnings.push(`Student ${s._id} (${s.nameOfApplicant}): exam "${s.examTypeLabel}" has no stage digit, used 0.`);
    }

    const key = `${prefix}${digit}`;
    const nextSeq = (maxByKey.get(key) || 0) + 1;
    if (nextSeq > MAX_SEQUENCE) {
      throw new Error(`Prefix "${key}" exceeds ${MAX_SEQUENCE} registrations (student ${s._id}) — the ${SEQUENCE_DIGITS}-digit sequence has overflowed.`);
    }
    maxByKey.set(key, nextSeq);

    const regno = `${key}${String(nextSeq).padStart(SEQUENCE_DIGITS, "0")}`;
    assignments.push({ _id: s._id, name: s.nameOfApplicant, regno });
  }

  if (warnings.length) {
    console.warn(`${warnings.length} warning(s):\n${warnings.join("\n")}`);
  }

  if (!dryRun && assignments.length) {
    const BATCH_SIZE = 1000;
    for (let i = 0; i < assignments.length; i += BATCH_SIZE) {
      const ops = assignments.slice(i, i + BATCH_SIZE).map(({ _id, regno }) => ({
        updateOne: { filter: { _id }, update: { $set: { regno } } },
      }));
      await ExamRegistration.bulkWrite(ops, { ordered: false });
    }
  }

  return { count: assignments.length, assignments, warnings };
}

(async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not set. Aborting.");
    process.exit(1);
  }
  const dryRun = process.argv.includes("--dry-run");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to Mongo.\n");

  const { count, assignments, warnings } = await backfillMissingRegistrationNumbers({ dryRun });

  console.log(`${dryRun ? "[dry run] " : ""}Assigned registration numbers to ${count} student(s) who didn't have one.\n`);
  assignments.forEach((a) => console.log(`  ${a.name}: ${a.regno}`));
  if (warnings.length) {
    console.log(`\n${warnings.length} warning(s) — see above.`);
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
