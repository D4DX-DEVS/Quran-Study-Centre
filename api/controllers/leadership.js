const { default: mongoose } = require("mongoose");
const LeadershipState = require("../models/leadershipState");
const LeadershipDistrict = require("../models/leadershipDistrict");
const LeadershipArea = require("../models/leadershipArea");

// =========================================================
// STATE LEADERSHIP (singleton document)
// =========================================================

// @desc      GET State Leadership
// @route     GET /api/v1/leadership/state
// @access    public
exports.getState = async (req, res) => {
  try {
    const doc = await LeadershipState.findOne({}).lean();
    res.status(200).json({ success: true, message: "Retrieved State Leadership", response: doc || {} });
  } catch (err) {
    console.log(err);
    res.status(400).json({ success: false, message: err.toString() });
  }
};

const STATE_ROLES = ["director", "coordinator1", "coordinator2"];

// @desc      UPDATE State Leadership (upsert)
// @route     PUT /api/v1/leadership/state
// @access    protect
exports.updateState = async (req, res) => {
  try {
    const body = req.body || {};
    const set = {};

    STATE_ROLES.forEach((role) => {
      const nameKey = `${role}Name`;
      const positionKey = `${role}Position`;
      const photoKey = `${role}Photo`;
      const removeKey = `remove${role.charAt(0).toUpperCase() + role.slice(1)}Photo`;

      if (body[nameKey] !== undefined) set[`${role}.name`] = body[nameKey];
      if (body[positionKey] !== undefined) set[`${role}.position`] = body[positionKey];

      const shouldRemove = body[removeKey] === true || body[removeKey] === "true";
      if (body[photoKey]) {
        set[`${role}.photo`] = body[photoKey];
      } else if (shouldRemove) {
        set[`${role}.photo`] = "";
      }
    });

    const doc = await LeadershipState.findOneAndUpdate({}, { $set: set }, { new: true, upsert: true, setDefaultsOnInsert: true });

    res.status(200).json({ success: true, message: "State Leadership updated successfully", data: doc });
  } catch (err) {
    console.log(err);
    res.status(400).json({ success: false, message: err.toString() });
  }
};

// =========================================================
// DISTRICT COORDINATORS
// =========================================================

// @desc      ADD Leadership District
// @route     POST /api/v1/leadership/districts
// @access    protect
exports.addDistrict = async (req, res) => {
  try {
    const response = await LeadershipDistrict.create(req.body);
    res.status(200).json({ success: true, message: "District added successfully", response });
  } catch (err) {
    console.log(err);
    res.status(400).json({ success: false, message: err.toString() });
  }
};

// @desc      GET Leadership Districts
// @route     GET /api/v1/leadership/districts
// @access    public
exports.getDistricts = async (req, res) => {
  try {
    const { id, skip, limit } = req.query;

    if (id && mongoose.isValidObjectId(id)) {
      const response = await LeadershipDistrict.findById(id).lean();
      return res.status(200).json({ success: true, message: "Retrieved specific District", response });
    }

    const [totalCount, data] = await Promise.all([
      LeadershipDistrict.countDocuments(),
      LeadershipDistrict.find({})
        .skip(parseInt(skip) || 0)
        .limit(parseInt(limit) || 100)
        .sort({ districtName: 1 })
        .lean(),
    ]);

    res.status(200).json({ success: true, message: "Retrieved all Leadership Districts", response: data, count: data.length, totalCount: totalCount || 0 });
  } catch (err) {
    console.log(err);
    res.status(400).json({ success: false, message: err.toString() });
  }
};

// @desc      UPDATE Leadership District
// @route     PUT /api/v1/leadership/districts
// @access    protect
exports.updateDistrict = async (req, res) => {
  try {
    const { id, ...update } = req.body;
    const response = await LeadershipDistrict.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    if (!response) {
      return res.status(404).json({ success: false, message: "District not found" });
    }
    res.status(200).json({ success: true, message: "District updated successfully", response });
  } catch (err) {
    console.log(err);
    res.status(400).json({ success: false, message: err.toString() });
  }
};

// @desc      DELETE Leadership District
// @route     DELETE /api/v1/leadership/districts
// @access    protect
exports.deleteDistrict = async (req, res) => {
  try {
    const { id } = req.query;
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Valid district id is required." });
    }
    const response = await LeadershipDistrict.findByIdAndDelete(id);
    if (!response) {
      return res.status(404).json({ success: false, message: "District not found" });
    }
    res.status(200).json({ success: true, message: "District deleted successfully", response });
  } catch (err) {
    console.log(err);
    res.status(400).json({ success: false, message: err.toString() });
  }
};

// =========================================================
// AREA COORDINATORS
// =========================================================

// @desc      ADD Leadership Area
// @route     POST /api/v1/leadership/areas
// @access    protect
exports.addArea = async (req, res) => {
  try {
    const response = await LeadershipArea.create(req.body);
    res.status(200).json({ success: true, message: "Area added successfully", response });
  } catch (err) {
    console.log(err);
    res.status(400).json({ success: false, message: err.toString() });
  }
};

// @desc      GET Leadership Areas
// @route     GET /api/v1/leadership/areas
// @access    public
exports.getAreas = async (req, res) => {
  try {
    const { id, skip, limit } = req.query;

    if (id && mongoose.isValidObjectId(id)) {
      const response = await LeadershipArea.findById(id).lean();
      return res.status(200).json({ success: true, message: "Retrieved specific Area", response });
    }

    const [totalCount, data] = await Promise.all([
      LeadershipArea.countDocuments(),
      LeadershipArea.find({})
        .skip(parseInt(skip) || 0)
        .limit(parseInt(limit) || 100)
        .sort({ areaName: 1 })
        .lean(),
    ]);

    res.status(200).json({ success: true, message: "Retrieved all Leadership Areas", response: data, count: data.length, totalCount: totalCount || 0 });
  } catch (err) {
    console.log(err);
    res.status(400).json({ success: false, message: err.toString() });
  }
};

// @desc      UPDATE Leadership Area
// @route     PUT /api/v1/leadership/areas
// @access    protect
exports.updateArea = async (req, res) => {
  try {
    const { id, ...update } = req.body;
    const response = await LeadershipArea.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    if (!response) {
      return res.status(404).json({ success: false, message: "Area not found" });
    }
    res.status(200).json({ success: true, message: "Area updated successfully", response });
  } catch (err) {
    console.log(err);
    res.status(400).json({ success: false, message: err.toString() });
  }
};

// @desc      DELETE Leadership Area
// @route     DELETE /api/v1/leadership/areas
// @access    protect
exports.deleteArea = async (req, res) => {
  try {
    const { id } = req.query;
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Valid area id is required." });
    }
    const response = await LeadershipArea.findByIdAndDelete(id);
    if (!response) {
      return res.status(404).json({ success: false, message: "Area not found" });
    }
    res.status(200).json({ success: true, message: "Area deleted successfully", response });
  } catch (err) {
    console.log(err);
    res.status(400).json({ success: false, message: err.toString() });
  }
};
