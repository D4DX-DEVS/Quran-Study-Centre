const ExamRegistration = require("../models/examRegistration");
const { default: mongoose } = require("mongoose");
const ExamScore = require("../models/examScore");
const { PDFDocument, StandardFonts } = require("pdf-lib");
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const path = require("path");
const fs = require("fs");
const ExamCenterRegistration = require("../models/examCenterRegistration");
const ExamType = require("../models/examtype");
const CertificateManagement = require("../models/certificateManagement");

const ExamSettings = require("../models/examSettings");
const { recomputeAllocation } = require("./examAllocation");

const s3 = new S3Client({
  endpoint: `https://${process.env.DO_SPACES_ENDPOINT}`,
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY,
    secretAccessKey: process.env.DO_SPACES_SECRET,
  },
});

// @desc      ADD EXAM  REGISTRATION
// @route     POST /api/user/exam-registration
// @access    public
// Helper function to validate English-only input
// const isEnglishText = (text) => /^[\x00-\x7F\s]+$/.test(text);
exports.addExamRegistration = async (req, res) => {
  try {
    const { regno, mobileNumber, nameOfApplicant, address, educationalQualification, age } = req.body;
    console.log(req.body);
    // Normalize mobile number by removing spaces and trimming
    const normalizedMobileNumber = Number(String(mobileNumber).replace(/\s+/g, "").trim());

    console.log(normalizedMobileNumber);
    /// Helper function to detect Malayalam characters
    const containsMalayalam = (text) => /[\u0D00-\u0D7F]/.test(text);

    // Check if the input contains Malayalam characters and return an error
    if (containsMalayalam(nameOfApplicant)) {
      return res.status(400).json({ success: false, customMessage: "The name should be typed in English only. Malayalam or other non-English characters are not allowed." });
    }

    if (containsMalayalam(address)) {
      return res.status(400).json({ success: false, customMessage: "The address should be typed in English only. Malayalam or other non-English characters are not allowed." });
    }

    if (containsMalayalam(educationalQualification)) {
      return res.status(400).json({ success: false, customMessage: "The educational qualification should be typed in English only. Malayalam or other non-English characters are not allowed." });
    }

    // Check for existing mobile number within the current exam year only.
    // Same number is allowed to register again in a future year.
    const settings = await ExamSettings.getCurrent();
    const currentYear = settings.year;
    const existingRecord = await ExamRegistration.findOne({ mobileNumber: normalizedMobileNumber, examYear: currentYear });
    console.log({ existingRecord });

    if (existingRecord) {
      return res.status(400).json({ success: false, customMessage: "This mobile number is already registered for this year." });
    }

    // Create new exam registration if no conflicts are found
    const payload = { ...req.body, mobileNumber: normalizedMobileNumber, examYear: currentYear };

    // Phase 2.1/2.2: default assigned exam centre = the student's own study centre.
    // Clubbing / ≥threshold rule runs asynchronously after save (see below).
    if (payload.centerRegistration && !payload.assignedExamCenter) {
      payload.assignedExamCenter = payload.centerRegistration;
    }

    const response = await ExamRegistration.create(payload);

    // Fire-and-forget async re-allocation for this (district, examType) bucket so
    // the ≥minCount clubbing rule stays current as new registrations arrive.
    // Intentionally NOT awaited — the applicant's response should not be held up.
    (async () => {
      try {
        const settings = await ExamSettings.getCurrent();
        if (settings.autoRecomputeOnSubmit && !settings.allocationLocked && response.district && response.nameOfExamAppearingNow) {
          await recomputeAllocation({
            district: response.district,
            examType: response.nameOfExamAppearingNow,
          });
        }
      } catch (e) {
        console.error("post-submit recompute failed:", e.message);
      }
    })();

    res.status(200).json({
      success: true,
      message: "Successfully added exam registration.",
      data: { registration: response },
    });
  } catch (err) {
    console.error(err);
    // Handle MongoDB duplicate key error (code 11000)
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: "Duplicate entry detected: This mobile number, registration number, or name already exists." });
    }
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc      GET EXAM REGISTRTAION
// @route     GET /api/v1/exam-registration
// @access    public
exports.getExamRegistration = async (req, res) => {
  try {
    const { id, skip, limit, searchkey } = req.query;

    if (id && mongoose.isValidObjectId(id)) {
      const response = await ExamRegistration.findById(id).populate("centerRegistration");
      return res.status(200).json({ success: true, message: "Retrieved specific ExamRegistration", response });
    }

    const query = {
      ...req.filter,
      ...(req.user.districts ? { district: req.user.districts } : {}),
      ...(searchkey && {
        $or: [{ nameOfApplicant: { $regex: searchkey, $options: "i" } }, { regno: { $regex: searchkey, $options: "i" } }, { mobileNumber: !isNaN(searchkey) ? parseInt(searchkey) : null }].filter((cond) => Object.values(cond)[0] !== null), // Remove conditions with null values
      }),
    };

    // Calculate counts when filters are applied or on first page load
    const shouldCalculateCounts = parseInt(skip) === 0 || Object.keys(req.filter || {}).length > 0;

    // Unlike Model.find(), Model.aggregate() does not auto-cast query values against the
    // schema, so ObjectId ref fields (district, area, etc.) coming in as plain strings from
    // req.filter must be cast manually or the $match below silently matches nothing.
    const castObjectIdFields = (obj) => {
      if (obj instanceof mongoose.Types.ObjectId) return obj;
      if (Array.isArray(obj)) return obj.map(castObjectIdFields);
      if (obj && typeof obj === "object") {
        return Object.entries(obj).reduce((acc, [key, value]) => {
          if (typeof value === "string" && mongoose.isValidObjectId(value)) {
            acc[key] = new mongoose.Types.ObjectId(value);
          } else if (value && typeof value === "object") {
            acc[key] = castObjectIdFields(value);
          } else {
            acc[key] = value;
          }
          return acc;
        }, {});
      }
      return obj;
    };
    const matchQuery = castObjectIdFields(query);

    // De-duplicate by mobileNumber (keeping the most recently added record) before
    // paginating/counting, since the registration form doesn't collect a distinguishing
    // year field and the same mobile number can end up registered more than once.
    const dedupedFiltered = await ExamRegistration.aggregate([
      { $match: matchQuery },
      { $sort: { _id: -1 } },
      // Records without a mobileNumber fall back to grouping by their own _id so they are
      // never merged with unrelated records.
      { $group: { _id: { $ifNull: ["$mobileNumber", "$_id"] }, docId: { $first: "$_id" }, gender: { $first: "$gender" } } },
    ]);
    dedupedFiltered.sort((a, b) => (a.docId < b.docId ? 1 : -1));

    const pageIds = dedupedFiltered.slice(parseInt(skip) || 0, (parseInt(skip) || 0) + (parseInt(limit) || dedupedFiltered.length)).map((d) => d.docId);

    const [totalCount, data] = await Promise.all([
      parseInt(skip) === 0 &&
        ExamRegistration.aggregate([{ $group: { _id: "$mobileNumber" } }, { $count: "count" }]).then((r) => r[0]?.count || 0),
      ExamRegistration.find({ _id: { $in: pageIds } })
        .populate("district")
        .populate("area")
        .populate("nameOfExamAppearingNow")
        .populate("examCenter")
        .populate("centerRegistration")
        .populate("examDistrict")
        .populate("outsideExamCenter")
        .select("nameOfApplicant examName examSyllabus district area nameOfExamAppearingNow examCenter centerRegistration examDistrict outsideExamCenter regno mobileNumber address educationalQualification affiliation whatsappNumber gender outsideCenter status feeDetails age"),
    ]);

    const dataById = new Map(data.map((d) => [String(d._id), d]));
    const orderedData = pageIds.map((id) => dataById.get(String(id))).filter(Boolean);

    const filterCount = shouldCalculateCounts ? dedupedFiltered.length : undefined;
    const genderCounts = shouldCalculateCounts
      ? [dedupedFiltered.filter((d) => d.gender === "Male").length, dedupedFiltered.filter((d) => d.gender === "Female").length]
      : undefined;

    const counts = shouldCalculateCounts
      ? {
          "Male Students": {
            count: genderCounts?.[0] || 0,
          },
          "Female Students": {
            count: genderCounts?.[1] || 0,
          },
          "Total Students": {
            count: filterCount || 0,
          },
        }
      : {};

    res.status(200).json({
      success: true,
      message: `Retrieved all ExamRegistration`,
      response: orderedData,
      count: orderedData.length,
      totalCount: totalCount || 0,
      filterCount: filterCount || 0,
      counts,
    });
  } catch (err) {
    console.log(err);
    res.status(400).json({ success: false, message: err.toString() });
  }
};

