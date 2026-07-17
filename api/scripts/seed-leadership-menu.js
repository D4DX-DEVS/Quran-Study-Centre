// Seed the "Leadership" TOP-LEVEL menu entry in the "Website & Content"
// sidebar group, next to "Landing Page Settings".
//
// Note: the admin sidebar renders top-level Menu docs grouped by `menuGroup`
// (the old "About QSC" Menu and its orphaned "About Us" SubMenu are disabled
// legacy rows — About editing now lives inside Landing Page Settings), so
// Leadership is created as a Menu, not a SubMenu.
//
// Grants access to whichever UserTypes already have access to the sibling
// "Landing Page Settings" menu (element: floating-menu-settings), so
// visibility mirrors that item exactly. Mutation auth is still enforced
// server-side by the `protect` middleware in routes/leadership.js regardless
// of who can see this menu link.
//
// Also removes the stray "Leadership" SubMenu (and its role grants) if an
// earlier run created one under the dead legacy parent.
//
// Idempotent — safe to re-run.
//
// Usage:
//   cd api
//   node scripts/seed-leadership-menu.js

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "config", ".env") });
if (!process.env.MONGO_URI) require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const Menu = require("../models/menu");
const MenuRole = require("../models/menuRole");
const SubMenu = require("../models/subMenu");
const SubMenuRole = require("../models/subMenuRole");
require("../models/userTypes"); // registers UserType for .populate()

const ELEMENT = "leadership";
const SIBLING_ELEMENT = "floating-menu-settings";

(async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not set. Aborting.");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to Mongo.\n");

  // Clean up the stray SubMenu a previous version of this script created
  // under the dead legacy "About QSC" parent.
  const straySubMenu = await SubMenu.findOne({ element: ELEMENT });
  if (straySubMenu) {
    const removedRoles = await SubMenuRole.deleteMany({ subMenu: straySubMenu._id });
    await SubMenu.deleteOne({ _id: straySubMenu._id });
    console.log(`Removed stray Leadership SubMenu (${straySubMenu._id}) and ${removedRoles.deletedCount} role grant(s).`);
  }

  const sibling = await Menu.findOne({ element: SIBLING_ELEMENT });
  if (!sibling) {
    console.error(`Sibling menu "${SIBLING_ELEMENT}" not found — can't determine menu group. Aborting.`);
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`Sibling found: "${sibling.label}" (group="${sibling.menuGroup}", sequence=${sibling.sequence})`);

  let menu = await Menu.findOne({ element: ELEMENT });
  if (menu) {
    console.log(`Menu already exists: ${menu.label} (${menu._id})`);
  } else {
    menu = await Menu.create({
      label: "Leadership",
      sequence: (sibling.sequence || 0) + 1,
      icon: "user",
      status: true,
      isLink: false,
      path: "/leadership",
      hideMenu: false,
      hideHeader: false,
      showInMenu: true,
      element: ELEMENT,
      menuGroup: sibling.menuGroup,
    });
    console.log(`Menu created: ${menu.label} (${menu._id})`);
  }

  const siblingRoles = await MenuRole.find({ menu: sibling._id }).populate("userType", "role");
  console.log(`\nRoles with access to "${sibling.label}": ${siblingRoles.map((r) => r.userType?.role).join(", ") || "(none)"}\n`);

  for (const siblingRole of siblingRoles) {
    if (!siblingRole.userType) continue;
    const exists = await MenuRole.findOne({ menu: menu._id, userType: siblingRole.userType._id });
    if (exists) {
      console.log(`  ${siblingRole.userType.role} -> ${menu.label} (already granted)`);
      continue;
    }
    await MenuRole.create({
      menu: menu._id,
      userType: siblingRole.userType._id,
      status: siblingRole.status,
      add: siblingRole.add,
      update: siblingRole.update,
      delete: siblingRole.delete,
      export: siblingRole.export,
    });
    console.log(`  Granted ${siblingRole.userType.role} -> ${menu.label}`);
  }

  await mongoose.disconnect();
  console.log("\nDone.");
})().catch(async (err) => {
  console.error("Seed failed:", err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
