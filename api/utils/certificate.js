// Student certificate selection + PDF rendering.
//
// Two official designs ship with the API (assets/certificates):
//   state-certificate.pdf     green — "State Wise"
//   district-certificate.pdf  blue  — "District Wise"
// Both are flat artwork with four blank lines (name, exam, exam date, grade).
// We never redraw the artwork: the template page is loaded as-is and only the
// student's values are written onto the blank lines, so the original design,
// colours and page size are untouched.

const fs = require("fs");
const path = require("path");
const { PDFDocument, rgb } = require("pdf-lib");
const fontkit = require("fontkit");
const { computeExamStageDigit } = require("./examLevelOrder");

const ASSET_DIR = path.join(__dirname, "..", "assets", "certificates");
const TEMPLATE_FILES = {
  state: path.join(ASSET_DIR, "state-certificate.pdf"),
  district: path.join(ASSET_DIR, "district-certificate.pdf"),
};

// Latin text uses Poppins (matches the clean sans of the template wording);
// Malayalam names fall back to Noto Sans Malayalam, which has no Latin glyphs.
const LATIN_FONT_FILE = path.join(__dirname, "..", "public", "Poppins-Medium.ttf");
const MALAYALAM_FONT_FILE = path.join(__dirname, "..", "controllers", "hallTicketAssets", "NotoSansMalayalam-Regular.ttf");

// Exam stage codes (examtype.stageDigit, also embedded in registration
// numbers): Preliminary I-VI = 1-6, Secondary I-III = 7-9. The final
// examinations — the only ones that earn the green State certificate — are
// Preliminary VI (6) and Secondary III (9).
const STATE_CERTIFICATE_STAGES = new Set([6, 9]);

// The annual exam date printed on every certificate. Same fixed date the hall
// tickets carry (controllers/hallTicketDocument.js EXAM_DATE); override with
// CERTIFICATE_EXAM_DATE for a different sitting without a code change.
const DEFAULT_EXAM_DATE = { year: 2026, month: 8, day: 2 };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const ordinal = (n) => {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
};

const getExamDateText = () => {
  const override = (process.env.CERTIFICATE_EXAM_DATE || "").trim();
  if (override) return override;
  const { year, month, day } = DEFAULT_EXAM_DATE;
  return `${ordinal(day)} ${MONTHS[month - 1]} ${year}`;
};

// Blank-line geometry measured from the artwork (PDF points, page 615.17 x
// 802.08). `lineTop` is the underline's distance from the TOP of the page;
// [x0, x1] is the span of the underline. Values are written centred on it.
const FIELDS = {
  name: { lineTop: 458.3, x0: 237, x1: 541.8, size: 16 },
  exam: { lineTop: 500.8, x0: 268, x1: 541.8, size: 16 },
  date: { lineTop: 546.6, x0: 268, x1: 441, size: 15 },
  grade: { lineTop: 588.4, x0: 361, x1: 497.2, size: 16 },
};
const BASELINE_LIFT = 4; // gap between underline and text baseline
const MIN_FONT_SIZE = 5;
const FIELD_PADDING = 6;
const INK = rgb(0.1, 0.1, 0.12);

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

// Exam stage 1-9 for an ExamType document (or lean object). Uses the stored
// stageDigit (set from the structured exam name on save and baked into every
// registration number) and only derives it from the name when it is missing.
const getExamStage = (exam) => {
  if (!exam) return null;
  if (Number.isInteger(exam.stageDigit)) return exam.stageDigit;
  return computeExamStageDigit(exam.examShortName || exam.examType);
};

// True for the Preliminary VI / Secondary III final examinations.
const isFinalExam = (exam) => STATE_CERTIFICATE_STAGES.has(getExamStage(exam));

// "state" (green) only for a completed final exam; everything else "district" (blue).
const getCertificateType = (exam) => (isFinalExam(exam) ? "state" : "district");

// A result earns a certificate once a numeric mark and a real grade exist.
const isCertificateEligible = (examScore) => {
  if (!examScore) return false;
  if (examScore.score === null || examScore.score === undefined || examScore.score === "") return false;
  if (!Number.isFinite(Number(examScore.score))) return false;
  const grade = String(examScore.grade || "").trim();
  return grade !== "" && grade !== "Grade Not Published";
};

