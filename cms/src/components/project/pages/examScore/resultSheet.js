// Shared result-export building blocks — used by the Results page exports and
// the district-wise bulk download, so every result workbook is laid out and
// grouped the same way.

// Exam names are stored as "Preliminary I: <syllabus text>" — only the short
// name before the colon should ever be shown in the UI or exports.
export const examName = (text) => String(text || "").split(":")[0].trim();

export const MAIN_TITLE = "QSC ANNUAL EXAM RESULT - 2026";
export const upper = (text) => (text === undefined || text === null || text === "" ? "-" : String(text).toUpperCase());

// Writes one exam+status group's results table into a worksheet: main title,
// scope and group title rows, a bordered header, one row per result and a
// "Printed:" footer.
export const fillGroupSheet = (sheet, rows, title, scope = "State-wise", geo = { centre: true, area: true, district: true }) => {
  const today = new Date().toLocaleDateString("en-GB");

  const columns = [
    { header: "#", key: "sl", width: 6 },
    { header: "REG NO", key: "regno", width: 14 },
    { header: "NAME", key: "name", width: 28 },
    { header: "PHONE NUMBER", key: "phone", width: 18 },
    { header: "SCORE", key: "score", width: 10 },
    { header: "GRADE", key: "grade", width: 10 },
  ];
  if (geo.centre) columns.push({ header: "CENTRE", key: "centre", width: 26 });
  if (geo.area) columns.push({ header: "AREA", key: "area", width: 18 });
  if (geo.district) columns.push({ header: "DISTRICT", key: "district", width: 18 });
  sheet.columns = columns.map((c) => ({ key: c.key, width: c.width }));

  // Main title + scope + group title rows above the table header.
  sheet.spliceRows(1, 0, [MAIN_TITLE], [scope.toUpperCase()], [title.toUpperCase()], []);
  sheet.mergeCells(1, 1, 1, columns.length);
  sheet.mergeCells(2, 1, 2, columns.length);
  sheet.mergeCells(3, 1, 3, columns.length);
  sheet.getCell("A1").font = { bold: true, size: 14 };
  sheet.getCell("A1").alignment = { horizontal: "center" };
  sheet.getCell("A2").font = { bold: true, size: 12 };
  sheet.getCell("A2").alignment = { horizontal: "center" };
  sheet.getCell("A3").font = { bold: true, size: 11 };
  sheet.getCell("A3").alignment = { horizontal: "center" };

  const headerRow = sheet.addRow(columns.map((c) => c.header));
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: "center" };
  headerRow.eachCell((cell) => {
    cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
  });

  rows.forEach((r, i) => {
    const row = [i + 1, upper(r.student?.regno), upper(r.student?.nameOfApplicant), upper(r.student?.mobileNumber), r.score ?? "-", upper(r.grade)];
    if (geo.centre) row.push(upper(r.student?.centerRegistration?.nameOfCenter));
    if (geo.area) row.push(upper(r.student?.area?.area));
    if (geo.district) row.push(upper(r.student?.district?.district));
    const dataRow = sheet.addRow(row);
    dataRow.alignment = { horizontal: "center" };
  });

  // Printed date — bottom right, after a blank spacer row.
  sheet.addRow([]);
  const printedRow = sheet.addRow([`Printed: ${today}`]);
  sheet.mergeCells(printedRow.number, 1, printedRow.number, columns.length);
  sheet.getCell(printedRow.number, 1).alignment = { horizontal: "right" };
};

// Groups exam-score rows by (exam, Private/Regular), sorted by exam-type list
// order then Regular-before-Private, with each group's rows sorted by score
// descending. Groups with zero rows are simply absent from the map.
export const groupRowsByExamAndStatus = (data, examTypes) => {
  const examOrder = examTypes.map((e) => e.id || e._id);
  const orderIndex = (examId) => {
    const idx = examOrder.indexOf(examId);
    return idx === -1 ? examOrder.length : idx;
  };
  const statusOrder = { Regular: 0, Private: 1 };

  const groupsMap = new Map();
  data.forEach((r) => {
    const examId = r.exam?._id || r.exam;
    const status = r.student?.status === "Private" ? "Private" : "Regular";
    const key = `${examId}__${status}`;
    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        examId,
        examLabel: examName(r.exam?.examType) || "Unknown Exam",
        status,
        rows: [],
      });
    }
    groupsMap.get(key).rows.push(r);
  });

  return Array.from(groupsMap.values())
    .map((g) => ({ ...g, rows: [...g.rows].sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0)) }))
    .sort((a, b) => {
      const examDiff = orderIndex(a.examId) - orderIndex(b.examId);
      if (examDiff !== 0) return examDiff;
      return (statusOrder[a.status] ?? 2) - (statusOrder[b.status] ?? 2);
    });
};
