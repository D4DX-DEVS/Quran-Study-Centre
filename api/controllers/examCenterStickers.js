const mongoose = require("mongoose");
const ExamRegistration = require("../models/examRegistration");
const District = require("../models/district");
const Area = require("../models/area");
const CenterRegistration = require("../models/centerRegistration");

const INCOMPLETE_REGNO_MESSAGE = "Attendance Register numbers have not been generated for this Exam Center.";

const toObjectId = (val) => (mongoose.Types.ObjectId.isValid(val) ? val : null);

// centerregistrations occasionally has duplicate docs for the same physical
// exam centre — same nameOfCenter/district/area, different _id (data-entry
// artifact, same root cause fixed in exam-registration/consolidation-report).
// Left unresolved, that split every downstream count/regno-range/sticker in
// two. This builds rawCenterId -> canonical-group lookup so every place that
// keys off a center id treats the duplicates as one centre. Queried fresh
// per request (small collection, hundreds of rows — no staleness risk from
// caching worth the complexity).
const buildCentreCanonicalMap = async () => {
  const centers = await CenterRegistration.find({}).select("_id nameOfCenter centerCode district area").sort({ _id: 1 }).lean();
  const groups = new Map();
  for (const c of centers) {
    const key = `${c.district || ""}|${c.area || ""}|${(c.nameOfCenter || "").trim().toLowerCase()}`;
    if (!groups.has(key)) {
      groups.set(key, {
        canonicalId: String(c._id),
        nameOfCenter: c.nameOfCenter || "",
        centerCode: c.centerCode || "",
        memberIds: [],
      });
    }
    groups.get(key).memberIds.push(String(c._id));
  }

  const idToGroup = new Map();
  for (const group of groups.values()) {
    for (const id of group.memberIds) idToGroup.set(id, group);
  }
  return idToGroup;
};

// Same district/area scoping shape as getAttendanceSheet / getRegisteredStudentsList
// (api/controllers/examRegistration.js) — directly on ExamRegistration's own
// district/area fields, District Admins pinned to req.user.districts.
const buildScopedQuery = (req) => {
  const { district, area } = req.query;
  const query = {};
  if (req.user?.districts) {
    query.district = req.user.districts;
  } else if (district && toObjectId(district)) {
    query.district = district;
  }
  if (area && toObjectId(area)) {
    query.area = area;
  }
  return query;
};

// Fetches + dedupes exam registrations with the exact same query shape,
// populate list, and per-mobile-number dedup rule as getRegisteredStudentsList
// — so Stickers reports the same population that page already shows
// correctly, instead of re-deriving scoping/grouping independently.
const fetchScopedRegistrations = async (req, extraFilter = {}) => {
  const query = { ...buildScopedQuery(req), ...extraFilter };

  const data = await ExamRegistration.find(query)
    .populate("district", "district")
    .populate("area", "area")
    .populate("centerRegistration", "nameOfCenter centerCode")
    .populate("assignedExamCenter", "nameOfCenter centerCode")
    .populate("nameOfExamAppearingNow", "examType examShortName sortOrder")
    .select("nameOfApplicant regno mobileNumber status gender centerRegistration assignedExamCenter area district nameOfExamAppearingNow")
    .sort({ nameOfApplicant: 1 })
    .lean();

  // Same one-row-per-mobile-number dedup as getRegisteredStudentsList, but
  // when two rows share a mobile (an accidental resubmission), prefer
  // whichever one actually HAS a register number over an arbitrary
  // "first encountered" pick — otherwise a real regno on a duplicate row
  // can get silently discarded in favor of a blank duplicate, wrongly
  // flagging a fully-complete exam center as incomplete.
  const byMobile = new Map();
  const noMobileRows = [];
  for (const d of data) {
    const mobile = d.mobileNumber;
    if (!mobile) {
      noMobileRows.push(d);
      continue;
    }
    const existing = byMobile.get(mobile);
    if (!existing || (!existing.regno && d.regno)) {
      byMobile.set(mobile, d);
    }
  }
  return [...byMobile.values(), ...noMobileRows];
};