// Display name of the exam, e.g. "Preliminary VI" (never the long syllabus text).
const getExamDisplayName = (exam) => {
  const short = String(exam?.examShortName || "").trim();
  if (short) return short;
  return String(exam?.examType || "").split(":")[0].trim();
};

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const fileCache = new Map();
const readAsset = (file) => {
  if (!fileCache.has(file)) fileCache.set(file, fs.readFileSync(file));
  return fileCache.get(file);
};

const glyphCheckers = {};
const getGlyphChecker = (file) => {
  if (!glyphCheckers[file]) glyphCheckers[file] = fontkit.create(readAsset(file));
  return glyphCheckers[file];
};

// Splits `text` into runs drawable by one font each. Characters neither font
// can render are dropped rather than printed as missing-glyph boxes.
const splitIntoRuns = (text) => {
  const latin = getGlyphChecker(LATIN_FONT_FILE);
  const malayalam = getGlyphChecker(MALAYALAM_FONT_FILE);
  const runs = [];
  for (const char of Array.from(text)) {
    const cp = char.codePointAt(0);
    let key;
    if (latin.hasGlyphForCodePoint(cp)) key = "latin";
    else if (malayalam.hasGlyphForCodePoint(cp)) key = "malayalam";
    else continue;
    const last = runs[runs.length - 1];
    if (last && last.key === key) last.text += char;
    else runs.push({ key, text: char });
  }
  return runs;
};

const cleanText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

const drawField = (page, fonts, field, rawText) => {
  const text = cleanText(rawText);
  if (!text) return;
  const runs = splitIntoRuns(text);
  if (!runs.length) return;

  const available = field.x1 - field.x0 - FIELD_PADDING * 2;
  const measure = (size) => runs.reduce((sum, run) => sum + fonts[run.key].widthOfTextAtSize(run.text, size), 0);

  // Shrink long values to fit on the line instead of running past it (text
  // width scales linearly with size, so one division is exact).
  const size = Math.max(MIN_FONT_SIZE, Math.min(field.size, available / measure(1)));

  let x = field.x0 + FIELD_PADDING + Math.max(0, (available - measure(size)) / 2);
  const y = page.getHeight() - field.lineTop + BASELINE_LIFT;
  for (const run of runs) {
    page.drawText(run.text, { x, y, size, font: fonts[run.key], color: INK });
    x += fonts[run.key].widthOfTextAtSize(run.text, size);
  }
};

/**
 * Builds the certificate PDF for one student.
 * @param {{ type: "state"|"district", name: string, examName: string, grade: string, examDate?: string }} data
 * @returns {Promise<Buffer>}
 */
const buildCertificatePdf = async ({ type, name, examName, grade, examDate }) => {
  const templateFile = TEMPLATE_FILES[type];
  if (!templateFile) throw new Error(`Unknown certificate type: ${type}`);

  const pdfDoc = await PDFDocument.load(readAsset(templateFile));
  pdfDoc.registerFontkit(fontkit);
  pdfDoc.setTitle("QSC Certificate");
  pdfDoc.setSubject(type === "state" ? "State Wise Certificate" : "District Wise Certificate");
  pdfDoc.setProducer("Quran Study Centre Kerala");
  pdfDoc.setCreator("Quran Study Centre Kerala");

  const values = [
    [FIELDS.name, name],
    [FIELDS.exam, examName],
    [FIELDS.date, examDate || getExamDateText()],
    [FIELDS.grade, grade],
  ];

  // Embed only the fonts the values actually need. Full (non-subset) embedding:
  // pdf-lib's subsetter is incompatible with fontkit 2.x.
  const needed = new Set(values.flatMap(([, text]) => splitIntoRuns(cleanText(text)).map((run) => run.key)));
  const fonts = {};
  for (const key of needed) {
    fonts[key] = await pdfDoc.embedFont(readAsset(key === "latin" ? LATIN_FONT_FILE : MALAYALAM_FONT_FILE), { subset: false });
  }

  const page = pdfDoc.getPages()[0];
  for (const [field, text] of values) drawField(page, fonts, field, text);

  return Buffer.from(await pdfDoc.save());
};

module.exports = {
  STATE_CERTIFICATE_STAGES,
  getExamStage,
  isFinalExam,
  getCertificateType,
  isCertificateEligible,
  getExamDisplayName,
  getExamDateText,
  buildCertificatePdf,
};