// @desc      UPDATE SPECIFIC EXAM REGISTRTAION
// @route     PUT /api/user/exam-registration
// @access    public
exports.updateExamRegistration = async (req, res) => {
  try {
    // Log the incoming update request
    console.log("[updateExamRegistration] Incoming update:", req.body);

    // Clear conflicting fields based on the type of center
    if (req.body.outsideExamCenter) {
      req.body.examCenter = null;
      // Preserve the student's own 'district' so it remains visible in forms and exports
      console.log("[updateExamRegistration] Switching to outsideExamCenter. Cleared examCenter; preserved district as own district.");
    }
    if (req.body.examCenter) {
      req.body.outsideExamCenter = null;
      req.body.examDistrict = null;
      console.log("[updateExamRegistration] Switching to examCenter. Cleared outsideExamCenter and examDistrict.");
    }

    const examRegistration = await ExamRegistration.findByIdAndUpdate(req.body.id, req.body, {
      new: true,
    });

    if (!examRegistration) {
      return res.status(404).json({ success: false, message: " ExamRegistration not found" });
    }

    res.status(200).json({ success: true, message: "ExamRegistration updated successfully", data: examRegistration });
  } catch (err) {
    console.log(err);
    res.status(400).json({ success: false, message: err.toString() });
  }
};

// @desc      DELETE SPECIFIC EXAM REGISTRTAION
// @route     DELETE /api/user/exam-registration
// @access    public
exports.deleteExamRegistration = async (req, res) => {
  try {
    const { id } = req.query;
    const response = await ExamRegistration.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: `deleted specific ExamRegistration`, response });
  } catch (err) {
    console.log(err);
    res.status(204).json({ success: false, message: err });
  }
};

// @desc      GET EXAM REGISTRTAION
// @route     GET /api/user/select
// @access    protect
exports.select = async (req, res) => {
  try {
    const items = await ExamRegistration.find({}, { _id: 0, id: "$_id", value: "$nameOfApplicant" });
    return res.status(200).send(items);
  } catch (err) {
    console.log(err);
    res.status(204).json({ success: false, message: err });
  }
};

