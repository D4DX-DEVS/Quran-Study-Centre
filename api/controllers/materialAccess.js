const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const MaterialAccess = require("../models/materialAccess");
const ExamRegistration = require("../models/examRegistration");

// Simple in-memory per-IP rate limit for the public verify endpoint — the
// password space is only 4 characters, so this needs to slow down guessing.
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attemptsByIp = new Map();

const isRateLimited = (ip) => {
  const now = Date.now();
  const entry = attemptsByIp.get(ip);
  if (!entry || now - entry.windowStart > ATTEMPT_WINDOW_MS) {
    attemptsByIp.set(ip, { windowStart: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
};

// @desc     List Material Access rows — state admin sees all, district admin scoped.
// @route    GET /api/v1/material-access
// @access   protected
exports.getList = async (req, res) => {
  try {
    const { skip, limit, id } = req.query;

    if (id && mongoose.Types.ObjectId.isValid(id)) {
      const record = await MaterialAccess.findById(id).populate("area", "area").populate("district", "district");
      return res.status(200).json({ success: true, message: "Retrieved specific material access", response: record });
    }

    const filter = { ...(req.filter || {}) };
    if (req.user?.districts) filter.district = req.user.districts;

    const matchStage = {};
    if (filter.district && mongoose.Types.ObjectId.isValid(filter.district)) {
      matchStage.district = new mongoose.Types.ObjectId(String(filter.district));
    }
    if (filter.area && mongoose.Types.ObjectId.isValid(filter.area)) {
      matchStage.area = new mongoose.Types.ObjectId(String(filter.area));
    }

    // District/Area names only exist on the referenced documents, not this
    // one, so sorting by them needs a $lookup — a plain .find().sort() can't
    // order by a populated field.
    const pipeline = [
      { $match: matchStage },
      { $lookup: { from: "districts", localField: "district", foreignField: "_id", as: "district" } },
      { $unwind: { path: "$district", preserveNullAndEmptyArrays: true } },
      { $lookup: { from: "areas", localField: "area", foreignField: "_id", as: "area" } },
      { $unwind: { path: "$area", preserveNullAndEmptyArrays: true } },
      { $sort: { "district.district": 1, "area.area": 1 } },
    ];

    const skipNum = parseInt(skip) || 0;
    const limitNum = parseInt(limit) || 0;
    const pagedPipeline = [...pipeline];
    if (skipNum > 0) pagedPipeline.push({ $skip: skipNum });
    if (limitNum > 0) pagedPipeline.push({ $limit: limitNum });

    const [totalCount, filterCount, data] = await Promise.all([
      skipNum === 0 ? MaterialAccess.countDocuments() : 0,
      skipNum === 0 ? MaterialAccess.countDocuments(matchStage) : 0,
      MaterialAccess.aggregate(pagedPipeline),
    ]);

    res.status(200).json({
      success: true,
      message: "Retrieved material access list",
      response: data,
      count: data.length,
      totalCount: totalCount || 0,
      filterCount: filterCount || 0,
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc     Update (or regenerate) one area's password.
// @route    PUT /api/v1/material-access  (body: { id, password } or { id, regenerate: true })
// @access   protected (district admin: own district only; state admin: any)
exports.updatePassword = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, message: "id is required" });
    }
    const record = await MaterialAccess.findById(id).populate("area", "area").populate("district", "district");
    if (!record) {
      return res.status(404).json({ success: false, message: "Material access record not found" });
    }

    if (req.user?.districts && String(record.district?._id) !== String(req.user.districts)) {
      return res.status(403).json({ success: false, message: "Not authorized to edit this area's password" });
    }

    if (req.body.regenerate) {
      let password;
      for (let attempt = 0; attempt < 20; attempt++) {
        const candidate = MaterialAccess.generatePassword(record.district?.district, record.area?.area);
        const taken = await MaterialAccess.findOne({ password: candidate, _id: { $ne: record._id } });
        if (!taken) {
          password = candidate;
          break;
        }
      }
      if (!password) {
        return res.status(400).json({ success: false, message: "Could not generate a unique password, try again" });
      }
      record.password = password;
    } else if (req.body.password) {
      const desired = String(req.body.password).trim().toUpperCase();
      const taken = await MaterialAccess.findOne({ password: desired, _id: { $ne: record._id } });
      if (taken) {
        return res.status(400).json({ success: false, message: "That password is already in use by another area" });
      }
      record.password = desired;
    } else {
      return res.status(400).json({ success: false, message: "Provide either password or regenerate" });
    }

    await record.save();
    res.status(200).json({ success: true, message: "Password updated", response: record });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc     Verify an area's material password (no login required).
// @route    POST /api/v1/material-access/verify
// @access   public
exports.verify = async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress || "unknown";
    if (isRateLimited(ip)) {
      return res.status(429).json({ success: false, message: "Too many attempts. Try again later." });
    }

    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, message: "Password is required" });
    }

    const record = await MaterialAccess.findOne({ password: String(password).trim().toUpperCase() })
      .populate("area", "area")
      .populate("district", "district");

    if (!record) {
      return res.status(401).json({ success: false, message: "Incorrect password" });
    }

    const token = jwt.sign(
      { areaId: record.area._id, districtId: record.district._id, scope: "material-access" },
      process.env.JWT_SECRET,
      { expiresIn: "45m" }
    );

    res.status(200).json({
      success: true,
      message: "Verified",
      response: {
        token,
        area: record.area?.area,
        district: record.district?.district,
        expiresIn: 45 * 60,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc     Attendance + exam centers for the verified area only.
// @route    GET /api/v1/material-access/attendance
// @access   protected (material-access scoped token — see protectMaterialAccess)
exports.getAttendance = async (req, res) => {
  try {
    const areaId = req.materialArea;
    if (!areaId || !mongoose.Types.ObjectId.isValid(areaId)) {
      return res.status(400).json({ success: false, message: "Invalid area" });
    }

    const data = await ExamRegistration.find({ area: areaId })
      .populate("district", "district")
      .populate("area", "area")
      .populate("centerRegistration", "nameOfCenter centerCode")
      .populate("assignedExamCenter", "nameOfCenter centerCode district")
      .populate("examCenter", "centerName")
      .populate("outsideExamCenter", "centerName")
      .populate("examDistrict", "district")
      .populate("nameOfExamAppearingNow", "examType");

    const centerNames = new Set();
    data.forEach((item) => {
      const name = item.centerRegistration?.nameOfCenter || item.assignedExamCenter?.nameOfCenter;
      if (name) centerNames.add(name);
    });

    res.status(200).json({
      success: true,
      message: "Attendance for area retrieved successfully",
      response: data,
      centers: Array.from(centerNames),
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: err.message });
  }
};
