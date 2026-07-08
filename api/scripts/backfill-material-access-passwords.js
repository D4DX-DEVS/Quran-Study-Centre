// One-time backfill: generate a Material Access password for every existing
// Area that doesn't have one yet. New areas created after this get one
// automatically (see the post-save hook in models/area.js) — there is no
// admin-panel button for this, since it's only ever needed once.
//
// Idempotent — safe to re-run; only fills gaps, never overwrites an existing
// password. Pass --force to regenerate every area's password instead.
//
// Usage:
//   cd qsc-automation-api
//   node scripts/backfill-material-access-passwords.js
//   node scripts/backfill-material-access-passwords.js --force

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "config", ".env") });
if (!process.env.MONGO_URI) require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
require("../models/district"); // registers the "District" schema so Area's .populate("district") works standalone
const Area = require("../models/area");
const MaterialAccess = require("../models/materialAccess");

const force = process.argv.includes("--force");

(async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not set. Aborting.");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to Mongo.${force ? " (force mode — regenerating every area's password)" : ""}\n`);

  const areas = await Area.find({}).populate("district", "district");
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const area of areas) {
    const existing = await MaterialAccess.findOne({ area: area._id });
    if (existing && !force) {
      skipped += 1;
      continue;
    }

    let password;
    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = MaterialAccess.generatePassword(area.district?.district, area.area);
      const taken = await MaterialAccess.findOne({ password: candidate, area: { $ne: area._id } });
      if (!taken) {
        password = candidate;
        break;
      }
    }
    if (!password) {
      console.log(`  Could not generate a unique password for "${area.area}" — skipped`);
      continue;
    }

    if (existing) {
      existing.password = password;
      await existing.save();
      updated += 1;
      console.log(`  Regenerated: ${area.district?.district || "Unknown"} / ${area.area} -> ${password}`);
    } else {
      await MaterialAccess.create({ area: area._id, district: area.district?._id, password });
      created += 1;
      console.log(`  Created: ${area.district?.district || "Unknown"} / ${area.area} -> ${password}`);
    }
  }

  console.log(`\nDone. Created ${created}, updated ${updated}, skipped ${skipped} (already had a password).`);
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error("Backfill failed:", err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
