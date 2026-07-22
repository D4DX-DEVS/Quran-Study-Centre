const HallTickets = require("../models/hallTicket.js");
const { default: mongoose } = require("mongoose");
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const examRegistration = require("../models/examRegistration.js");
const { resolveExamCenterName, genderRank, modeRank, examSortOrder } = require("../utils/studentSort");
// The hall ticket PDF is built with @react-pdf/renderer (see hallTicketDocument.js).
// It replaced an older pdf-lib renderer that could not shape Malayalam correctly.
const { renderHallTicketPdf, renderHallTicketSheet } = require("./hallTicketDocument.js");

const s3 = new S3Client({
  endpoint: `https://${process.env.DO_SPACES_ENDPOINT}`,
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY,
    secretAccessKey: process.env.DO_SPACES_SECRET,
  },
});

const HALL_TICKET_POPULATE_OPTS = [
  { path: "centerRegistration", select: "nameOfCenter centerCode" },
  { path: "assignedExamCenter", select: "nameOfCenter centerCode" },
  { path: "district", select: "district" },
  { path: "area", select: "area" },
  { path: "examCenter", select: "centerName" },
  { path: "outsideExamCenter", select: "centerName" },
  { path: "nameOfExamAppearingNow", select: "examType" },
];

// "QSC Hall Ticket - <regno>" — falls back to the Mongo _id for the rare
// registration that hasn't been assigned a regno yet, so the name is always
// unique even then.
const hallTicketFileName = (user) => `QSC Hall Ticket - ${user.regno || user._id}`;

const uploadHallTicketPdf = async (pdfBytes, keySuffix, displayName) => {
  const folder = process.env.DO_SPACES_FOLDER || "";
  const fileName = folder ? `${folder}/hallTickets/${keySuffix}.pdf` : `hallTickets/${keySuffix}.pdf`;

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.DO_SPACES_BUCKET,
      Key: fileName,
      Body: pdfBytes,
      ContentType: "application/pdf",
      ACL: "public-read",
      // Suggests this name in the browser's "Save As" dialog even though the
      // object key (below) is what actually shows up in the URL bar.
      ContentDisposition: displayName ? `attachment; filename="${displayName}.pdf"` : undefined,
    })
  );

  // The object key stays the same on every regeneration, but the CDN
  // (Cloudflare in front of DO Spaces) caches each URL for max-age=3600.
  // Without a fresh cache key a regenerated ticket would keep serving the
  // stale copy for up to an hour. A ?v=<timestamp> query is part of the
  // CDN cache key here, so every generation hands out a URL that misses
  // the cache and fetches the just-uploaded PDF.
  return `${process.env.DO_SPACES_CDN_ENDPOINT}/${fileName}?v=${Date.now()}`;
};

// @desc      ADD HALL TICKET
// @route     POST /api/hallTicket/hall-Ticket
// @access    public
exports.addHallTicket = async (req, res) => {
  try {
    const response = await HallTickets.create(req.body);
    console.log(req.body);
    res.status(200).json({ success: true, message: `succefully added hallTicket `, response });
  } catch (err) {
    console.log(err);
    res.status(204).json({ success: false, message: err });
  }
};

// @desc      GET HALL TICKET
// @route     GET /api/v1/hall-ticket
// @access    public
exports.getHallTicket = async (req, res) => {
  try {
    const { id, skip, limit, searchkey } = req.query;

    const populateOpts = {
      path: "nameOfApplicant",
      select: "nameOfApplicant mobileNumber regno status district area centerRegistration nameOfExamAppearingNow assignedExamCenter gender",
      populate: [
        { path: "district", select: "district" },
        { path: "area", select: "area" },
        { path: "centerRegistration", select: "nameOfCenter centerCode" },
        { path: "nameOfExamAppearingNow", select: "examType sortOrder" },
        { path: "assignedExamCenter", select: "nameOfCenter centerCode" },
      ],
    };

    if (id && mongoose.isValidObjectId(id)) {
      const response = await HallTickets.findById(id).populate(populateOpts);
      return res.status(200).json({ success: true, message: "Retrieved specific hallTicket", response });
    }
    const query = { ...req.filter };

    if (searchkey) {
      // Search across multiple fields in exam registrations
      const searchRegex = { $regex: searchkey, $options: "i" };
      const matchingRegistrations = await examRegistration
        .find({
          $or: [
            { nameOfApplicant: searchRegex },
            { regno: searchRegex },
            { mobileNumber: !isNaN(searchkey) ? Number(searchkey) : undefined },
          ].filter((c) => !Object.values(c).includes(undefined)),
        })
        .select("_id");

      query.nameOfApplicant = { $in: matchingRegistrations.map((reg) => reg._id) };
    }

    // Row order needs to match the attendance/registered-students table
    // (district -> area -> exam centre -> exam stage -> gender -> mode of
    // study -> reg no -> name, see utils/studentSort.js), which depends on
    // populated display names — not sortable at the DB level with a plain
    // .sort(), so every match is fetched, sorted in JS, then paginated.
    const allMatches = await HallTickets.find(query).populate(populateOpts);

    const collator = new Intl.Collator("en", { sensitivity: "base" });
    allMatches.sort((a, b) => {
      const regA = a.nameOfApplicant || {};
      const regB = b.nameOfApplicant || {};
      return (
        collator.compare(regA.district?.district || "", regB.district?.district || "") ||
        collator.compare(regA.area?.area || "", regB.area?.area || "") ||
        collator.compare(resolveExamCenterName(regA), resolveExamCenterName(regB)) ||
        (examSortOrder(regA.nameOfExamAppearingNow) - examSortOrder(regB.nameOfExamAppearingNow)) ||
        (genderRank(regA.gender) - genderRank(regB.gender)) ||
        (modeRank(regA.status) - modeRank(regB.status)) ||
        collator.compare(regA.regno || "", regB.regno || "") ||
        collator.compare(regA.nameOfApplicant || "", regB.nameOfApplicant || "")
      );
    });

    const filterCount = allMatches.length;
    const skipNum = parseInt(skip) || 0;
    const limitNum = parseInt(limit) || 50;
    const data = allMatches.slice(skipNum, skipNum + limitNum);

    const totalCount = skipNum === 0 ? await HallTickets.countDocuments() : 0;

    res.status(200).json({ success: true, message: `Retrieved all hallTicket`, response: data, count: data.length, totalCount: totalCount || 0, filterCount: filterCount || 0 });
  } catch (err) {
    res.status(400).json({ success: false, message: err.toString() });
  }
};