// @desc      GET EXAM RESULT
// @route     GET /api/v1/exam-registration/result
// @access    public
exports.getExamResult = async (req, res) => {
  try {
    const { id, skip, limit, searchkey } = req.query;

    if (id && mongoose.isValidObjectId(id)) {
      const response = await ExamRegistration.findById(id);
      return res.status(200).json({ success: true, message: "Retrieved specific exam registration", response });
    }

    // Check if regno or mobileNumber is provided in the request query
    if (req.query.regno) {
      // Check if the input is a number (mobile number) or string (registration number)
      const isNumeric = !isNaN(req.query.regno) && !isNaN(parseFloat(req.query.regno));

      const filters = {
        $or: [{ regno: req.query.regno }, ...(isNumeric ? [{ mobileNumber: parseInt(req.query.regno) }] : [])],
        // Removed the nameOfExamAppearingNow condition
      };

      const examData = await ExamRegistration.find(filters).populate("district").populate("area").populate("nameOfExamAppearingNow").populate("examCenter").populate("centerRegistration");

      // Check if examData is empty
      if (examData.length === 0) {
        return res.status(400).json({ success: false, customMessage: "No Exam result found for the provided register number or mobile number" });
      }

      const examScore = await ExamScore.findOne({ student: examData[0]._id });

      // Phase 2.6 — attach rank (district-level, with state-level fallback).
      let enrichedResult = examScore ? examScore.toObject() : null;
      if (examScore && examData[0]?.nameOfExamAppearingNow) {
        try {
          const { computeStudentRank } = require("./rankList");
          const ranks = await computeStudentRank({
            student: examData[0]._id,
            examType: examData[0].nameOfExamAppearingNow,
          });
          if (ranks) {
            const preferred = ranks.district || ranks.state;
            if (preferred) {
              enrichedResult = {
                ...enrichedResult,
                rank: preferred.rank,
                totalCandidates: preferred.totalCandidates,
                scopeLabel: ranks.district ? "in district" : "state-wide",
                ranks,
              };
            }
          }
        } catch (rankErr) {
          console.error("rank lookup failed:", rankErr.message);
        }
      }

      // If the result is found, return the response and exit the function
      return res.status(200).json({ success: true, message: "Filtered exam result data", response: examData, result: enrichedResult, count: examData.length });
    }

    // If no regno is provided, execute the rest of the code
    const query = {
      ...req.filter,
      ...(req.user.districts ? { district: req.user.districts } : {}),
      ...(searchkey && {
        $or: [{ nameOfApplicant: { $regex: searchkey, $options: "i" } }, { regno: { $regex: searchkey, $options: "i" } }, { mobileNumber: !isNaN(searchkey) ? parseInt(searchkey) : null }].filter((cond) => Object.values(cond)[0] !== null),
      }),
    };

    const [totalCount, filterCount, data] = await Promise.all([
      parseInt(skip) === 0 && ExamRegistration.countDocuments(),
      parseInt(skip) === 0 && ExamRegistration.countDocuments(query),
      ExamRegistration.find(query)
        .populate("district")
        .populate("area")
        .populate("nameOfExamAppearingNow")
        .populate("examCenter")
        .populate("CenterRegistration")
        .skip(parseInt(skip) || 0)
        .limit(parseInt(limit) || 0)
        .sort({ _id: -1 }),
    ]);

    return res.status(200).json({ success: true, message: `Retrieved all exam result`, response: data, count: data.length, totalCount: totalCount || 0, filterCount: filterCount || 0 });
  } catch (err) {
    console.log(err);
    return res.status(400).json({ success: false, message: err.toString() });
  }
};

