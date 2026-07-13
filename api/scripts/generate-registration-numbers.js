// Runs the registration-number generator against every exam registration.
//
// Usage:
//   node scripts/generate-registration-numbers.js            # writes regno for all students
//   node scripts/generate-registration-numbers.js --dry-run  # preview only, no writes

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "config", ".env") });
if (!process.env.MONGO_URI) require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const { generateRegistrationNumbers } = require("../controllers/registrationNumber");

(async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not set. Aborting.");
    process.exit(1);
  }
  const dryRun = process.argv.includes("--dry-run");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to Mongo.\n");

  const { count, prefixCounts } = await generateRegistrationNumbers({ dryRun });

  console.log(`${dryRun ? "[dry run] " : ""}Assigned registration numbers to ${count} student(s).`);
  console.log("\nPer-prefix totals:");
  Object.entries(prefixCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([prefix, n]) => console.log(`  ${prefix}: ${n}`));

  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
