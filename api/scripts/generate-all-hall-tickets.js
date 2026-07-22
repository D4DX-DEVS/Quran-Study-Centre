// Standalone runner for bulk hall-ticket generation. Exists because the
// in-process background job kicked off by POST /hall-ticket/generate-all
// dies if the API process restarts mid-run (no persistent job queue) —
// this script runs to completion independent of the web server's lifecycle
// and is resumable: it skips registrations that already have status
// "generated" in the HallTicket collection, so re-running after a crash
// only processes what's left.
// Usage: node scripts/generate-all-hall-tickets.js

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
const HallTicket = require("../models/hallTicket.js");
const { processBulkHallTickets, HALL_TICKET_POPULATE_OPTS } = require("../controllers/hallTicket.js");

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  console.log("Connected:", mongoose.connection.host);

  const alreadyGenerated = await HallTicket.find({ status: "generated" }).select("nameOfApplicant");
  const doneIds = new Set(alreadyGenerated.map((h) => h.nameOfApplicant.toString()));
  console.log(`${doneIds.size} already generated, skipping those.`);

  const all = await ExamRegistration.find({}).populate(HALL_TICKET_POPULATE_OPTS);
  let remaining = all.filter((r) => !doneIds.has(r._id.toString()));
  console.log(`${all.length} total registrations, ${remaining.length} remaining to generate.`);

  const limit = parseInt(process.argv[2], 10);
  if (limit) {
    remaining = remaining.slice(0, limit);
    console.log(`--limit passed, only processing first ${remaining.length}.`);
  }

  if (!remaining.length) {
    console.log("Nothing to do.");
    await mongoose.disconnect();
    return;
  }

  let lastLogged = 0;
  const result = await processBulkHallTickets(remaining, (done, failed, total) => {
    const completed = done + failed;
    if (completed - lastLogged >= 200 || completed === total) {
      console.log(`Progress: ${completed}/${total} (${done} ok, ${failed} failed)`);
      lastLogged = completed;
    }
  });

  console.log("Final:", JSON.stringify(result));
  await mongoose.disconnect();
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