exports.downloadCertificate = async (req, res) => {
  try {
    const { regno } = req.query;

    if (!regno) {
      return res.status(400).json({
        success: false,
        customMessage: "Register number or mobile number is required",
      });
    }

    let examRegistration;

    // Check if the input is a mobile number (assume 10-digit numeric input for a mobile number)
    const isMobileNumber = /^[0-9]{10}$/.test(regno);

    if (isMobileNumber) {
      // If it's a mobile number, search by mobileNumber
      examRegistration = await ExamRegistration.findOne({ mobileNumber: regno }).populate("nameOfExamAppearingNow").populate("centerRegistration").populate("examCenter");
    } else {
      // If it's not a mobile number, assume it's a registration number
      examRegistration = await ExamRegistration.findOne({ regno: regno }).populate("nameOfExamAppearingNow").populate("centerRegistration").populate("examCenter");
    }

    if (!examRegistration) {
      return res.status(404).json({
        success: false,
        customMessage: "Exam registration not found",
      });
    }

    // Fetch the exam score associated with this exam registration
    const examScore = await ExamScore.findOne({
      student: examRegistration._id,
    }).populate("exam");

    if (!examScore) {
      return res.status(404).json({
        success: false,
        customMessage: "Exam score not found",
      });
    }

    // Get the certificate template from certificate management
    let certificate;
    try {
      // First try to find a record with the new certificate fields
      certificate = await CertificateManagement.findOne({
        $or: [{ stateExamCertificate: { $exists: true } }, { districtExamCertificate: { $exists: true } }],
      });

      // If no record with new fields found, get any record
      if (!certificate) {
        certificate = await CertificateManagement.findOne({});
      }

      console.log("Certificate management data:", certificate);

      // Additional debugging - check if the specific fields exist
      if (certificate) {
        console.log("Certificate fields check:", {
          hasStateExamCertificate: !!certificate.stateExamCertificate,
          hasDistrictExamCertificate: !!certificate.districtExamCertificate,
          stateExamCertificate: certificate.stateExamCertificate,
          districtExamCertificate: certificate.districtExamCertificate,
        });
      }
    } catch (error) {
      console.error("Error fetching certificate management data:", error);
      return res.status(500).json({
        success: false,
        customMessage: "Error retrieving certificate templates. Please try again.",
      });
    }

    // Check if certificate data exists
    if (!certificate) {
      console.log("No certificate management record found, creating default...");
      try {
        // Create a default certificate management record
        certificate = new CertificateManagement({
          stateExamCertificate: "uploads/certificate-management/stateExamCertificate-1759240327420.pdf",
          districtExamCertificate: "uploads/certificate-management/districtExamCertificate-1759240327441.pdf",
        });
        await certificate.save();
        console.log("Default certificate management record created:", certificate);
      } catch (createError) {
        console.error("Error creating default certificate management record:", createError);
        return res.status(500).json({
          success: false,
          customMessage: "Error setting up certificate templates. Please contact administrator.",
        });
      }
    }

    // Determine which certificate template to use based on exam level + exam category.
    // Phase 3 — the ExamType itself carries examLevel (State/District) and
    // examCategory (Regular/Private). The same candidate does not switch
    // between Regular and Private — they are registered for exactly one
    // variant of the exam — so we drive the template off the exam, not off
    // the student's status. Fall back to legacy slots, and finally to the
    // exam-name regex for pre-2026 data that lacks the new fields.
    const examTypeDoc = examRegistration.nameOfExamAppearingNow;
    const examType = examTypeDoc?.examType || "";
    const examLevel =
      examTypeDoc?.examLevel ||
      (examType.includes("Preliminary VI") || examType.includes("Secondary III") ? "State" : "District");
    const examCategory =
      examTypeDoc?.examCategory ||
      (examRegistration.status === "Private" ? "Private" : "Regular");
    const isStateCertificate = examLevel === "State";

    console.log("Certificate selection logic:", {
      examType,
      examLevel,
      examCategory,
      studentStatus: examRegistration.status,
      availableTemplates: {
        stateExamCertificate: certificate?.stateExamCertificate,
        districtExamCertificate: certificate?.districtExamCertificate,
        stateExamCertificateRegular: certificate?.stateExamCertificateRegular,
        stateExamCertificatePrivate: certificate?.stateExamCertificatePrivate,
        districtExamCertificateRegular: certificate?.districtExamCertificateRegular,
        districtExamCertificatePrivate: certificate?.districtExamCertificatePrivate,
        examCertificate: certificate?.examCertificate,
      },
    });

    let certificateTemplate;
    if (isStateCertificate) {
      certificateTemplate =
        (examCategory === "Private"
          ? certificate?.stateExamCertificatePrivate
          : certificate?.stateExamCertificateRegular) || certificate?.stateExamCertificate;
    } else {
      certificateTemplate =
        (examCategory === "Private"
          ? certificate?.districtExamCertificatePrivate
          : certificate?.districtExamCertificateRegular) || certificate?.districtExamCertificate;
    }

    // If specific template is not available, throw an error instead of falling back
    if (!certificateTemplate) {
      return res.status(404).json({
        success: false,
        customMessage: isStateCertificate
          ? `State ${examCategory} certificate template not found. Please upload a template under Certificate Management.`
          : `District ${examCategory} certificate template not found. Please upload a template under Certificate Management.`,
      });
    }

    try {
      // Use the stored path directly as the S3 key
      const getObjectParams = {
        Bucket: process.env.DO_SPACES_BUCKET,
        Key: certificateTemplate,
      };

      const { Body } = await s3.send(new GetObjectCommand(getObjectParams));
      const templateBytes = await Body.transformToByteArray();

      // Load and modify the PDF
      const pdfDoc = await PDFDocument.load(templateBytes);

      // Set document title
      const documentTitle = "QSC Certificate";
      pdfDoc.setTitle(documentTitle);

      const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];

      // Log the data we're going to draw
      console.log("Drawing certificate data:", {
        name: examRegistration.nameOfApplicant,
        examType: examRegistration.nameOfExamAppearingNow?.examType,
        grade: examScore?.grade,
        certificateType: isStateCertificate ? "State" : "District",
        templateUsed: certificateTemplate,
      });

      // Draw applicant's name (positioned on the right side of "Certified that Mr/Mrs." line)
      firstPage.drawText(examRegistration.nameOfApplicant || "N/A", {
        x: 300,
        y: 350,
        size: 16,
        font: font,
      });

      // Draw exam type (positioned on the right side of the same line as name)
      let examTypeFull = examRegistration.nameOfExamAppearingNow?.examType || "N/A";
      let examTypeShort = examTypeFull.split(":")[0]; // Get the part before the colon
      firstPage.drawText(examTypeShort, {
        x: 320,
        y: 312,
        size: 16,
        font: font,
      });

      // Draw the fixed date (positioned on the right side of "Examination conducted on" line)
      firstPage.drawText("13th July 2025", {
        x: 310,
        y: 264,
        size: 16,
        font: font,
      });

      // Draw the grade (positioned on the right side of the line ending with "grade.")
      firstPage.drawText(examScore?.grade || "No grade", {
        x: 420,
        y: 220,
        size: 16,
        font: font,
      });

      // Save the modified PDF
      const modifiedPdfBytes = await pdfDoc.save();
      const certificateTypePrefix = isStateCertificate ? "State" : "District";
      const folder = process.env.DO_SPACES_FOLDER || "";
      const fileName = folder ? `${folder}/certificates/${certificateTypePrefix}-Certificate-${Date.now()}.pdf` : `certificates/${certificateTypePrefix}-Certificate-${Date.now()}.pdf`;

      // Upload to DO Spaces
      const uploadParams = {
        Bucket: process.env.DO_SPACES_BUCKET,
        Key: fileName,
        Body: modifiedPdfBytes,
        ContentType: "application/pdf",
      };

      const command = new PutObjectCommand(uploadParams);
      await s3.send(command);

      return res.status(200).json({
        success: true,
        message: `${documentTitle} generated successfully`,
        url: fileName,
      });
    } catch (s3Error) {
      console.error("S3 operation error:", s3Error);
      return res.status(500).json({
        success: false,
        customMessage: "Error accessing certificate template. Please ensure the template file exists.",
      });
    }
  } catch (error) {
    console.error("Certificate generation error:", error);
    return res.status(400).json({
      success: false,
      message: error.toString(),
    });
  }
};

