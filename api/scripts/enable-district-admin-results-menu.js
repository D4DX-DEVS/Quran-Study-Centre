// Shows the Result menu (/exam-score) to District Admins so they can use the
// Results page and "All Exam Centre's Results" for their own district.
// Only the menu's visibility changes: add / update / delete stay as they are
// (off), so District Admins can view and download but not edit results there.
// The API scopes every request to the District Admin's own district.
//
// Safe to re-run.
//
// Usage:
//   node scripts/enable-district-admin-results-menu.js

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "config", ".env") });
if (!process.env.MONGO_URI) require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
// Same resolvers as config/db.js — some networks cannot resolve Atlas SRV records.
require("dns").setServers(["8.8.8.8", "1.1.1.1"]);

const mongoose = require("mongoose");
const Menu = require("../models/menu");
const MenuRole = require("../models/menuRole");
const UserType = require("../models/userTypes");

(async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not set. Aborting.");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);

  const menu = await Menu.findOne({ path: "/exam-score" });
  const districtAdmin = await UserType.findOne({ role: "District Admin" });
  if (!menu || !districtAdmin) {
    console.error(`Not found: ${!menu ? "Result menu (/exam-score)" : ""} ${!districtAdmin ? "District Admin role" : ""}`);
    process.exit(1);
  }

  const role = await MenuRole.findOne({ menu: menu._id, userType: districtAdmin._id });
  if (!role) {
    await MenuRole.create({ menu: menu._id, userType: districtAdmin._id, status: true, add: false, update: false, delete: false });
    console.log("Created Result menu role for District Admin (visible, view-only).");
  } else if (role.status) {
    console.log("Result menu is already visible to District Admin — nothing to do.");
  } else {
    role.status = true;
    await role.save();
    console.log(`Result menu is now visible to District Admin (add=${role.add}, update=${role.update}, delete=${role.delete}).`);
  }

  await mongoose.disconnect();
})().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