// Renders + uploads a fresh hall ticket for one already-populated student doc,
// and records the result on the HallTicket collection. Shared by the on-demand
// download endpoint and the auto-regeneration triggered on student edits.
const regenerateHallTicketFor = async (user) => {
  const pdfBytes = await renderHallTicketPdf(user);
  const fileName = hallTicketFileName(user);
  const cdnUrl = await uploadHallTicketPdf(pdfBytes, fileName, fileName);

  await HallTickets.findOneAndUpdate(
    { nameOfApplicant: user._id },
    { pdfUrl: cdnUrl, status: "generated", generatedAt: new Date(), error: null },
    { upsert: true }
  );

  return cdnUrl;
};

// Looks up a student by _id (populating what the ticket needs) and
// regenerates their hall ticket. Used as a fire-and-forget side effect after
// a student's details are edited, so an out-of-date PDF never lingers on the
// CDN. Failures are recorded on the HallTicket doc rather than thrown, since
// callers use this without awaiting/handling a rejection.
exports.regenerateHallTicketForId = async (registrationId) => {
  try {
    const user = await examRegistration.findById(registrationId).populate(HALL_TICKET_POPULATE_OPTS);
    if (!user) return;
    await regenerateHallTicketFor(user);
  } catch (error) {
    console.error(`Auto hall-ticket regeneration failed for registration ${registrationId}:`, error.message);
    await HallTickets.findOneAndUpdate(
      { nameOfApplicant: registrationId },
      { status: "failed", error: error.message.toString().slice(0, 500) },
      { upsert: true }
    ).catch(() => {});
  }
};

// @desc      DOWNLOAD HALL TICKET (single student, on demand)
// @route     GET /api/v1/hall-ticket/download
// @access    public
exports.downloadHallTicket = async (req, res) => {
  try {
    const { mobileNumber } = req.body;
    if (!mobileNumber) {
      return res.status(400).json({ success: false, customMessage: "Mobile number is required" });
    }

    const user = await examRegistration.findOne({ mobileNumber }).populate(HALL_TICKET_POPULATE_OPTS);

    if (!user) {
      return res.status(404).json({
        success: false,
        customMessage: "User not found",
      });
    }

    const cdnUrl = await regenerateHallTicketFor(user);

    return res.status(200).json({
      success: true,
      message: "Hall ticket generated successfully",
      url: cdnUrl,
    });
  } catch (error) {
    console.error("Hall ticket generation error:", error);
    return res.status(400).json({
      success: false,
      message: error.toString(),
    });
  }
};

// Processes all registrations in the background, a handful at a time, writing
// per-student progress onto the HallTicket collection as it goes. Deliberately
// not awaited by the route handler — with thousands of students this can run
// well past any reasonable HTTP timeout, so the admin polls progress via the
// existing hall-ticket list instead of waiting on the request.
const BULK_CONCURRENCY = 5;
const processBulkHallTickets = async (registrations, onProgress) => {
  let cursor = 0;
  let done = 0;
  let failed = 0;

  const worker = async () => {
    while (cursor < registrations.length) {
      const user = registrations[cursor++];
      try {
        await HallTickets.findOneAndUpdate({ nameOfApplicant: user._id }, { status: "pending" }, { upsert: true });
        await regenerateHallTicketFor(user);
        done++;
      } catch (err) {
        failed++;
        console.error(`Bulk hall ticket generation failed for registration ${user._id}:`, err.message);
        await HallTickets.findOneAndUpdate(
          { nameOfApplicant: user._id },
          { status: "failed", error: err.message.toString().slice(0, 500) },
          { upsert: true }
        );
      } finally {
        if (onProgress) onProgress(done, failed, registrations.length);
      }
    }
  };

  await Promise.all(Array.from({ length: BULK_CONCURRENCY }, worker));
  console.log(`Bulk hall ticket generation finished: ${done} generated, ${failed} failed, ${registrations.length} total.`);
  return { done, failed, total: registrations.length };
};

