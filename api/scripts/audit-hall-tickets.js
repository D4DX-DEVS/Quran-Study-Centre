// READ-ONLY audit of every student's hall-ticket data + register number.
// Does NOT write anything. Usage: node scripts/audit-hall-tickets.js
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
const { _internal } = require("../controllers/registrationNumber.js");
const { resolveExamCenterName } = require("../utils/studentSort");
const { buildPrefix } = _internal;

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  console.log("Connected:", mongoose.connection.host);

  const all = await ExamRegistration.find({})
    .populate("district", "district")
    .populate("area", "area")
    .populate("centerRegistration", "nameOfCenter")
    .populate("assignedExamCenter", "nameOfCenter")
    .populate("examCenter", "centerName")
    .populate("outsideExamCenter", "centerName")
    .populate("nameOfExamAppearingNow", "examType stageDigit examShortName")
    .lean();

  const total = all.length;
  const FMT = /^[A-Z]{2}[0-9][0-9]{3}$/;

  const issues = {
    missingRegno: [],
    badFormat: [],
    hasO: [],
    prefixMismatch: [],
    stageMismatch: [],
    nilFields: [],
  };
  const byRegno = new Map();

  for (const u of all) {
    const p = buildProps(u);
    const label = `${p.regno} | ${p.name}`;

    // duplicate tracking (skip NIL/empty)
    if (u.regno) {
      if (!byRegno.has(u.regno)) byRegno.set(u.regno, []);
      byRegno.get(u.regno).push(p.name);
    }

    // hall-ticket fields that would literally print "NIL"
    const nils = ["regno", "name", "district", "examCentre", "examName"].filter((k) => p[k] === "NIL");
    if (nils.length) issues.nilFields.push(`${label} -> NIL: ${nils.join(", ")}`);

    if (!u.regno) {
      issues.missingRegno.push(label);
      continue;
    }
    if (!FMT.test(u.regno)) issues.badFormat.push(label);

    const letters = u.regno.slice(0, 2);
    if (/O/.test(letters)) issues.hasO.push(label);

    // expected prefix from the SAME logic that assigns regnos
    const expectedPrefix = buildPrefix(u.area?.area || "", resolveExamCenterName(u));
    if (letters !== expectedPrefix) {
      issues.prefixMismatch.push(`${label} -> has "${letters}" expected "${expectedPrefix}" (area="${u.area?.area || ""}", centre="${resolveExamCenterName(u)}")`);
    }

    // expected stage digit
    const sd = u.nameOfExamAppearingNow?.stageDigit;
    if (sd != null && String(u.regno[2]) !== String(sd)) {
      issues.stageMismatch.push(`${label} -> stage digit "${u.regno[2]}" expected "${sd}" (exam="${u.nameOfExamAppearingNow?.examType || ""}")`);
    }
  }

  const dupes = [...byRegno.entries()].filter(([, names]) => names.length > 1);

  const show = (arr, n = 15) => arr.slice(0, n).map((x) => "   " + x).join("\n") + (arr.length > n ? `\n   ... +${arr.length - n} more` : "");

  console.log("\n================ HALL TICKET / REGNO AUDIT ================");
  console.log("Total student registrations:", total);
  console.log("\n-- Register number problems --");
  console.log(`Missing regno (prints NIL): ${issues.missingRegno.length}`);
  if (issues.missingRegno.length) console.log(show(issues.missingRegno));
  console.log(`Bad format (not AAD+NNN):   ${issues.badFormat.length}`);
  if (issues.badFormat.length) console.log(show(issues.badFormat));
  console.log(`Contains letter 'O':        ${issues.hasO.length}`);
  if (issues.hasO.length) console.log(show(issues.hasO));
  console.log(`Prefix mismatch:            ${issues.prefixMismatch.length}`);
  if (issues.prefixMismatch.length) console.log(show(issues.prefixMismatch));
  console.log(`Stage-digit mismatch:       ${issues.stageMismatch.length}`);
  if (issues.stageMismatch.length) console.log(show(issues.stageMismatch));
  console.log(`Duplicate regnos:           ${dupes.length}`);
  if (dupes.length) console.log(show(dupes.map(([r, names]) => `${r} used by ${names.length}: ${names.join(" / ")}`)));

  console.log("\n-- Other hall-ticket fields that print 'NIL' --");
  console.log(`Records with any NIL field: ${issues.nilFields.length}`);
  if (issues.nilFields.length) console.log(show(issues.nilFields, 25));

  const totalRegnoProblems =
    issues.missingRegno.length + issues.badFormat.length + issues.hasO.length +
    issues.prefixMismatch.length + issues.stageMismatch.length + dupes.length;
  console.log("\n================ SUMMARY ================");
  console.log(`Register-number issues: ${totalRegnoProblems}`);
  console.log(`Hall-ticket NIL-field records: ${issues.nilFields.length}`);
  console.log(totalRegnoProblems === 0 ? "REGNO: all clean ✔" : "REGNO: problems found ✖");

  await mongoose.disconnect();
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
