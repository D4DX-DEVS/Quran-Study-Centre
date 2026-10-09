// Seed the admin "Model Question & Answer Key" entry (the screen where admins
// upload model question papers and answer keys) next to the existing Question
// Bank entry, and give it to exactly the roles that already have the Question
// Bank — so visibility mirrors it instead of guessing role names.
//
// Works whether the Question Bank is a top-level Menu or a SubMenu.
// Idempotent — safe to re-run. Only inserts; never edits or deletes.
//
// Usage:
//   cd api
//   node scripts/seed-model-question-menu.js

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "config", ".env") });
if (!process.env.MONGO_URI) require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const Menu = require("../models/menu");
const MenuRole = require("../models/menuRole");
const SubMenu = require("../models/subMenu");
const SubMenuRole = require("../models/subMenuRole");

const ELEMENT = "model-question-papers";
const SIBLING_ELEMENT = "old-question-papers"; // the Question Bank

(async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not set. Aborting.");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to Mongo.\n");

  const siblingSub = await SubMenu.findOne({ element: SIBLING_ELEMENT });
  const siblingMenu = siblingSub ? null : await Menu.findOne({ element: SIBLING_ELEMENT });
  if (!siblingSub && !siblingMenu) {
    console.error(`Could not find the Question Bank entry (element "${SIBLING_ELEMENT}"). Aborting without guessing.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  if (siblingSub) {
    console.log(`Question Bank is a sub-menu: "${siblingSub.label}" (menu=${siblingSub.menu}, group="${siblingSub.menuGroup}")`);
    let subMenu = await SubMenu.findOne({ element: ELEMENT });
    if (subMenu) {
      console.log(`Sub-menu already exists: ${subMenu.label} (${subMenu._id})`);
    } else {
      subMenu = await SubMenu.create({
        label: "Model Question & Answer Key",
        sequence: (siblingSub.sequence || 0) + 1,
        menu: siblingSub.menu,
        icon: siblingSub.icon || "old-question-papers",
        status: true,
        isLink: false,
        path: "/model-question-papers",
        element: ELEMENT,
        menuGroup: siblingSub.menuGroup,
      });
      console.log(`Sub-menu created: ${subMenu.label} (${subMenu._id})`);
    }

    const siblingRoles = await SubMenuRole.find({ subMenu: siblingSub._id }).populate("userType", "role");
    for (const siblingRole of siblingRoles) {
      if (!siblingRole.userType) continue;
      const exists = await SubMenuRole.findOne({ subMenu: subMenu._id, userType: siblingRole.userType._id });
      if (exists) {
        console.log(`  ${siblingRole.userType.role}: already granted`);
        continue;
      }
      await SubMenuRole.create({
        subMenu: subMenu._id,
        userType: siblingRole.userType._id,
        status: siblingRole.status,
        add: siblingRole.add,
        update: siblingRole.update,
        delete: siblingRole.delete,
        export: siblingRole.export,
      });
      console.log(`  ${siblingRole.userType.role}: granted`);
    }
  } else {
    console.log(`Question Bank is a menu: "${siblingMenu.label}" (group="${siblingMenu.menuGroup}")`);
    let menu = await Menu.findOne({ element: ELEMENT });
    if (menu) {
      console.log(`Menu already exists: ${menu._id} (${menu.label})`);
    } else {
      menu = await Menu.create({
        label: "Model Question & Answer Key",
        sequence: (siblingMenu.sequence || 0) + 1,
        icon: siblingMenu.icon,
        status: true,
        isLink: false,
        path: "/model-question-papers",
        element: ELEMENT,
        hideMenu: false,
        hideHeader: false,
        showInMenu: true,
        menuGroup: siblingMenu.menuGroup,
      });
      console.log(`Menu created: ${menu._id} (${menu.label})`);
    }

    const siblingRoles = await MenuRole.find({ menu: siblingMenu._id }).populate("userType", "role");
    for (const siblingRole of siblingRoles) {
      if (!siblingRole.userType) continue;
      const exists = await MenuRole.findOne({ menu: menu._id, userType: siblingRole.userType._id });
      if (exists) {
        console.log(`  ${siblingRole.userType.role}: already granted`);
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
      console.log(`  ${siblingRole.userType.role}: granted`);
    }
  }

  await mongoose.disconnect();
  console.log("\nDone. Uploads are Admin-only on the API regardless of who can see the menu.");
})().catch(async (err) => {
  console.error("Seed failed:", err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
