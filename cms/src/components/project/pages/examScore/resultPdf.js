// Shared result-PDF building blocks — used by the Results page exports and the
// "All Exam Centre's Results" bulk download, so every result PDF looks the same.
import { MAIN_TITLE, upper } from "./resultSheet";

export const MALAYALAM_FONT = "NotoSansMalayalam";

// Module-level cache so the font is only fetched once per session.
let _malayalamFontB64 = null;

export const loadMalayalamFont = async () => {
  if (_malayalamFontB64) return _malayalamFontB64;
  // jsDelivr serves fonts with CORS headers — safe to fetch from the browser.
  const FONT_URL =
    "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansMalayalam/NotoSansMalayalam-Regular.ttf";
  try {
    const res = await fetch(FONT_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    _malayalamFontB64 = btoa(bin);
    return _malayalamFontB64;
  } catch (e) {
    console.warn("Could not load Malayalam font — falling back to default.", e);
    return null;
  }
};

export const hasMalayalam = (text) => /[ഀ-ൿ]/.test(String(text ?? ""));

export const registerMalayalamFont = (doc, fontB64) => {
  if (fontB64) {
    doc.addFileToVFS(`${MALAYALAM_FONT}-Regular.ttf`, fontB64);
    doc.addFont(`${MALAYALAM_FONT}-Regular.ttf`, MALAYALAM_FONT, "normal");
  }
};

// Draws one exam+status group on the current page of a landscape A4 jsPDF:
// main title, scope and group title, then the results table (continuing onto
// further pages as needed) with a "Printed:" footer on every page.
export const drawGroupPdfPage = (doc, rows, title, scope = "State-wise", geo = { centre: true, area: true, district: true }, fontB64 = null) => {
  const FONT_NAME = MALAYALAM_FONT;
  const w = doc.internal.pageSize.getWidth();
  const hpage = doc.internal.pageSize.getHeight();
  const today = new Date().toLocaleDateString("en-GB");

  const setDocFont = (text) => {
    if (fontB64 && hasMalayalam(text)) doc.setFont(FONT_NAME, "normal");
    else doc.setFont("helvetica", "normal");
  };

  doc.setFontSize(16);
  setDocFont(MAIN_TITLE);
  doc.text(MAIN_TITLE, w / 2, 26, { align: "center" });
  doc.setFontSize(11);
  setDocFont(scope);
  doc.text(scope.toUpperCase(), w / 2, 44, { align: "center" });
  doc.setFontSize(14);
  setDocFont(title);
  doc.text(title.toUpperCase(), w / 2, 62, { align: "center" });

  const head = [["#", "REG NO", "NAME", "PHONE NUMBER", "SCORE", "GRADE"]];
  if (geo.centre) head[0].push("CENTRE");
  if (geo.area) head[0].push("AREA");
  if (geo.district) head[0].push("DISTRICT");

  doc.autoTable({
    startY: 76,
    head,
    body: rows.map((r, i) => {
      const row = [
        i + 1,
        upper(r.student?.regno),
        upper(r.student?.nameOfApplicant),
        upper(r.student?.mobileNumber),
        r.score ?? "-",
        upper(r.grade),
      ];
      if (geo.centre) row.push(upper(r.student?.centerRegistration?.nameOfCenter));
      if (geo.area) row.push(upper(r.student?.area?.area));
      if (geo.district) row.push(upper(r.student?.district?.district));
      return row;
    }),
    styles: { fontSize: 8, cellPadding: 3, lineColor: 0, lineWidth: 0.2, textColor: 0, font: "helvetica" },
    headStyles: { fillColor: [230, 230, 230], textColor: 0, fontStyle: "bold", font: "helvetica" },
    theme: "grid",
    columnStyles: {
      0: { halign: "center", cellWidth: 28 },
      4: { halign: "center", cellWidth: 40 },
      5: { halign: "center", cellWidth: 36 },
    },
    didParseCell: (hookData) => {
      if (fontB64 && hookData.section === "body") {
        const text = String(hookData.cell.raw ?? "");
        if (hasMalayalam(text)) {
          hookData.cell.styles.font = FONT_NAME;
          hookData.cell.styles.fontStyle = "normal";
        }
      }
    },
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`Printed: ${today}`, w - 20, hpage - 16, { align: "right" });
    },
  });
};
