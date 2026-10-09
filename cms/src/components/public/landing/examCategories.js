// The nine exam stages the public site is organised around — the same nine the
// Syllabus page shows and the exam types / registration numbers encode
// (Preliminary I-VI, Secondary I-III). `value` is the exam name stored on each
// Model Question & Answer Key file, so it must match the API's stage parser
// (api/utils/examLevelOrder.js computeExamStageDigit).
export const EXAM_CATEGORY_GROUPS = [
  {
    group: "Preliminary",
    categories: ["Preliminary I", "Preliminary II", "Preliminary III", "Preliminary IV", "Preliminary V", "Preliminary VI"],
  },
  {
    group: "Secondary",
    categories: ["Secondary I", "Secondary II", "Secondary III"],
  },
];

export const EXAM_CATEGORIES = EXAM_CATEGORY_GROUPS.flatMap(({ group, categories }) => categories.map((value) => ({ value, group })));

// The two kinds of file each category can have (values match the API enum).
export const MODEL_PAPER_KINDS = ["Model Question Paper", "Answer Key"];
