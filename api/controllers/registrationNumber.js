// Automatic registration-number generation.
//
// Format: AADNNN — Area initial + Exam Center initial ("QSC " prefix on the
// centre name is ignored) + a 1-digit exam-stage code (Preliminary I-VI -> 1-6,
// Secondary I-III -> 7-9) + a 3-digit sequence that runs continuously per
// prefix across the whole dataset (never reset per area/centre/exam).
//
// Deterministic: numbers are recomputed from scratch on every run by sorting
// the full dataset (district -> area -> exam centre -> exam stage -> gender
// -> mode of study -> _id as a final tiebreaker) and walking it once, so
// re-running against an unchanged dataset always reproduces the same numbers.

const ExamRegistration = require("../models/examRegistration");
// Required so Mongoose has these schemas registered for the .populate() calls
// below even when this module is loaded standalone (e.g. from a script).
require("../models/district");
const Area = require("../models/area");
const CenterRegistration = require("../models/centerRegistration");
const ExamType = require("../models/examtype");
const Counter = require("../models/counter");
const { resolveExamCenterName, examSortOrder, compareBySpec } = require("../utils/studentSort");

const SEQUENCE_DIGITS = 3;
const MAX_SEQUENCE = 10 ** SEQUENCE_DIGITS - 1;

// Letter "O" looks like digit "0" inside a regno, so skip it and use the
// next letter found instead (falls back to "O" only if nothing else exists).
function initialOf(name) {
  const str = String(name || "");
  for (const ch of str) {
    if (/[A-Za-z]/.test(ch) && ch.toUpperCase() !== "O") {
      return ch.toUpperCase();
    }
  }
  const match = str.match(/[A-Za-z]/);
  return match ? match[0].toUpperCase() : "X";
}

