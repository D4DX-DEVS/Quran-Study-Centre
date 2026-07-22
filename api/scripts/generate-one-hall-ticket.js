// One-off generator for a single student's hall ticket, by register number.
// Uses the same render -> upload -> DB-update path as the bulk job, so the
// output matches exactly what generate-all would produce. Good for verifying
// a template/layout change on one student before regenerating everyone.
// Usage: node scripts/generate-one-hall-ticket.js AA1001

const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
const path = require("path");
const fs = require("fs");

const envPath = path.join(__dirname, "..", ".env");
const raw = fs.readFileSync(envPath, "utf8");
raw.split(/\r?\n/).forEach((line) => {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!m) return;
  let val = m[2];
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  if (!(m[1] in process.env)) process.env[m[1]] = val;
});

const mongoose = require("mongoose");
require("../models/district.js");
require("../models/area.js");
require("../models/centerRegistration.js");
require("../models/examCenterRegistration.js");
require("../models/examtype.js");
const ExamRegistration = require("../models/examRegistration.js");
const { processBulkHallTickets, HALL_TICKET_POPULATE_OPTS } = require("../controllers/hallTicket.js");

(async () => {
  const regno = process.argv[2];
  if (!regno) {
    console.error("Usage: node scripts/generate-one-hall-ticket.js <REGNO>");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  console.log("Connected:", mongoose.connection.host);

  const student = await ExamRegistration.findOne({ regno }).populate(HALL_TICKET_POPULATE_OPTS);
  if (!student) {
    console.error(`No student found with register number "${regno}".`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`Found: ${student.nameOfApplicant} (regno ${student.regno}, _id ${student._id})`);
  const result = await processBulkHallTickets([student]);
  console.log("Result:", JSON.stringify(result));

  const HallTicket = require("../models/hallTicket.js");
  const doc = await HallTicket.findOne({ nameOfApplicant: student._id }).select("status pdfUrl error");
  console.log("Status:", doc?.status);
  console.log("PDF URL:", doc?.pdfUrl);
  if (doc?.error) console.log("Error:", doc.error);

  await mongoose.disconnect();
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