exports.getOutsideExamCenterByDistrict = async (req, res) => {
  try {
    const { examDistrict } = req.query;

    // Validate the examDistrict ID
    if (!mongoose.isValidObjectId(examDistrict)) {
      return res.status(200).json([]);
    }

    // Find exam centers based on the examDistrict
    const items = await ExamCenterRegistration.find(
      { district: examDistrict }, // Match examDistrict
      { _id: 0, id: "$_id", value: "$centerName" } // Select necessary fields
    );

    // If no items are found, return an empty array
    if (!items || items.length === 0) {
      return res.status(404).json({ message: "No outside exam centers found for this district" });
    }

    // Send the response
    res.status(200).json(items);
  } catch (err) {
    console.error("Error fetching outside exam centers:", err);
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc      Get exam registration list with specific fields
// @route     GET /api/v1/exam-registration/list
// @access    public
exports.getExamRegistrationList = async (req, res) => {
  try {
    const { skip = 0, limit = 10, searchkey, district, examCenter, centerRegistration } = req.query;

    // Build base filter excluding fields that need special $or treatment so they
    // don't conflict when spread into the query.
    const baseFilter = { ...(req.filter || {}) };
    delete baseFilter.district;
    delete baseFilter.examCenter;
    delete baseFilter.centerRegistration;
    delete baseFilter.assignedExamCenter;

    // Collect $or groups; combine them via $and so they never overwrite each other.
    const andConditions = [];

    // District: match home district OR exam district (outside-centre students)
    if (district && mongoose.Types.ObjectId.isValid(district)) {
      andConditions.push({
        $or: [
          { district: new mongoose.Types.ObjectId(district) },
          { examDistrict: new mongoose.Types.ObjectId(district) },
        ],
      });
    }

    // ExamCenter: match regular OR outside exam center (legacy ExamCenterRegistration ref)
    const effectiveExamCenter = examCenter || req.filter?.examCenter;
    if (effectiveExamCenter && mongoose.Types.ObjectId.isValid(String(effectiveExamCenter))) {
      andConditions.push({
        $or: [
          { examCenter: new mongoose.Types.ObjectId(String(effectiveExamCenter)) },
          { outsideExamCenter: new mongoose.Types.ObjectId(String(effectiveExamCenter)) },
        ],
      });
    }

    // Exam Center filter (attendance session table) — a student's exam-day venue is
    // `assignedExamCenter`, defaulting to their home study centre `centerRegistration`.
    // Match either so the filter finds a student regardless of reassignment.
    const effectiveCenterRegistration = centerRegistration || req.filter?.centerRegistration;
    if (effectiveCenterRegistration && mongoose.Types.ObjectId.isValid(String(effectiveCenterRegistration))) {
      andConditions.push({
        $or: [
          { centerRegistration: new mongoose.Types.ObjectId(String(effectiveCenterRegistration)) },
          { assignedExamCenter: new mongoose.Types.ObjectId(String(effectiveCenterRegistration)) },
        ],
      });
    }

    // Searchkey
    if (searchkey) {
      andConditions.push({
        $or: [
          { nameOfApplicant: { $regex: searchkey, $options: "i" } },
          { regno: { $regex: searchkey, $options: "i" } },
        ],
      });
    }

    const query = andConditions.length > 0 ? { ...baseFilter, $and: andConditions } : { ...baseFilter };

    // Get registrations with selected fields. The attendance-session table sorts by
    // district -> area -> exam center -> exam name -> gender -> mode of study -> reg no
    // -> name, which depends on populated display names — not sortable at the DB level
    // with a simple .sort(), so every match is fetched, sorted in JS, then paginated.
    const registrations = await ExamRegistration.find(query)
      .populate("district", "district")
      .populate("area", "area")
      .populate("examDistrict", "district")
      .populate("examCenter", "centerName")
      .populate("outsideExamCenter", "centerName")
      .populate("centerRegistration", "nameOfCenter")
      .populate("assignedExamCenter", "nameOfCenter")
      .populate("nameOfExamAppearingNow", "examType")
      .select("district area examDistrict nameOfApplicant examCenter outsideExamCenter centerRegistration assignedExamCenter nameOfExamAppearingNow regno examName status gender");

    // Transform the response to flatten nested objects
    const transformedRegistrations = registrations.map((reg) => ({
      _id: reg._id,
      nameOfApplicant: reg.nameOfApplicant,
      regno: reg.regno,
      // The stored `examName` field is only ever set when `nameOfExamAppearingNow`
      // happens to already be a populated document at save time, which never
      // happens on create/update, so it's blank for effectively every record.
      // Derive it fresh from the populated exam type instead (same approach as
      // getRegisteredStudentsList / getAttendanceSheet), falling back to the
      // stored value for any legacy record that does have it set.
      examName: reg.nameOfExamAppearingNow?.examType?.split(":")[0]?.trim() || reg.examName || "",
      status: reg.status,
      gender: reg.gender,
      district: reg.district,
      area: reg.area,
      examDistrict: reg.examDistrict,
      examCenter: reg.examCenter,
      outsideExamCenter: reg.outsideExamCenter,
      // Resolved exam-center display name for the attendance-session table's
      // "Exam Center" column — matches the Registered Students page:
      // centerRegistration (student's own pick) first, falling back to
      // assignedExamCenter for legacy records with no centerRegistration.
      examCenterName: reg.centerRegistration?.nameOfCenter || reg.assignedExamCenter?.nameOfCenter || "",
    }));

    // Male before Female (matches the fixed gender order used in the zip/PDF
    // attendance sheet export), any other value sorts after both.
    const genderRank = (g) => (g === "Male" ? 0 : g === "Female" ? 1 : 2);

    const collator = new Intl.Collator("en", { sensitivity: "base" });
    transformedRegistrations.sort(
      (a, b) =>
        collator.compare(a.district?.district || "", b.district?.district || "") ||
        collator.compare(a.area?.area || "", b.area?.area || "") ||
        collator.compare(a.examCenterName || "", b.examCenterName || "") ||
        collator.compare(a.examName || "", b.examName || "") ||
        (genderRank(a.gender) - genderRank(b.gender)) ||
        collator.compare(a.status || "", b.status || "") ||
        collator.compare(a.regno || "", b.regno || "") ||
        collator.compare(a.nameOfApplicant || "", b.nameOfApplicant || "")
    );

    const totalCount = transformedRegistrations.length;
    const skipNum = parseInt(skip) || 0;
    const limitNum = parseInt(limit) || 0;
    const pagedRegistrations = transformedRegistrations.slice(skipNum, limitNum > 0 ? skipNum + limitNum : totalCount);

    res.status(200).json({
      success: true,
      message: "Retrieved exam registration list",
      response: pagedRegistrations,
      count: pagedRegistrations.length,
      totalCount,
      filterCount: totalCount,
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

exports.getAttendanceSheet = async (req, res) => {
  try {
    const { district } = req.query;

    // Effective district: explicit query param for state admins, else the caller's own.
    const effectiveDistrict =
      district && mongoose.Types.ObjectId.isValid(district)
        ? district
        : req.user?.districts || null;

    if (effectiveDistrict) {
      if (!mongoose.Types.ObjectId.isValid(effectiveDistrict)) {
        return res.status(400).json({ success: false, message: "Invalid district ID" });
      }

      // Post-Phase-2.1: applicants write the exam at `assignedExamCenter` (a study
      // centre). Fall back to the legacy `examCenter`/`outsideExamCenter` fields
      // only if assignedExamCenter is missing (older records).
      const data = await ExamRegistration.find({ district: effectiveDistrict })
        .populate("district", "district")
        .populate("area", "area")
        .populate("centerRegistration", "nameOfCenter centerCode")
        .populate("assignedExamCenter", "nameOfCenter centerCode district")
        .populate("examCenter", "centerName")
        .populate("outsideExamCenter", "centerName")
        .populate("examDistrict", "district")
        .populate("nameOfExamAppearingNow", "examType");

      return res.status(200).json({
        success: true,
        message: "Registrations for district retrieved successfully",
        response: data,
      });
    } else {
      // This part remains the same
      const registrations = await ExamRegistration.find({}).populate("district", "district").select("_id district");

      const response = registrations.map((item) => ({
        id: item._id,
        value: item.district?.district || null,
      }));

      return res.status(200).json({
        success: true,
        message: "All districts retrieved successfully",
        response,
      });
    }
  } catch (err) {
    console.error(err);
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

// @desc     Phase 2.4 — Registered students verification list.
// @route    GET /api/v1/exam-registration/registered-list
// @access   protected (state admin sees all; district admin scoped)
// Returns a compact, ready-for-PDF dataset with the columns Sl / Name /
// Mobile / Study Centre / Area / Private-Regular / Exam Centre. Respects
// `req.filter` (district, examType, etc.) and the caller's district scope.
exports.getRegisteredStudentsList = async (req, res) => {
  try {
    const query = {
      ...(req.filter || {}),
      ...(req.user?.districts ? { district: req.user.districts } : {}),
    };

    const data = await ExamRegistration.find(query)
      .populate("district", "district")
      .populate("area", "area")
      .populate("centerRegistration", "nameOfCenter centerCode")
      .populate("assignedExamCenter", "nameOfCenter centerCode")
      .populate("nameOfExamAppearingNow", "examType")
      .select(
        "nameOfApplicant regno mobileNumber whatsappNumber status gender centerRegistration assignedExamCenter area district nameOfExamAppearingNow"
      )
      .sort({ nameOfApplicant: 1 });

    const seenMobiles = new Set();
    const deduped = data.filter((d) => {
      const mobile = d.mobileNumber;
      if (!mobile) return true;
      if (seenMobiles.has(mobile)) return false;
      seenMobiles.add(mobile);
      return true;
    });

    const rows = deduped.map((d, i) => ({
      sl: i + 1,
      id: d._id,
      name: d.nameOfApplicant || "",
      regno: d.regno || "",
      mobile: d.mobileNumber || "",
      whatsapp: d.whatsappNumber || "",
      gender: d.gender || "",
      status: d.status || "",
      examType: d.nameOfExamAppearingNow?.examType?.split(":")[0]?.trim() || "",
      area: d.area?.area || "",
      district: d.district?.district || "",
      studyCentre: d.centerRegistration?.nameOfCenter || "",
      studyCentreCode: d.centerRegistration?.centerCode || "",
      examCentre: d.assignedExamCenter?.nameOfCenter || d.centerRegistration?.nameOfCenter || "",
      examCentreCode: d.assignedExamCenter?.centerCode || d.centerRegistration?.centerCode || "",
    }));

    return res.status(200).json({
      success: true,
      count: rows.length,
      response: rows,
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc     Consolidation report — grouped, paginated summary rows.
// @route    GET /api/v1/exam-registration/consolidation-report
// @access   protected (state admin sees all; district admin scoped)
// Groups registrations by (level + examType) and sums Total/Private/Regular/
// Male/Female per group, deduping by mobileNumber the same way
// getRegisteredStudentsList does. `level` selects the grouping field:
// "district" (state-wide), "area" (district selected) or "studyCentre"
// (district + area selected). Pass skip/limit to page through the grouped
// rows; omit limit (or pass 0) to get every group in one shot — used by the
// PDF export, which needs the full report, not just the visible page.
// `totals` in the response is always the grand total across ALL groups in
// scope, independent of the page being returned.
exports.getConsolidationReport = async (req, res) => {
  try {
    const { level } = req.query;
    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 0;
    const groupField = ["district", "area", "studyCentre"].includes(level) ? level : "district";

    const query = {
      ...(req.filter || {}),
      ...(req.user?.districts ? { district: req.user.districts } : {}),
    };
    // "level" is a grouping directive, not a data filter — reqFilter doesn't
    // know that and leaves it in req.filter, which would otherwise make the
    // $match look for a nonexistent "level" field and return zero rows.
    delete query.level;
    // aggregate() sends $match straight to MongoDB — unlike .find(), it does not
    // auto-cast string ids to ObjectId, so district/area must be cast by hand.
    const castObjectId = (val) =>
      Array.isArray(val)
        ? { $in: val.filter((v) => mongoose.Types.ObjectId.isValid(v)).map((v) => new mongoose.Types.ObjectId(String(v))) }
        : mongoose.Types.ObjectId.isValid(val)
        ? new mongoose.Types.ObjectId(String(val))
        : val;
    ["district", "area"].forEach((f) => {
      if (query[f] !== undefined) query[f] = castObjectId(query[f]);
    });

    // Raw id field the current groupField maps to — used by the "counts"
    // facet below to dedupe distinct districts/areas/centers without
    // waiting for the name lookups the display grouping needs.
    const groupIdField = groupField === "area" ? "$area" : groupField === "studyCentre" ? "$centerRegistration" : "$district";

    const pipeline = [
      { $match: query },
      { $sort: { nameOfApplicant: 1 } },
      {
        $group: {
          _id: { $ifNull: ["$mobileNumber", "$_id"] },
          status: { $first: "$status" },
          gender: { $first: "$gender" },
          district: { $first: "$district" },
          area: { $first: "$area" },
          centerRegistration: { $first: "$centerRegistration" },
          nameOfExamAppearingNow: { $first: "$nameOfExamAppearingNow" },
        },
      },
      {
        $facet: {
          // Display rows: one per (group, exam), with lookups for names.
          data: [
            { $lookup: { from: "districts", localField: "district", foreignField: "_id", as: "districtDoc" } },
            { $unwind: { path: "$districtDoc", preserveNullAndEmptyArrays: true } },
            { $lookup: { from: "areas", localField: "area", foreignField: "_id", as: "areaDoc" } },
            { $unwind: { path: "$areaDoc", preserveNullAndEmptyArrays: true } },
            { $lookup: { from: "centerregistrations", localField: "centerRegistration", foreignField: "_id", as: "centerDoc" } },
            { $unwind: { path: "$centerDoc", preserveNullAndEmptyArrays: true } },
            { $lookup: { from: "examtypes", localField: "nameOfExamAppearingNow", foreignField: "_id", as: "examDoc" } },
            { $unwind: { path: "$examDoc", preserveNullAndEmptyArrays: true } },
            {
              $addFields: {
                groupVal: {
                  $switch: {
                    branches: [
                      { case: { $eq: [groupField, "area"] }, then: "$areaDoc.area" },
                      { case: { $eq: [groupField, "studyCentre"] }, then: "$centerDoc.nameOfCenter" },
                    ],
                    default: "$districtDoc.district",
                  },
                },
                examName: {
                  $trim: {
                    input: { $arrayElemAt: [{ $split: [{ $ifNull: ["$examDoc.examType", ""] }, ":"] }, 0] },
                  },
                },
              },
            },
            {
              $group: {
                _id: { group: { $ifNull: ["$groupVal", "Unknown"] }, examName: { $ifNull: ["$examName", "Unknown"] } },
                total: { $sum: 1 },
                private: { $sum: { $cond: [{ $eq: ["$status", "Private"] }, 1, 0] } },
                regular: { $sum: { $cond: [{ $eq: ["$status", "Regular"] }, 1, 0] } },
                male: { $sum: { $cond: [{ $eq: ["$gender", "Male"] }, 1, 0] } },
                female: { $sum: { $cond: [{ $eq: ["$gender", "Female"] }, 1, 0] } },
              },
            },
            {
              $project: {
                _id: 0,
                group: "$_id.group",
                examName: "$_id.examName",
                total: 1,
                private: 1,
                regular: 1,
                male: 1,
                female: 1,
              },
            },
            { $sort: { group: 1, examName: 1 } },
            ...(limit > 0 ? [{ $skip: skip }, { $limit: limit }] : []),
          ],
          // Group-row count, kept in sync with "data" but computed off raw
          // ids (no lookups needed) since only the distinct-pair count matters.
          totalCount: [
            { $group: { _id: { group: groupIdField, examName: "$nameOfExamAppearingNow" } } },
            { $count: "count" },
          ],
          // Grand totals across every group in scope, independent of paging.
          totals: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                private: { $sum: { $cond: [{ $eq: ["$status", "Private"] }, 1, 0] } },
                regular: { $sum: { $cond: [{ $eq: ["$status", "Regular"] }, 1, 0] } },
                male: { $sum: { $cond: [{ $eq: ["$gender", "Male"] }, 1, 0] } },
                female: { $sum: { $cond: [{ $eq: ["$gender", "Female"] }, 1, 0] } },
              },
            },
          ],
          // Distinct district/area/exam-center counts in scope, for the
          // summary cards above the table (cards shown depend on filter level).
          counts: [
            {
              $group: {
                _id: null,
                districts: { $addToSet: "$district" },
                areas: { $addToSet: "$area" },
                centers: { $addToSet: "$centerRegistration" },
              },
            },
            {
              $project: {
                _id: 0,
                districtCount: { $size: "$districts" },
                areaCount: { $size: "$areas" },
                centerCount: { $size: "$centers" },
              },
            },
          ],
        },
      },
    ];

    const [result] = await ExamRegistration.aggregate(pipeline);

    return res.status(200).json({
      success: true,
      response: result.data,
      totalCount: result.totalCount[0]?.count || 0,
      totals: result.totals[0] || { total: 0, private: 0, regular: 0, male: 0, female: 0 },
      counts: result.counts[0] || { districtCount: 0, areaCount: 0, centerCount: 0 },
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.getQuestionPackingList = async (req, res) => {
  try {
    const { examCenter } = req.query;

    if (examCenter) {
      if (!mongoose.Types.ObjectId.isValid(examCenter)) {
        return res.status(400).json({ success: false, message: "Invalid exam center ID" });
      }

      const data = await ExamRegistration.find({ examCenter }).populate("examCenter", "centerName").populate("district", "district").populate("nameOfExamAppearingNow", "examType");

      return res.status(200).json({
        success: true,
        message: "Question packing list for exam center retrieved successfully",
        response: data,
      });
    } else {
      const centers = await ExamRegistration.find({}).populate("examCenter", "centerName").select("_id examCenter");

      const response = centers.map((item) => ({
        id: item._id,
        value: item.examCenter?.centerName || null,
      }));

      return res.status(200).json({
        success: true,
        message: "All exam centers retrieved successfully",
        response,
      });
    }
  } catch (err) {
    console.error(err);
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

exports.getOutsideExamAttendanceSheet = async (req, res) => {
  try {
    const { skip = 0, limit = 10, searchkey } = req.query;

    // Build the query to find students who opted for outside centers (outsideCenter: "No")
    const query = {
      outsideCenter: "No", // Students who selected "No" for the question about exam center in their district
      outsideExamCenter: { $ne: null }, // ensure they have a valid outside center
      ...(searchkey && {
        $or: [{ nameOfApplicant: { $regex: searchkey, $options: "i" } }, { regno: !isNaN(searchkey) ? parseInt(searchkey) : null }, { mobileNumber: !isNaN(searchkey) ? parseInt(searchkey) : null }].filter((cond) => Object.values(cond)[0] !== null),
      }),
    };

    // Get total count for pagination
    const totalCount = await ExamRegistration.countDocuments(query);

    // Find students with pagination
    const students = await ExamRegistration.find(query)
      .populate("district", "district")
      .populate("examDistrict", "district")
      .populate("outsideExamCenter", "centerName")
      .populate("nameOfExamAppearingNow", "examType")
      .populate("area", "area")
      .populate("centerRegistration", "nameOfCenter")
      .select("nameOfApplicant regno mobileNumber address educationalQualification affiliation whatsappNumber gender outsideCenter status feeDetails age district examDistrict outsideExamCenter nameOfExamAppearingNow area centerRegistration")
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .sort({ "outsideExamCenter.centerName": 1, nameOfApplicant: 1 });

    if (!students.length) {
      return res.status(200).json({
        success: true,
        message: "No outside center students found.",
        response: [],
        count: 0,
        totalCount: 0,
        filterCount: 0,
      });
    }

    // Transform the data to match the expected format for ListTable
    const transformedStudents = students.map((student) => ({
      _id: student._id,
      nameOfApplicant: student.nameOfApplicant,
      regno: student.regno,
      mobileNumber: student.mobileNumber,
      address: student.address,
      educationalQualification: student.educationalQualification,
      affiliation: student.affiliation,
      whatsappNumber: student.whatsappNumber,
      gender: student.gender,
      outsideCenter: student.outsideCenter,
      status: student.status,
      feeDetails: student.feeDetails,
      age: student.age,
      district: student.district,
      examDistrict: student.examDistrict,
      outsideExamCenter: student.outsideExamCenter,
      nameOfExamAppearingNow: student.nameOfExamAppearingNow,
      area: student.area,
      centerRegistration: student.centerRegistration,
    }));

    res.status(200).json({
      success: true,
      message: "Outside center students retrieved successfully.",
      response: transformedStudents,
      count: transformedStudents.length,
      totalCount,
      filterCount: totalCount,
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: err.message });
  }
};
// kajsdhwf
// @desc      Get districts excluding student's own district for examDistrict dropdown
// @route     GET /api/v1/exam-registration/districts-excluding-own
// @access    public
exports.getDistrictsExcludingOwn = async (req, res) => {
  try {
    const { studentDistrict, district } = req.query;

    // Use either studentDistrict or district parameter (district comes from updateOn)
    const excludeDistrictId = studentDistrict || district;

    // If no district is provided, return all districts
    if (!excludeDistrictId || !mongoose.isValidObjectId(excludeDistrictId)) {
      // Import District model
      const District = require("../models/district");

      // Return all districts if no valid district ID is provided
      const items = await District.find({}, { _id: 0, id: "$_id", value: "$district" });
      return res.status(200).json(items);
    }

    // Import District model
    const District = require("../models/district");

    // Find all districts except the student's own district
    const items = await District.find({ _id: { $ne: new mongoose.Types.ObjectId(excludeDistrictId) } }, { _id: 0, id: "$_id", value: "$district" });

    res.status(200).json(items);
  } catch (err) {
    console.error("Error fetching districts excluding own:", err);
    res.status(400).json({ success: false, message: err.message });
  }
};

// exports.assignRegisterNumbers = async (req, res) => {
//   try {
//     // Fetch all exam centers (both regular and outside centers are stored in ExamCenterRegistration)
//     const examCenters = await ExamCenterRegistration.find({});
//     const examTypes = await ExamType.find({});
//     const genders = ["Male", "Female"];

//     let counter = 1;

//     for (const center of examCenters) {
//       for (const type of examTypes) {
//         for (const gender of genders) {
//           // Fetch registrations for this group - check both regular and outside exam centers
//           const registrations = await ExamRegistration.find({
//             $or: [
//               { examCenter: center._id }, // Regular exam centers
//               { outsideExamCenter: center._id }, // Outside exam centers
//             ],
//             nameOfExamAppearingNow: type._id,
//             gender: gender,
//           }).sort({ nameOfApplicant: 1 }); // Sort by applicant name

//           for (const reg of registrations) {
//             const regNo = `QSC${String(counter).padStart(3, "0")}`;
//             reg.regno = regNo;
//             await reg.save(); // Save updated registerNo
//             counter++;
//           }

//           console.log(`Assigned ${registrations.length} registerNos for Center: ${center.centerName}, Type: ${type.examType}, Gender: ${gender}`);
//         }
//       }
//     }

//     console.log("✅ Register numbers assigned successfully.");
//     res.status(200).json({
//       success: true,
//       message: "Register numbers assigned successfully.",
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(400).json({
//       success: false,
//       message: err.message,
//     });
//   }
// };