// First letter of the exam centre name, skipping a leading "QSC" word.
function examCenterInitial(centerName) {
  const words = String(centerName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const first = words[0];
  const skipQsc = first && first.toUpperCase() === "QSC" && words.length > 1;
  return initialOf(skipQsc ? words[1] : first);
}

function buildPrefix(areaName, centerName) {
  return `${initialOf(areaName)}${examCenterInitial(centerName)}`;
}

// The 3-digit sequence is shared across every exam-stage digit for a given
// prefix (e.g. PP1xxx, PP2xxx, ... PP9xxx all draw from the same running
// count) — this matches generateRegistrationNumbers()/verify-full-sequence.js
// below, which key their per-prefix counter on the 2-letter prefix alone.
//
// Before handing out a number, sync the Counter up to the true max already
// stored in ExamRegistration for this prefix (via $max, so it only ever
// moves forward). This makes real-time issuance self-healing: it can never
// fall behind actual data, even after a full recompute (which renumbers
// everyone without touching Counters) or if a Counter document is missing.
async function syncPrefixCounterToActualMax(prefix) {
  const re = new RegExp(`^${prefix}\\d{${1 + SEQUENCE_DIGITS}}$`);
  const docs = await ExamRegistration.find({ regno: re }).select("regno").lean();
  let max = 0;
  for (const d of docs) {
    const seq = parseInt(String(d.regno).slice(prefix.length + 1), 10);
    if (!Number.isNaN(seq)) max = Math.max(max, seq);
  }
  if (max > 0) {
    await Counter.findByIdAndUpdate(prefix, { $max: { seq: max } }, { upsert: true, setDefaultsOnInsert: true });
  }
}

// Real-time regno assignment for a single new registration (used at signup,
// not during the full recompute). Atomically takes the next sequence number
// for this student's prefix via the Counter collection — safe under
// concurrent signups, unlike the in-memory counting the batch generator/
// backfill script use.
async function nextRegistrationNumberForNewStudent({ areaId, centerRegistrationId, assignedExamCenterId, examTypeId }) {
  const [area, center, assignedCenter, examType] = await Promise.all([
    areaId ? Area.findById(areaId).select("area").lean() : null,
    centerRegistrationId ? CenterRegistration.findById(centerRegistrationId).select("nameOfCenter").lean() : null,
    assignedExamCenterId ? CenterRegistration.findById(assignedExamCenterId).select("nameOfCenter").lean() : null,
    examTypeId ? ExamType.findById(examTypeId).select("stageDigit").lean() : null,
  ]);

  const areaName = area?.area || "";
  const centerName = center?.nameOfCenter || assignedCenter?.nameOfCenter || "";
  const prefix = buildPrefix(areaName, centerName);
  const digit = examType?.stageDigit ?? 0;

  await syncPrefixCounterToActualMax(prefix);
  const seq = await Counter.nextSeq(prefix);
  if (seq > MAX_SEQUENCE) {
    throw new Error(`Prefix "${prefix}" exceeds ${MAX_SEQUENCE} registrations — the ${SEQUENCE_DIGITS}-digit sequence has overflowed.`);
  }

  return `${prefix}${digit}${String(seq).padStart(SEQUENCE_DIGITS, "0")}`;
}

async function loadSortedStudents() {
  const students = await ExamRegistration.find({})
    .populate("district", "district")
    .populate("area", "area")
    .populate("centerRegistration", "nameOfCenter")
    .populate("assignedExamCenter", "nameOfCenter")
    .populate("nameOfExamAppearingNow", "sortOrder stageDigit examType examShortName")
    .select("district area centerRegistration assignedExamCenter nameOfExamAppearingNow gender status")
    .lean();

  const normalized = students.map((s) => ({
    _id: s._id,
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

/**
 * Recompute registration numbers for every exam registration.
 * Returns { count, prefixCounts, assignments } without writing when dryRun.
 */
async function generateRegistrationNumbers({ dryRun = false } = {}) {
  const sorted = await loadSortedStudents();

  const prefixCounter = {};
  const assignments = [];
  const warnings = [];
  for (const s of sorted) {
    const prefix = buildPrefix(s.areaName, s.centerName);
    prefixCounter[prefix] = (prefixCounter[prefix] || 0) + 1;
    const seq = prefixCounter[prefix];

    if (seq > MAX_SEQUENCE) {
      throw new Error(
        `Prefix "${prefix}" exceeds ${MAX_SEQUENCE} registrations (student ${s._id}) — the ${SEQUENCE_DIGITS}-digit sequence has overflowed.`
      );
    }

    // Exam types outside the fixed 9-exam scheme have no stage digit yet —
    // fall back to 0 rather than aborting the whole batch, but surface it.
    let digit = s.examStageDigit;
    if (digit == null) {
      digit = 0;
      warnings.push(`Student ${s._id}: exam "${s.examTypeLabel}" has no stage digit, used 0.`);
    }

    const regno = `${prefix}${digit}${String(seq).padStart(SEQUENCE_DIGITS, "0")}`;
    assignments.push({ _id: s._id, regno });
  }

  if (warnings.length) {
    console.warn(`generateRegistrationNumbers: ${warnings.length} warning(s):\n${warnings.join("\n")}`);
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

  return { count: assignments.length, prefixCounts: prefixCounter, assignments, warnings };
}

// POST /api/v1/registration-number/generate
// body: { dryRun?: boolean }
exports.generate = async (req, res) => {
  try {
    const dryRun = req.body?.dryRun === true;
    const out = await generateRegistrationNumbers({ dryRun });
    res.status(200).json({
      success: true,
      dryRun,
      count: out.count,
      prefixCounts: out.prefixCounts,
      warnings: out.warnings,
    });
  } catch (err) {
    console.error("generate registration numbers error:", err);
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.generateRegistrationNumbers = generateRegistrationNumbers;
exports.nextRegistrationNumberForNewStudent = nextRegistrationNumberForNewStudent;
exports._internal = { buildPrefix, examCenterInitial, initialOf, compareBySpec };
