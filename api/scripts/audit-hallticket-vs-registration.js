// READ-ONLY audit: compare what each student's HALL TICKET prints vs what
// their REGISTRATION record says (the info shown on the registration page).
// Does NOT write anything. Usage: node scripts/audit-hallticket-vs-registration.js
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
  console.log("Connected:", mongoose.connection.host);

  const all = await ExamRegistration.find({})
    .populate("district", "district")
    .populate("area", "area")
    .populate("centerRegistration", "nameOfCenter")
    .populate("assignedExamCenter", "nameOfCenter")
    .populate("examCenter", "centerName")
    .populate("outsideExamCenter", "centerName")
    .populate("nameOfExamAppearingNow", "examType")
    .lean();

  console.log("Total registrations:", all.length);

  const centreMismatch = [];   // hall ticket centre != centre student registered with
  const clubbedFlagged = [];   // assignedByClubbing true (intentional moves)
  const clubbedNoFlag = [];    // centre differs but assignedByClubbing NOT set (suspect)
  const nameDistrictIssues = [];

  for (const u of all) {
    const p = buildProps(u); // exactly what the PDF prints

    // What the student saw / chose at registration time:
    // the registration page's "Exam Center" = examCenter (explicit pick) or
    // outsideExamCenter, else home study centre.
    const registeredCentre = clean(
      u.examCenter?.centerName || u.outsideExamCenter?.centerName || u.centerRegistration?.nameOfCenter
    );
    const ticketCentre = p.examCentre;

    const label = `${p.regno} | ${p.name} | ${u.district?.district || "?"}/${u.area?.area || "?"}`;

    if (registeredCentre && ticketCentre !== registeredCentre) {
      const line = `${label}\n      registered: "${registeredCentre}"  ticket: "${ticketCentre}"  clubbedFlag=${!!u.assignedByClubbing}`;
      centreMismatch.push(line);
      if (u.assignedByClubbing) clubbedFlagged.push(line);
      else clubbedNoFlag.push(line);
    }

    // Sanity: name / district / area / exam name on ticket must equal registration.
    if (p.name !== (clean(u.nameOfApplicant) || "NIL"))
      nameDistrictIssues.push(`${label} name: reg="${clean(u.nameOfApplicant)}" ticket="${p.name}"`);
    const regDistrict = [clean(u.district?.district), clean(u.area?.area)].filter(Boolean).join(", ") || "NIL";
    if (p.district !== regDistrict)
      nameDistrictIssues.push(`${label} district: reg="${regDistrict}" ticket="${p.district}"`);
    if (p.examName !== (clean(u.nameOfExamAppearingNow?.examType) || "NIL"))
      nameDistrictIssues.push(`${label} exam: reg="${clean(u.nameOfExamAppearingNow?.examType)}" ticket="${p.examName}"`);
  }

  const show = (arr, n) => arr.slice(0, n).map((x) => "   " + x).join("\n") + (arr.length > n ? `\n   ... +${arr.length - n} more` : "");

  console.log("\n========== HALL TICKET vs REGISTRATION ==========");
  console.log(`Exam-centre differs from registered centre: ${centreMismatch.length}`);
  console.log(`   of which flagged as clubbing (intentional): ${clubbedFlagged.length}`);
  console.log(`   of which NOT flagged (suspect):             ${clubbedNoFlag.length}`);
  if (clubbedNoFlag.length) {
    console.log("\n-- UNFLAGGED mismatches (suspect) --");
    console.log(show(clubbedNoFlag, 50));
  }
  if (clubbedFlagged.length) {
    console.log("\n-- Clubbing-flagged mismatches (moved by allocation) --");
    console.log(show(clubbedFlagged, 50));
  }
  console.log(`\nName/district/exam-name mismatches: ${nameDistrictIssues.length}`);
  if (nameDistrictIssues.length) console.log(show(nameDistrictIssues, 50));

  // Dump full mismatch list to file for review
  const out = path.join(__dirname, "hallticket-vs-registration-report.txt");
  fs.writeFileSync(
    out,
    [
      `Total: ${all.length}`,
      `Centre mismatches: ${centreMismatch.length} (clubbed=${clubbedFlagged.length}, unflagged=${clubbedNoFlag.length})`,
      "",
      "== ALL CENTRE MISMATCHES ==",
      ...centreMismatch,
      "",
      "== NAME/DISTRICT/EXAM ISSUES ==",
      ...nameDistrictIssues,
    ].join("\n"),
    "utf8"
  );
  console.log("\nFull report:", out);

  await mongoose.disconnect();
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
