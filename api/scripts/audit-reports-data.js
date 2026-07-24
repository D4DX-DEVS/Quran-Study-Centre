// READ-ONLY audit of the data feeding: attendance sheet, consolidation
// report, exam-center stickers. Usage: node scripts/audit-reports-data.js
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

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  console.log("Connected:", mongoose.connection.host);

  const all = await ExamRegistration.find({})
    .populate("district", "district")
    .populate("area", "area")
    .populate("centerRegistration", "nameOfCenter centerCode")
    .populate("assignedExamCenter", "nameOfCenter centerCode")
    .populate("examCenter", "centerName")
    .populate("outsideExamCenter", "centerName")
    .populate("nameOfExamAppearingNow", "examType examShortName sortOrder")
    .lean();

  console.log("Total registrations:", all.length);

  // ---- 1. ATTENDANCE SHEET grouping (utils/attendanceExport.js logic) ----
  // home study centre -> assigned -> outside -> legacy examCenter -> Unknown
  const unknownCenter = [];
  const noDistrict = [];
  const noArea = [];
  const noExamType = [];
  const noRegno = [];
  const noName = [];
  for (const u of all) {
    const center =
      u.centerRegistration?.nameOfCenter ||
      u.assignedExamCenter?.nameOfCenter ||
      u.outsideExamCenter?.centerName ||
      u.examCenter?.centerName;
    if (!center) unknownCenter.push(`${u.regno || "NO-REGNO"} | ${u.nameOfApplicant || "NO-NAME"}`);
    if (!u.district?.district) noDistrict.push(`${u.regno || "?"} | ${u.nameOfApplicant || "?"}`);
    if (!u.area?.area) noArea.push(`${u.regno || "?"} | ${u.nameOfApplicant || "?"}`);
    if (!u.nameOfExamAppearingNow?.examType) noExamType.push(`${u.regno || "?"} | ${u.nameOfApplicant || "?"}`);
    if (!u.regno) noRegno.push(`${u.nameOfApplicant || "?"} | ${u.mobileNumber || "?"}`);
    if (!u.nameOfApplicant) noName.push(`${u.regno || "?"} | ${u.mobileNumber || "?"}`);
  }

  // ---- 2. mobile-number dedup effect (stickers / consolidation / registered list) ----
  // Those endpoints keep ONE row per mobileNumber. If one mobile is shared by
  // rows with DIFFERENT applicant names, a real student silently disappears
  // from those reports.
  const byMobile = new Map();
  for (const u of all) {
    if (!u.mobileNumber) continue;
    if (!byMobile.has(u.mobileNumber)) byMobile.set(u.mobileNumber, []);
    byMobile.get(u.mobileNumber).push(u);
  }
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim().toUpperCase();
  const sharedSameName = []; // resubmissions of same person (dedup OK)
  const sharedDiffName = []; // DIFFERENT people sharing a mobile (dedup DROPS a student)
  for (const [mobile, rows] of byMobile) {
    if (rows.length < 2) continue;
    const names = new Set(rows.map((r) => norm(r.nameOfApplicant)));
    const entry = `${mobile}: ${rows.map((r) => `${r.regno || "no-regno"}/${norm(r.nameOfApplicant)}`).join(" , ")}`;
    if (names.size > 1) sharedDiffName.push(entry);
    else sharedSameName.push(entry);
  }

  // ---- 3. STICKER regno ranges: per (home centre, exam), regnos should share
  // one prefix and be contiguous-ish. Flag mixed prefixes inside one range. ----
  const rangeKey = (u) =>
    `${u.centerRegistration?.nameOfCenter || u.assignedExamCenter?.nameOfCenter || "?"} :: ${
      u.nameOfExamAppearingNow?.examShortName || u.nameOfExamAppearingNow?.examType || "?"
    }`;
  const ranges = new Map();
  for (const u of all) {
    if (!u.regno) continue;
    const k = rangeKey(u);
    if (!ranges.has(k)) ranges.set(k, new Set());
    ranges.get(k).add(u.regno.slice(0, 3)); // prefix incl. stage digit
  }
  const mixedPrefix = [...ranges.entries()].filter(([, s]) => s.size > 1);

  const show = (arr, n = 15) => arr.slice(0, n).map((x) => "   " + x).join("\n") + (arr.length > n ? `\n   ... +${arr.length - n} more` : "");

  console.log("\n===== 1. ATTENDANCE SHEET data =====");
  console.log(`No centre at all (lands in "Unknown Center"): ${unknownCenter.length}`);
  if (unknownCenter.length) console.log(show(unknownCenter));
  console.log(`Missing district: ${noDistrict.length}`);
  if (noDistrict.length) console.log(show(noDistrict));
  console.log(`Missing area: ${noArea.length}`);
  if (noArea.length) console.log(show(noArea));
  console.log(`Missing exam type: ${noExamType.length}`);
  if (noExamType.length) console.log(show(noExamType));
  console.log(`Missing regno (blank on sheet): ${noRegno.length}`);
  if (noRegno.length) console.log(show(noRegno));
  console.log(`Missing name: ${noName.length}`);
  if (noName.length) console.log(show(noName));

  console.log("\n===== 2. MOBILE DEDUP (stickers/consolidation/registered-list) =====");
  console.log(`Mobiles with multiple rows, SAME name (resubmission, dedup fine): ${sharedSameName.length}`);
  console.log(`Mobiles shared by DIFFERENT names (a real student is DROPPED): ${sharedDiffName.length}`);
  if (sharedDiffName.length) console.log(show(sharedDiffName, 40));

  console.log("\n===== 3. STICKER REGNO RANGES =====");
  console.log(`(centre, exam) groups with MIXED regno prefixes: ${mixedPrefix.length}`);
  if (mixedPrefix.length) console.log(show(mixedPrefix.map(([k, s]) => `${k} -> ${[...s].join(", ")}`), 30));

  fs.writeFileSync(
    path.join(__dirname, "reports-data-audit.txt"),
    [
      `Total: ${all.length}`,
      `UnknownCenter: ${unknownCenter.length}`, ...unknownCenter,
      `NoDistrict: ${noDistrict.length}`, ...noDistrict,
      `NoArea: ${noArea.length}`, ...noArea,
      `NoExamType: ${noExamType.length}`, ...noExamType,
      `NoRegno: ${noRegno.length}`, ...noRegno,
      `NoName: ${noName.length}`, ...noName,
      `SharedMobileDiffName: ${sharedDiffName.length}`, ...sharedDiffName,
      `SharedMobileSameName: ${sharedSameName.length}`, ...sharedSameName,
      `MixedPrefixGroups: ${mixedPrefix.length}`, ...mixedPrefix.map(([k, s]) => `${k} -> ${[...s].join(", ")}`),
    ].join("\n"),
    "utf8"
  );
  console.log("\nFull report: scripts/reports-data-audit.txt");

  await mongoose.disconnect();
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
