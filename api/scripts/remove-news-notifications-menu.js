// One-off cleanup: removes the "News & Notifications" Menu entry and its
// MenuRole grants that seed-news-notifications-menu.js created, since the
// feature's code was reverted.
//
// Usage:
//   cd api
//   node scripts/remove-news-notifications-menu.js

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "config", ".env") });
if (!process.env.MONGO_URI) require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const Menu = require("../models/menu");
const MenuRole = require("../models/menuRole");

const ELEMENT = "news-notifications";

(async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not set. Aborting.");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to Mongo.\n");

  const menu = await Menu.findOne({ element: ELEMENT });
  if (!menu) {
    console.log(`No "${ELEMENT}" menu found. Nothing to do.`);
  } else {
    const removedRoles = await MenuRole.deleteMany({ menu: menu._id });
    await Menu.deleteOne({ _id: menu._id });
    console.log(`Removed menu "${menu.label}" (${menu._id}) and ${removedRoles.deletedCount} role grant(s).`);
  }

  await mongoose.disconnect();
  console.log("\nDone.");
})().catch(async (err) => {
  console.error("Cleanup failed:", err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
