// Parses free-form exam-type text (e.g. "Preliminary VI (Final): ...",
// "Secondary 1 :...") into a stable numeric sort key so exam levels order by
// curriculum stage (Preliminary I..VI, Secondary I..III, Higher Secondary
// I..III, ...) instead of alphabetically. Digits and Roman numerals are both
// accepted since raw exam-type text in this dataset mixes the two.

const LEVEL_BASE = {
  preliminary: 0,
  secondary: 100,
  "higher secondary": 200,
};

const UNKNOWN_LEVEL_BASE = 900;

function romanToInt(roman) {
  const values = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  for (let i = 0; i < roman.length; i += 1) {
    const cur = values[roman[i]];
    const next = values[roman[i + 1]];
    if (!cur) return 0;
    if (next && cur < next) total -= cur;
    else total += cur;
  }
  return total;
}

function detectLevel(text) {
  const lower = text.toLowerCase();
  if (lower.includes("higher secondary")) return "higher secondary";
  if (lower.includes("secondary")) return "secondary";
  if (lower.includes("preliminary")) return "preliminary";
  return null;
}

function detectNumber(text, level) {
  const rest = level ? text.toLowerCase().split(level).join(" ") : text.toLowerCase();

  const digitMatch = rest.match(/\d+/);
  if (digitMatch) return parseInt(digitMatch[0], 10);

  const romanMatch = rest.match(/\b([ivx]+)\b/i);
  if (romanMatch) return romanToInt(romanMatch[1].toUpperCase());

  return 0;
}

// Lower sorts earlier. Same level+number always yields the same key, so
// re-running a backfill against unchanged exam types is idempotent.
function computeExamSortOrder(text) {
  if (!text) return UNKNOWN_LEVEL_BASE;
  const level = detectLevel(text);
  const number = detectNumber(text, level);
  const base = level ? LEVEL_BASE[level] : UNKNOWN_LEVEL_BASE;
  return base + number;
}

// Single-digit exam-stage code embedded in registration numbers:
// Preliminary I-VI -> 1-6, Secondary I-III -> 7-9.
// Returns null for any stage outside this fixed 9-exam scheme (e.g. a future
// Higher Secondary) — callers must decide how to handle that explicitly
// rather than silently mis-encoding it.
function computeExamStageDigit(text) {
  if (!text) return null;
  const level = detectLevel(text);
  const number = detectNumber(text, level);
  if (level === "preliminary" && number >= 1 && number <= 6) return number;
  if (level === "secondary" && number >= 1 && number <= 3) return 6 + number;
  return null;
}

module.exports = { computeExamSortOrder, computeExamStageDigit, romanToInt, detectLevel, detectNumber };
