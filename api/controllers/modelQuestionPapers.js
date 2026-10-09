const ModelQuestionPaper = require("../models/modelQuestionPapers");
const FloatingSettings = require("../models/floatingMenuSettings");
const { default: mongoose } = require("mongoose");

// Fields an admin may set; everything else in the body is ignored.
const EDITABLE_FIELDS = ["category", "kind", "title", "attachment"];
const pickEditable = (body) =>
  EDITABLE_FIELDS.reduce((acc, field) => {
    if (typeof body[field] === "string") acc[field] = body[field];
    return acc;
  }, {});

const validationMessage = (err) => (err?.name === "ValidationError" ? Object.values(err.errors).map((e) => e.message).join(", ") : "Could not save the file");

// @desc      ADD MODEL QUESTION PAPER / ANSWER KEY
// @route     POST /api/v1/model-question-papers
// @access    protect (Admin)
exports.addModelQuestionPaper = async (req, res) => {
  try {
    const response = await ModelQuestionPaper.create(pickEditable(req.body));
    res.status(200).json({ success: true, message: "Successfully added the file", response });
  } catch (err) {
    console.log(err);
    res.status(400).json({ success: false, message: validationMessage(err), customMessage: validationMessage(err) });
  }
};

// @desc      GET MODEL QUESTION PAPERS / ANSWER KEYS
// @route     GET /api/v1/model-question-papers
// @access    public while "Model Question & Answer Key" is switched ON in Landing
//            Page Settings; staff (Admin) can always list for management.
exports.getModelQuestionPaper = async (req, res) => {
  try {
    const { id, skip, limit } = req.query;
    const isAdmin = req.user?.userType?.role === "Admin";

    if (!isAdmin) {
      const settings = await FloatingSettings.findOne().sort({ updatedAt: -1, _id: -1 }).select("modelQuestions").lean();
      if (settings?.modelQuestions !== true) {
        return res.status(200).json({ success: true, message: "Model Question & Answer Key is not available", response: [], count: 0, totalCount: 0, filterCount: 0 });
      }
    }

    if (typeof id === "string" && mongoose.isValidObjectId(id)) {
      const response = await ModelQuestionPaper.findById(id);
      return res.status(200).json({ success: true, message: "Retrieved specific file", response });
    }

    // Only plain-string category / kind filters are honoured (no operators).
    const query = {};
    if (typeof req.filter?.category === "string") query.category = req.filter.category;
    if (typeof req.filter?.kind === "string") query.kind = req.filter.kind;

    const [totalCount, filterCount, data] = await Promise.all([
      parseInt(skip) === 0 && ModelQuestionPaper.countDocuments(),
      parseInt(skip) === 0 && ModelQuestionPaper.countDocuments(query),
      ModelQuestionPaper.find(query)
        .skip(parseInt(skip) || 0)
        .limit(parseInt(limit) || 0)
        .sort({ _id: -1 }),
    ]);

    res.status(200).json({ success: true, message: "Retrieved all files", response: data, count: data.length, totalCount: totalCount || 0, filterCount: filterCount || 0 });
  } catch (err) {
    console.log(err);
    res.status(400).json({ success: false, message: "Could not load the files" });
  }
};

// @desc      UPDATE SPECIFIC MODEL QUESTION PAPER / ANSWER KEY
// @route     PUT /api/v1/model-question-papers
// @access    protect (Admin)
exports.updateModelQuestionPaper = async (req, res) => {
  try {
    const { id } = req.body;
    if (typeof id !== "string" || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "A valid id is required" });
    }
    const response = await ModelQuestionPaper.findByIdAndUpdate(id, pickEditable(req.body), { new: true, runValidators: true });
    if (!response) return res.status(404).json({ success: false, message: "File not found" });
    res.status(200).json({ success: true, message: "Updated the file", response });
  } catch (err) {
    console.log(err);
    res.status(400).json({ success: false, message: validationMessage(err), customMessage: validationMessage(err) });
  }
};

// @desc      DELETE SPECIFIC MODEL QUESTION PAPER / ANSWER KEY
// @route     DELETE /api/v1/model-question-papers
// @access    protect (Admin)
exports.deleteModelQuestionPaper = async (req, res) => {
  try {
    const { id } = req.query;
    if (typeof id !== "string" || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "A valid id is required" });
    }
    const response = await ModelQuestionPaper.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: "Deleted the file", response });
  } catch (err) {
    console.log(err);
    res.status(400).json({ success: false, message: "Could not delete the file" });
  }
};
