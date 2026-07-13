// Seed the "Exam Center Stickers" SUB-menu entry, nested under the same
// parent Menu as the existing Attendance Register / Hall Ticket / Question
// Papers items ("Register and Student") — so it shows up alongside them
// instead of appearing as a separate top-level Menu item.
//
// Mirrors api/scripts/seed-material-access-menu.js: finds a sibling SubMenu
// by `element`, copies its real `menu` (parent) reference and `menuGroup`
// sub-section instead of guessing a label, and grants access to whichever
// UserTypes already have access to that sibling (so visibility mirrors it
// exactly, instead of guessing role names).
//
// Idempotent — safe to re-run.
//
// Usage:
//   cd qsc-automation-api
//   node scripts/seed-exam-center-stickers-menu.js

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "config", ".env") });
if (!process.env.MONGO_URI) require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const SubMenu = require("../models/subMenu");
const SubMenuRole = require("../models/subMenuRole");

const ELEMENT = "exam-center-stickers";
// Tried in order — whichever exists first as a real SubMenu determines the
// parent Menu + sub-group this new item nests under.
const SIBLING_ELEMENTS = ["exam-center-attendance", "hall-ticket", "old-question-papers", "exam-registration", "rank-list"];

(async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not set. Aborting.");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to Mongo.\n");

  let sibling = null;
  for (const el of SIBLING_ELEMENTS) {
    sibling = await SubMenu.findOne({ element: el });
    if (sibling) break;
  }
  if (!sibling) {
    console.error(
      `None of the candidate sibling sub-menus (${SIBLING_ELEMENTS.join(", ")}) were found — can't determine the parent menu/group. Aborting without guessing.`
    );
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`Sibling found: "${sibling.label}" (menu=${sibling.menu}, group="${sibling.menuGroup}")`);

  let subMenu = await SubMenu.findOne({ element: ELEMENT });
  if (subMenu) {
    console.log(`Sub-menu already exists: ${subMenu.label} (${subMenu._id})`);
  } else {
    const lastInGroup = await SubMenu.findOne({ menu: sibling.menu, menuGroup: sibling.menuGroup }).sort({ sequence: -1 });
    subMenu = await SubMenu.create({
      label: "Exam Center Stickers",
      sequence: (lastInGroup?.sequence || sibling.sequence || 0) + 1,
      menu: sibling.menu,
      icon: "printer",
      status: true,
      isLink: false,
      path: "/exam-center-stickers",
      element: ELEMENT,
      menuGroup: sibling.menuGroup,
    });
    console.log(`Sub-menu created: ${subMenu.label} (${subMenu._id})`);
  }

  const siblingRoles = await SubMenuRole.find({ subMenu: sibling._id }).populate("userType", "role");
  console.log(`\nRoles with access to "${sibling.label}": ${siblingRoles.map((r) => r.userType?.role).join(", ") || "(none)"}\n`);

  for (const siblingRole of siblingRoles) {
    if (!siblingRole.userType) continue;
    const exists = await SubMenuRole.findOne({ subMenu: subMenu._id, userType: siblingRole.userType._id });
    if (exists) {
      console.log(`  ${siblingRole.userType.role} -> ${subMenu.label} (already granted)`);
      continue;
    }
    await SubMenuRole.create({
      subMenu: subMenu._id,
      userType: siblingRole.userType._id,
      status: true,
      add: false,
      update: false,
      delete: false,
      export: true,
    });
    console.log(`  Granted ${siblingRole.userType.role} -> ${subMenu.label}`);
  }

  await mongoose.disconnect();
  console.log("\nDone.");
})().catch(async (err) => {
  console.error("Seed failed:", err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
