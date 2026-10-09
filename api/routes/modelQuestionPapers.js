const router = require("express").Router();
// controllers
const { addModelQuestionPaper, updateModelQuestionPaper, deleteModelQuestionPaper, getModelQuestionPaper } = require("../controllers/modelQuestionPapers");
// middleware
const { protect, authorize, optionalProtect } = require("../middleware/auth");
const { reqFilter } = require("../middleware/filter");
const { getS3Middleware } = require("../middleware/s3client");
const getUploadMiddleware = require("../middleware/upload");

// Same upload pipeline as the Question Bank, into its own folder. Writes are
// Admin-only; reads are public (gated by the Landing Page Settings switch).
const upload = [getUploadMiddleware("uploads/modelQuestions", ["attachment"]), getS3Middleware(["attachment"])];

router
  .route("/")
  .post(protect, authorize("Admin"), ...upload, addModelQuestionPaper)
  .get(reqFilter, optionalProtect, getModelQuestionPaper)
  .put(protect, authorize("Admin"), ...upload, updateModelQuestionPaper)
  .delete(protect, authorize("Admin"), deleteModelQuestionPaper);

module.exports = router;
