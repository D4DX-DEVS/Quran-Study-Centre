// Seed the "Area Admin Passwords" (Material Access) SUB-menu entry, nested
// under the same parent Menu as the existing "Attendance" (exam-center-
// attendance) item, in the same "Attendance & Reports" sub-group — so it
// shows up next to Attendance/Rank List under Registered Students, not as
// a separate top-level Menu item. Uses a distinct label so it doesn't clash
// with the existing "Attendance" sub-menu label.
//
// Grants access to whichever UserTypes already have access to the sibling
// "Attendance" sub-menu (so visibility mirrors that item exactly, instead
// of guessing role names). Actual row-level data scoping (which district's
// areas a caller can see/edit) is still enforced server-side in
// controllers/materialAccess.js regardless of who can see this menu link.
//
// Idempotent — safe to re-run.
//
// Usage:
//   cd qsc-automation-api
//   node scripts/seed-material-access-menu.js

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "config", ".env") });
if (!process.env.MONGO_URI) require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const SubMenu = require("../models/subMenu");
const SubMenuRole = require("../models/subMenuRole");

const ELEMENT = "material-access";
const SIBLING_ELEMENT = "exam-center-attendance";

(async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not set. Aborting.");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to Mongo.\n");

  const sibling = await SubMenu.findOne({ element: SIBLING_ELEMENT });
  if (!sibling) {
    console.error(`Sibling sub-menu "${SIBLING_ELEMENT}" not found — can't determine parent menu/group. Aborting.`);
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
      label: "Area Admin Passwords",
      sequence: (lastInGroup?.sequence || sibling.sequence || 0) + 1,
      menu: sibling.menu,
      icon: "password",
      status: true,
      isLink: false,
      path: ELEMENT,
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
      update: true,
      delete: false,
      export: false,
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
