// READ-ONLY: recheck mixed regno prefixes keyed the way stickers actually
// group — by centre _id (district+area scoped), not bare name.
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
const path = require("path");
const fs = require("fs");
const envPath = path.join(__dirname, "..", ".env");
fs.readFileSync(envPath, "utf8").split(/\r?\n/).forEach((line) => {
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
require("../models/examtype.js");
const ExamRegistration = require("../models/examRegistration.js");

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  const all = await ExamRegistration.find({ regno: { $exists: true, $ne: null } })
    .populate("district", "district")
    .populate("area", "area")
    .populate("centerRegistration", "nameOfCenter")
    .populate("assignedExamCenter", "nameOfCenter")
    .populate("nameOfExamAppearingNow", "examShortName examType")
    .select("regno nameOfApplicant district area centerRegistration assignedExamCenter nameOfExamAppearingNow")
    .lean();

  const groups = new Map();
  for (const u of all) {
    const c = u.centerRegistration || u.assignedExamCenter;
    if (!c?._id) continue;
    const k = `${String(c._id)} :: ${u.nameOfExamAppearingNow?.examShortName || u.nameOfExamAppearingNow?.examType || "?"}`;
    if (!groups.has(k))
      groups.set(k, { name: c.nameOfCenter, district: u.district?.district, area: u.area?.area, prefixes: new Map() });
    const g = groups.get(k);
    const p = u.regno.slice(0, 3);
    if (!g.prefixes.has(p)) g.prefixes.set(p, []);
    g.prefixes.get(p).push(`${u.regno} ${u.nameOfApplicant}`);
  }

  let bad = 0;
  for (const [k, g] of groups) {
    if (g.prefixes.size > 1) {
      bad++;
      console.log(`MIXED: ${g.name} (${g.district}/${g.area}) :: ${k.split("::")[1].trim()}`);
      for (const [p, students] of g.prefixes) console.log(`   ${p}: ${students.length} -> ${students.slice(0, 3).join(" | ")}`);
    }
  }
  console.log(`\nGroups keyed by centre _id + exam: ${groups.size}, mixed-prefix: ${bad}`);
  await mongoose.disconnect();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