exports.processBulkHallTickets = processBulkHallTickets;
exports.HALL_TICKET_POPULATE_OPTS = HALL_TICKET_POPULATE_OPTS;

// @desc      GENERATE HALL TICKETS FOR EVERY CURRENTLY REGISTERED STUDENT
// @route     POST /api/v1/hall-ticket/generate-all
// @access    public
exports.generateAllHallTickets = async (req, res) => {
  try {
    const registrations = await examRegistration.find({}).populate(HALL_TICKET_POPULATE_OPTS);

    if (!registrations.length) {
      return res.status(200).json({ success: true, message: "No registered students found.", total: 0 });
    }

    res.status(200).json({
      success: true,
      message: `Started generating ${registrations.length} hall ticket(s) in the background. Refresh this list in a bit to see progress (status column) and download links.`,
      total: registrations.length,
    });

    processBulkHallTickets(registrations).catch((err) => {
      console.error("Bulk hall ticket generation crashed:", err);
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: err.toString() });
  }
};

// @desc      PRINT SHEET — 2 students' hall tickets per A4 page, for handing
//            out printed copies. Accepts either an explicit list of
//            examRegistration _ids to print, or (if omitted) prints every
//            currently-registered student in the same district -> area ->
//            exam centre -> stage -> gender -> mode -> regno -> name order
//            used elsewhere, so a printed stack matches the attendance list.
// @route     POST /api/v1/hall-ticket/print-sheet
// @access    public
exports.printHallTicketSheet = async (req, res) => {
  try {
    const { ids } = req.body || {};

    let registrations;
    if (Array.isArray(ids) && ids.length) {
      const validIds = ids.filter((id) => mongoose.isValidObjectId(id));
      registrations = await examRegistration.find({ _id: { $in: validIds } }).populate(HALL_TICKET_POPULATE_OPTS);
      // Preserve the order the caller asked for (e.g. selection order in the UI).
      const byId = new Map(registrations.map((r) => [r._id.toString(), r]));
      registrations = validIds.map((id) => byId.get(id)).filter(Boolean);
    } else {
      registrations = await examRegistration.find({}).populate(HALL_TICKET_POPULATE_OPTS);
      const collator = new Intl.Collator("en", { sensitivity: "base" });
      registrations.sort(
        (a, b) =>
          collator.compare(a.district?.district || "", b.district?.district || "") ||
          collator.compare(a.area?.area || "", b.area?.area || "") ||
          collator.compare(resolveExamCenterName(a), resolveExamCenterName(b)) ||
          examSortOrder(a.nameOfExamAppearingNow) - examSortOrder(b.nameOfExamAppearingNow) ||
          genderRank(a.gender) - genderRank(b.gender) ||
          modeRank(a.status) - modeRank(b.status) ||
          collator.compare(a.regno || "", b.regno || "") ||
          collator.compare(a.nameOfApplicant || "", b.nameOfApplicant || "")
      );
    }

    if (!registrations.length) {
      return res.status(404).json({ success: false, customMessage: "No matching students found." });
    }

    const pdfBytes = await renderHallTicketSheet(registrations);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="hall-tickets-print-sheet.pdf"`,
    });
    return res.status(200).send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error("Print sheet generation error:", err);
    return res.status(400).json({ success: false, message: err.toString() });
  }
};

// @desc      UPDATE SPECIFIC HallTicket
// @route     PUT /api/user/HallTicket
// @access    public
exports.updateHallTicket = async (req, res) => {
  try {
    const { id } = req.body;
    const response = await HallTickets.findByIdAndUpdate(id, req.body);
    res.status(200).json({ success: true, message: `updated specific hallTicket`, response });
  } catch (err) {
    console.log(err);
    res.status(204).json({ success: false, message: err });
  }
};

// @desc      DELETE SPECIFIC HallTicket
// @route     DELETE /api/user/hallTicket
// @access    public
exports.deleteHallTicket = async (req, res) => {
  try {
    const { id } = req.query;
    const response = await HallTickets.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: `deleted specific hallTicket`, response });
  } catch (err) {
    console.log(err);
    res.status(204).json({ success: false, message: err });
  }
};

// @desc      GET HallTicketS
// @route     GET /api/user/select
// @access    protect
exports.select = async (req, res) => {
  try {
    const items = await HallTickets.find({}, { _id: 0, id: "$_id", value: "$registerNo" });
    return res.status(200).send(items);
  } catch (err) {
    console.log(err);
    res.status(204).json({ success: false, message: err });
  }
};
