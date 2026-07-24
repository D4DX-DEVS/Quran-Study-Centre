// READ-ONLY: confirm the new display precedence (assignedExamCenter-first)
// matches the hall ticket for every student. Usage: node scripts/verify-display-fix.js
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
const path = require("path");
const fs = require("fs");

const envPath = path.join(__dirname, "..", ".env");
fs.readFileSync(envPath, "utf8")
  .split(/\r?\n/)
  .forEach((line) => {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) return;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  });

const mongoose = require("mongoose");
require("../models/district.js");
require("../models/area.js");
require("../models/centerRegistration.js");
require("../models/examCenterRegistration.js");
require("../models/examtype.js");
const ExamRegistration = require("../models/examRegistration.js");
const { buildProps } = require("../controllers/hallTicketDocument.js");

const clean = (v) => (v == null ? "" : String(v).replace(/\s+/g, " ").trim().toUpperCase());

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });

  const all = await ExamRegistration.find({})
    .populate("district", "district")
    .populate("area", "area")
    .populate("centerRegistration", "nameOfCenter")
    .populate("assignedExamCenter", "nameOfCenter")
    .populate("examCenter", "centerName")
    .populate("outsideExamCenter", "centerName")
    .populate("nameOfExamAppearingNow", "examType")
    .lean();

  let mismatch = 0;
  for (const u of all) {
    // exactly what VerifyRegistration.jsx now renders
    const display = clean(
      u.assignedExamCenter?.nameOfCenter ||
        u.examCenter?.centerName ||
        u.outsideExamCenter?.centerName ||
        u.centerRegistration?.nameOfCenter
    ) || "NIL";
    const ticket = buildProps(u).examCentre;
    if (display !== ticket) {
      mismatch++;
      if (mismatch <= 10) console.log("MISMATCH", u.regno, `display="${display}" ticket="${ticket}"`);
    }
  }
  console.log(`Total: ${all.length}, display-vs-ticket mismatches: ${mismatch}`);

  const s = all.find((u) => u.regno === "KI3037");
  if (s) {
    console.log("\nKI3037", s.nameOfApplicant);
    console.log("  study centre (registered):", s.centerRegistration?.nameOfCenter);
    console.log("  exam-day (will display):  ", s.assignedExamCenter?.nameOfCenter);
    console.log("  ticket prints:            ", buildProps(s).examCentre);
    console.log("  clubbed:", !!s.assignedByClubbing);
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
