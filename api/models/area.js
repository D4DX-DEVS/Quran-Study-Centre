const mongoose = require("mongoose");
const { type } = require("os");

const AreaSchema = new mongoose.Schema({
  district: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "District",
  },
  area: {
    type: String,
  },
});

// Auto-provision a Material Access password for every new area. Wrapped so a
// failure here never blocks area creation itself.
AreaSchema.post("save", async function (doc) {
  try {
    const MaterialAccess = mongoose.model("MaterialAccess");
    const existing = await MaterialAccess.findOne({ area: doc._id });
    if (existing) return;

    const District = mongoose.model("District");
    const district = await District.findById(doc.district).lean();

    let password;
    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = MaterialAccess.generatePassword(district?.district, doc.area);
      const taken = await MaterialAccess.findOne({ password: candidate });
      if (!taken) {
        password = candidate;
        break;
      }
    }
    if (!password) return;

    await MaterialAccess.create({ area: doc._id, district: doc.district, password });
  } catch (err) {
    console.error("Failed to auto-provision material access for area:", err);
  }
});

module.exports = mongoose.model("Area", AreaSchema);