// centerRegistration (home study centre) first, NOT assignedExamCenter.
// examAllocation.js's clubbing merges a small centre "into the nearest
// centre in the same DISTRICT" — that can cross area boundaries, so a
// clubbed student's assignedExamCenter can sit in a different area than
// their own. centerRegistration is always the centre actually located in
// that student's own area (CenterRegistration.area), so it's the only field
// that keeps every exam center correctly grouped under its real area.
// assignedExamCenter is only a fallback for a record with no home centre.
const resolveRawCentre = (d) => d.centerRegistration || d.assignedExamCenter || null;

// Same as resolveRawCentre, but collapsed through the canonical-group map so
// two centerregistrations docs for the same physical centre (see
// buildCentreCanonicalMap above) resolve to one shared id/name/code instead
// of splitting the centre's students, exams and sticker across two entries.
const resolveExamCentre = (d, canonicalMap) => {
  const raw = resolveRawCentre(d);
  if (!raw?._id) return null;
  const group = canonicalMap.get(String(raw._id));
  return group
    ? { _id: group.canonicalId, nameOfCenter: group.nameOfCenter, centerCode: group.centerCode }
    : { _id: String(raw._id), nameOfCenter: raw.nameOfCenter || "", centerCode: raw.centerCode || "" };
};

// Groups already-deduped registration rows into one sticker entry per exam
// centre, with an exam-wise register-number range/count breakdown.
const groupByExamCentre = (rows, canonicalMap) => {
  const byCenter = new Map();

  for (const d of rows) {
    const centre = resolveExamCentre(d, canonicalMap);
    if (!centre?._id) continue; // no exam centre at all — nothing to attribute this row to

    const centerKey = String(centre._id);
    if (!byCenter.has(centerKey)) {
      byCenter.set(centerKey, {
        examCenterId: centerKey,
        examCenterName: centre.nameOfCenter || "",
        centerCode: centre.centerCode || "",
        district: d.district?.district || "",
        districtId: d.district?._id ? String(d.district._id) : "",
        area: d.area?.area || "",
        areaId: d.area?._id ? String(d.area._id) : "",
        totalStudents: 0,
        hasIncompleteRegno: false,
        examMap: new Map(),
      });
    }

    const entry = byCenter.get(centerKey);
    entry.totalStudents += 1;

    const examId = d.nameOfExamAppearingNow?._id ? String(d.nameOfExamAppearingNow._id) : "unassigned";
    if (!entry.examMap.has(examId)) {
      entry.examMap.set(examId, {
        examName: d.nameOfExamAppearingNow?.examShortName || d.nameOfExamAppearingNow?.examType || "Unassigned",
        sortOrder: d.nameOfExamAppearingNow?.sortOrder ?? 0,
        regnos: [],
        studentCount: 0,
      });
    }

    const examEntry = entry.examMap.get(examId);
    examEntry.studentCount += 1;
    if (d.regno) {
      examEntry.regnos.push(d.regno);
    } else {
      entry.hasIncompleteRegno = true;
    }
  }

  for (const entry of byCenter.values()) {
    entry.exams = [...entry.examMap.values()]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((e) => {
        const sortedRegnos = [...e.regnos].sort();
        return {
          examName: e.examName,
          regnoFrom: sortedRegnos[0] || "",
          regnoTo: sortedRegnos[sortedRegnos.length - 1] || "",
          studentCount: e.studentCount,
        };
      });
    delete entry.examMap;
  }

  return byCenter;
};

