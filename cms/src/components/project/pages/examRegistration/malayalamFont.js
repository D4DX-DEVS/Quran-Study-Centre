// Malayalam rendering for jsPDF / jspdf-autotable.
//
// jsPDF cannot shape complex Indic scripts (no glyph reordering / conjunct
// formation), so embedding the TTF directly produces garbled Malayalam.
// Instead we load the font into the DOM and let the BROWSER shape each
// Malayalam cell onto a <canvas>, then embed that as an image in the PDF cell.
// English/Latin cells are left as normal jsPDF text.
import malayalamFontUrl from "../../../../fonts/NotoSansMalayalam-Regular.ttf?url";

const FONT_FAMILY = "NotoSansMalayalamCanvas";

let cachedBase64 = null;
let fontFacePromise = null;

const arrayBufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

const getFontBase64 = async () => {
  if (!cachedBase64) {
    const res = await fetch(malayalamFontUrl);
    cachedBase64 = arrayBufferToBase64(await res.arrayBuffer());
  }
  return cachedBase64;
};

// Loads the font into document.fonts so <canvas> can shape Malayalam with it.
export const registerMalayalamFont = async () => {
  if (!fontFacePromise) {
    fontFacePromise = (async () => {
      const b64 = await getFontBase64();
      const face = new FontFace(FONT_FAMILY, `url(data:font/ttf;base64,${b64})`);
      await face.load();
      document.fonts.add(face);
    })();
  }
  return fontFacePromise;
};

// Matches any Malayalam Unicode codepoint (block U+0D00–U+0D7F).
const MALAYALAM_RE = /[ഀ-ൿ]/;
export const hasMalayalam = (value) => MALAYALAM_RE.test(value == null ? "" : String(value));

const normalizeColor = (c) => {
  if (Array.isArray(c)) return c;
  if (typeof c === "number") return [c, c, c];
  return [0, 0, 0];
};

const cellTextToString = (text) =>
  Array.isArray(text) ? text.join(" ") : String(text == null ? "" : text);

// Renders a (shaped) Malayalam string to a PNG via canvas.
// Returns { dataUrl, widthPt, heightPt } sized so the glyphs appear at fontSizePt.
const malayalamToImage = (text, fontSizePt, colorRgb) => {
  const pxPerPt = 4; // supersample for crisp output
  const fontPx = Math.max(1, Math.round(fontSizePt * pxPerPt));
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const fontSpec = `${fontPx}px "${FONT_FAMILY}"`;

  ctx.font = fontSpec;
  const metrics = ctx.measureText(text);
  const ascent = metrics.actualBoundingBoxAscent || fontPx * 0.85;
  const descent = metrics.actualBoundingBoxDescent || fontPx * 0.35;
  const pad = Math.ceil(fontPx * 0.25);
  const width = Math.max(1, Math.ceil(metrics.width) + pad * 2);
  const height = Math.max(1, Math.ceil(ascent + descent) + pad * 2);

  canvas.width = width;
  canvas.height = height;
  // Canvas state resets when dimensions change, so re-apply font/style.
  ctx.font = fontSpec;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = `rgb(${colorRgb[0]}, ${colorRgb[1]}, ${colorRgb[2]})`;
  ctx.fillText(text, pad, pad + ascent);

  return {
    dataUrl: canvas.toDataURL("image/png"),
    widthPt: width / pxPerPt,
    heightPt: height / pxPerPt,
  };
};

// Builds autoTable didParseCell / didDrawCell hooks that render Malayalam cells
// as shaped images while leaving Latin cells as native text.
export const malayalamCellHooks = (doc) => {
  const marked = new WeakMap();
  return {
    didParseCell: (data) => {
      const raw = cellTextToString(data.cell.text);
      if (hasMalayalam(raw)) {
        marked.set(data.cell, raw);
        // Blank the native text so jsPDF doesn't draw the garbled version.
        data.cell.text = [""];
      }
    },
    didDrawCell: (data) => {
      const raw = marked.get(data.cell);
      if (!raw) return;
      const cell = data.cell;
      const fontSize = cell.styles.fontSize || 8;
      const color = normalizeColor(cell.styles.textColor);
      const padLeft = cell.padding("left");
      const padRight = cell.padding("right");
      const padTop = cell.padding("top");
      const availW = cell.width - padLeft - padRight;

      const img = malayalamToImage(raw, fontSize, color);
      let w = img.widthPt;
      let h = img.heightPt;
      if (availW > 0 && w > availW) {
        const k = availW / w;
        w *= k;
        h *= k;
      }
      doc.addImage(img.dataUrl, "PNG", cell.x + padLeft, cell.y + padTop, w, h);
    },
  };
};
