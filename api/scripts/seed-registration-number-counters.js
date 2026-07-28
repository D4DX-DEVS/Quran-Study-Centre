// Syncs the Counter collection with the highest regno sequence already in use
// per 2-letter (area+centre) prefix — shared across every exam-stage digit,
// matching controllers/registrationNumber.js. Real-time signup now self-heals
// this on every call (see syncPrefixCounterToActualMax there), so running this
// script is no longer required, but it's kept as a manual/verification tool.
//
// Usage:
//   node scripts/seed-registration-number-counters.js            # writes
//   node scripts/seed-registration-number-counters.js --dry-run  # preview only

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "config", ".env") });
if (!process.env.MONGO_URI) require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const ExamRegistration = require("../models/examRegistration");
const Counter = require("../models/counter");

async function seedCounters({ dryRun = false } = {}) {
  const existing = await ExamRegistration.find({ regno: { $exists: true, $nin: [null, ""] } })
    .select("regno")
    .lean();

  const maxByKey = new Map();
  for (const doc of existing) {
    const regno = String(doc.regno);
    if (regno.length < 4) continue; // malformed, ignore rather than crash the seed
    const key = regno.slice(0, 2); // 2-char area+centre initials (shared across exam-stage digits)
    const seq = parseInt(regno.slice(3), 10);
    if (Number.isNaN(seq)) continue;
    maxByKey.set(key, Math.max(maxByKey.get(key) || 0, seq));
  }

  if (!dryRun) {
    for (const [key, seq] of maxByKey) {
      await Counter.findByIdAndUpdate(key, { $max: { seq } }, { upsert: true, setDefaultsOnInsert: true });
    }
  }

  return maxByKey;
}

(async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not set. Aborting.");
    process.exit(1);
  }
  const dryRun = process.argv.includes("--dry-run");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to Mongo.\n");

  const maxByKey = await seedCounters({ dryRun });

  console.log(`${dryRun ? "[dry run] " : ""}Synced ${maxByKey.size} counter key(s).\n`);
  [...maxByKey.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([key, seq]) => console.log(`  ${key}: ${seq}`));

  await mongoose.disconnect();
  process.exit(0);
})().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
