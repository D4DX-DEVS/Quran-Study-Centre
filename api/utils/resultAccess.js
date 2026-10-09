// Shared guards for anything that hands a student's result or certificate to a
// caller who is not signed in as staff: the publication switch, the lookup-key
// parser and the short-lived signed reference that ties a certificate
// download to exactly one result.

const crypto = require("crypto");
const FloatingSettings = require("../models/floatingMenuSettings");

const CERTIFICATE_REF_TTL_MS = 30 * 60 * 1000;

// Results are published when an admin switches "Result" on in Landing Page
// Settings (FloatingSettings.result). This is the same switch the public
// Result page and the student portal already honour. Fails closed: any error
// reading it counts as "not published".
const areResultsPublished = async () => {
  try {
    const settings = await FloatingSettings.findOne().sort({ updatedAt: -1, _id: -1 }).select("result").lean();
    return settings?.result === true;
  } catch (err) {
    console.error("areResultsPublished failed:", err.message);
    return false;
  }
};

// A registration is for one exam. Real data has a few registrations whose mark
// was also entered under a different exam (same mark, wrong exam); showing both
// would mix examinations. Prefer the marks recorded for the exam the student
// registered for, and only fall back to whatever exists when none match.
const scoresForRegistration = (registration, scores) => {
  const registeredExam = registration.nameOfExamAppearingNow?._id ?? registration.nameOfExamAppearingNow;
  const own = scores.filter((score) => String(score.exam?._id ?? score.exam) === String(registeredExam));
  return own.length ? own : scores;
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Mobile numbers are stored as typed at registration, so the same phone can be
// saved as 10 digits (98xxxxxxxx), with the country code (9198xxxxxxxx — about
// 3% of registrations) or with a stray digit. A typed number therefore matches
// itself plus its with/without-country-code twin.
const mobileCandidates = (digits) => {
  const numbers = new Set([Number(digits)]);
  if (digits.length === 10) numbers.add(Number(`91${digits}`));
  if (digits.length === 12 && digits.startsWith("91")) numbers.add(Number(digits.slice(2)));
  if (digits.length === 11 && digits.startsWith("0")) {
    numbers.add(Number(digits.slice(1)));
    numbers.add(Number(`91${digits.slice(1)}`));
  }
  return [...numbers].filter((n) => Number.isSafeInteger(n));
};

// Turns whatever the visitor typed into a safe Mongo filter on registrations,
// or null when it is not a plausible mobile / registration number. Only plain
// strings are accepted, so query-string tricks such as `regno[$ne]=` can never
// reach the query.
const buildLookupFilter = (raw) => {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (value.length < 3 || value.length > 40) return null;

  const digits = value.replace(/[\s-]/g, "").replace(/^\+/, "");
  if (/^[0-9]{8,13}$/.test(digits)) return { mobileNumber: { $in: mobileCandidates(digits) } };

  if (/^[A-Za-z0-9][A-Za-z0-9 /._-]*$/.test(value)) {
    return { regno: new RegExp(`^${escapeRegex(value)}$`, "i") };
  }
  return null;
};

const getRefKey = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return crypto.createHash("sha256").update(`qsc-certificate-ref:${secret}`).digest();
};

// Opaque, tamper-proof pointer to one ExamScore. The download endpoint accepts
// nothing else from public callers, so the student's identity cannot be
// changed by editing a request parameter.
const signCertificateRef = (examScoreId, ttlMs = CERTIFICATE_REF_TTL_MS) => {
  const payload = Buffer.from(JSON.stringify({ s: String(examScoreId), e: Date.now() + ttlMs })).toString("base64url");
  const signature = crypto.createHmac("sha256", getRefKey()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
};

// Returns { examScoreId } for a genuine, unexpired ref; otherwise
// { error: "invalid" | "expired" }.
const verifyCertificateRef = (ref) => {
  if (typeof ref !== "string" || ref.length > 512) return { error: "invalid" };
  const [payload, signature, extra] = ref.split(".");
  if (!payload || !signature || extra !== undefined) return { error: "invalid" };

  const expected = crypto.createHmac("sha256", getRefKey()).update(payload).digest();
  let provided;
  try {
    provided = Buffer.from(signature, "base64url");
  } catch (_) {
    return { error: "invalid" };
  }
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return { error: "invalid" };

  try {
    const { s, e } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof s !== "string" || !Number.isFinite(e)) return { error: "invalid" };
    if (Date.now() > e) return { error: "expired" };
    return { examScoreId: s };
  } catch (_) {
    return { error: "invalid" };
  }
};

// Result and certificate responses are personal: never cache them, never let a
// crawler keep them.
const setPrivateHeaders = (res) => {
  res.set({
    "Cache-Control": "no-store, private",
    Pragma: "no-cache",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  });
};

module.exports = {
  areResultsPublished,
  scoresForRegistration,
  buildLookupFilter,
  signCertificateRef,
  verifyCertificateRef,
  setPrivateHeaders,
};