// @desc     Cascading filter data for Exam Center Stickers (District -> Area -> Exam Center).
// @route    GET /api/v1/exam-center-stickers/select
// @access   protected (state admin: all; district admin: own district only)
exports.getFilterOptions = async (req, res) => {
  try {
    // District Admin is pinned to their own district everywhere. State Admin's
    // district dropdown must always list every district — it should not
    // collapse to whatever is currently selected, only Area/Exam Center cascade
    // off that selection.
    const adminDistrictId = req.user?.districts ? String(req.user.districts) : null;
    const selectedDistrictId = req.query.district && toObjectId(req.query.district) ? req.query.district : null;
    const scopeDistrictId = adminDistrictId || selectedDistrictId;

    const districts = adminDistrictId
      ? await District.find({ _id: adminDistrictId }).select("_id district").lean()
      : await District.find({}).select("_id district").lean();

    const areas = scopeDistrictId ? await Area.find({ district: scopeDistrictId }).select("_id area").lean() : [];

    let examCenters = [];
    if (scopeDistrictId) {
      const [rows, canonicalMap] = await Promise.all([fetchScopedRegistrations(req), buildCentreCanonicalMap()]);
      const seen = new Map();
      rows.forEach((d) => {
        const centre = resolveExamCentre(d, canonicalMap);
        if (centre?._id) seen.set(String(centre._id), centre);
      });
      examCenters = [...seen.entries()].map(([id, c]) => ({ id, value: c.nameOfCenter, centerCode: c.centerCode }));
    }

    return res.status(200).json({
      success: true,
      response: {
        districts: districts.map((d) => ({ id: String(d._id), value: d.district })),
        areas: areas.map((a) => ({ id: String(a._id), value: a.area })),
        examCenters,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc     Sticker card-grid data — one row per exam center with assigned students.
// @route    GET /api/v1/exam-center-stickers/list
// @access   protected (state admin: all; district admin: own district only)
exports.getStickerList = async (req, res) => {
  try {
    const { examCenter } = req.query;
    const canonicalMap = await buildCentreCanonicalMap();

    const extraFilter = {};
    if (examCenter && toObjectId(examCenter)) {
      // examCenter may be any member id of a duplicate-centre group (the
      // dropdown always sends the canonical id, but match on every member
      // id in its group so nothing is missed either way) — filter on all of
      // them, not just the one id, so the merged sticker stays complete.
      const memberIds = canonicalMap.get(examCenter)?.memberIds || [examCenter];
      extraFilter.$or = [{ centerRegistration: { $in: memberIds } }, { centerRegistration: null, assignedExamCenter: { $in: memberIds } }];
    }

    const rows = await fetchScopedRegistrations(req, extraFilter);
    const byCenter = groupByExamCentre(rows, canonicalMap);

    const response = [...byCenter.values()]
      .map(({ examMap, ...entry }) => entry)
      .sort((a, b) => a.district.localeCompare(b.district) || a.area.localeCompare(b.area) || a.examCenterName.localeCompare(b.examCenterName));

    return res.status(200).json({ success: true, count: response.length, response });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc     Same shape as /list, unpaginated — used to fetch every sticker in
//           the current filter scope before building PDFs/ZIP client-side.
// @route    GET /api/v1/exam-center-stickers/export-list
// @access   protected (state admin: all; district admin: own district only)
exports.getStickerExportList = exports.getStickerList;

// @desc     Single sticker detail (preview / single PDF download).
// @route    GET /api/v1/exam-center-stickers/:examCenterId
// @access   protected (state admin: all; district admin: own district only)
exports.getStickerDetail = async (req, res) => {
  try {
    const { examCenterId } = req.params;
    if (!toObjectId(examCenterId)) {
      return res.status(400).json({ success: false, message: "Invalid exam center id" });
    }

    const canonicalMap = await buildCentreCanonicalMap();
    // Resolve to every member id of examCenterId's duplicate-centre group (if
    // any) so a sticker for a centre with two centerregistrations docs pulls
    // every student and regno, not just the half attached to this one id.
    const memberIds = canonicalMap.get(examCenterId)?.memberIds || [examCenterId];

    const extraFilter = {
      $or: [{ centerRegistration: { $in: memberIds } }, { centerRegistration: null, assignedExamCenter: { $in: memberIds } }],
    };
    const rows = await fetchScopedRegistrations(req, extraFilter);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "No students assigned to this exam center yet." });
    }

    const byCenter = groupByExamCentre(rows, canonicalMap);
    const canonicalId = canonicalMap.get(examCenterId)?.canonicalId || String(examCenterId);
    const entry = byCenter.get(canonicalId);
    if (!entry) {
      return res.status(404).json({ success: false, message: "Exam center not found" });
    }
    if (entry.hasIncompleteRegno) {
      return res.status(422).json({ success: false, customMessage: INCOMPLETE_REGNO_MESSAGE, message: INCOMPLETE_REGNO_MESSAGE });
    }

    const { examMap, ...response } = entry;
    return res.status(200).json({ success: true, response });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: err.message });
  }
};
