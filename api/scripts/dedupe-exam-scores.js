// Removes duplicate exam results (same candidate + same exam) and adds the
// unique { student, exam } index so they cannot come back.
//
// A duplicate group is only cleaned up when every copy has the same score and
// grade: the oldest copy is kept and the rest are deleted. Groups whose copies
// disagree are listed for manual review and left untouched — the index cannot
// be built until they are resolved. Results for different exams of the same
// candidate are never touched.
//
// Usage:
//   node scripts/dedupe-exam-scores.js           # dry run: report only
//   node scripts/dedupe-exam-scores.js --apply   # back up, delete, build index
//
// Deleted documents are backed up to scripts/reports/ before deletion.

const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "config", ".env") });
if (!process.env.MONGO_URI) require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
// Same resolvers as config/db.js — some networks cannot resolve Atlas SRV records.
require("dns").setServers(["8.8.8.8", "1.1.1.1"]);

const mongoose = require("mongoose");
const ExamScore = require("../models/examScore");
require("../models/examRegistration");
require("../models/examtype");

const APPLY = process.argv.includes("--apply");

(async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not set. Aborting.");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to Mongo. Mode: ${APPLY ? "APPLY" : "DRY RUN"}\n`);

  const groups = await ExamScore.aggregate([
    { $sort: { _id: 1 } },
    { $group: { _id: { student: "$student", exam: "$exam" }, docs: { $push: "$$ROOT" }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ]);

  const toDelete = [];
  const conflicts = [];
  for (const g of groups) {
    const [keep, ...rest] = g.docs; // oldest first (sorted by _id)
    const reg = await mongoose.model("ExamRegistration").findById(g._id.student).select("regno nameOfApplicant").lean();
    const exam = await mongoose.model("ExamType").findById(g._id.exam).select("examType").lean();
    const label = `${reg?.regno ?? g._id.student} ${reg?.nameOfApplicant ?? ""} — ${String(exam?.examType ?? g._id.exam).split(":")[0].trim()}`;
    const same = rest.every((d) => d.score === keep.score && d.grade === keep.grade);
    if (!same) {
      conflicts.push(label);
      console.log(`CONFLICT  ${label}: scores ${g.docs.map((d) => `${d.score}/${d.grade}`).join(", ")} — left untouched`);
      continue;
    }
    console.log(`DUPLICATE ${label}: keep ${keep._id} (score ${keep.score}), delete ${rest.map((d) => d._id).join(", ")}`);
    toDelete.push(...rest);
  }

  console.log(`\n${groups.length} duplicate group(s): ${toDelete.length} extra copies to delete, ${conflicts.length} conflict(s) for manual review.`);

  if (!APPLY) {
    console.log("\nDry run — nothing changed. Re-run with --apply to delete and build the index.");
    await mongoose.disconnect();
    return;
  }

  if (toDelete.length) {
    const dir = path.join(__dirname, "reports");
    fs.mkdirSync(dir, { recursive: true });
    const backup = path.join(dir, `examscore-duplicates-backup-${Date.now()}.json`);
    fs.writeFileSync(backup, JSON.stringify(toDelete, null, 2));
    console.log(`Backed up ${toDelete.length} document(s) to ${backup}`);
    const res = await ExamScore.deleteMany({ _id: { $in: toDelete.map((d) => d._id) } });
    console.log(`Deleted ${res.deletedCount} duplicate copies.`);
  }

  if (conflicts.length) {
    console.log("\nConflicts remain — the unique index was NOT built. Resolve them, then re-run.");
  } else {
    await ExamScore.collection.createIndex({ student: 1, exam: 1 }, { unique: true, name: "student_1_exam_1" });
    console.log("Unique index { student, exam } is in place.");
  }

  await mongoose.disconnect();
})().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
