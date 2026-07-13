// Canonical student ordering — district -> area -> exam centre -> exam stage
// -> gender -> mode of study -> _id (deterministic final tiebreaker).
//
// Every screen that lists/paginates students in "predefined order" (the
// attendance/registered-students table, registration-number generation, ...)
// must use these exact same helpers. Two independently-written sorts that are
// each "close enough" to the spec silently disagree on ties (a clubbed
// student's exam centre, Private vs Regular, ...), which breaks the
// consecutive-per-prefix guarantee registration numbers depend on.

const GENDER_ORDER = { Male: 0, Female: 1, Other: 2 };
const MODE_ORDER = { Regular: 0, Private: 1 };

// The "Exam Center" shown to students/admins is the home study centre
// (`centerRegistration`); `assignedExamCenter` (the clubbing-resolved exam-day
// venue) is only used as a fallback for records that have no home centre.
function resolveExamCenterName(doc) {
  return doc.centerRegistration?.nameOfCenter || doc.assignedExamCenter?.nameOfCenter || "";
}

function genderRank(gender) {
  return GENDER_ORDER[gender] ?? 99;
}

function modeRank(status) {
  return MODE_ORDER[status] ?? 99;
}

function examSortOrder(examTypeDoc) {
  return examTypeDoc?.sortOrder ?? 900;
}

// `s` fields: districtName, areaName, centerName, examSortOrder, gender, status, _id
function compareBySpec(a, b) {
  return (
    a.districtName.localeCompare(b.districtName) ||
    a.areaName.localeCompare(b.areaName) ||
    a.centerName.localeCompare(b.centerName) ||
    (a.examSortOrder - b.examSortOrder) ||
    (genderRank(a.gender) - genderRank(b.gender)) ||
    (modeRank(a.status) - modeRank(b.status)) ||
    String(a._id).localeCompare(String(b._id))
  );
}

module.exports = {
  GENDER_ORDER,
  MODE_ORDER,
  resolveExamCenterName,
  genderRank,
  modeRank,
  examSortOrder,
  compareBySpec,
};
