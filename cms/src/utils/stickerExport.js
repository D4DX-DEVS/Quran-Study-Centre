import React from "react";
import { pdf } from "@react-pdf/renderer";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import StickerDocument from "../components/project/pages/examCenterStickers/StickerDocument";

// Shared by ExamCenterStickers/index.jsx (single download) and
// DownloadZipButton.jsx (zip/filtered-zip/all) so both build the exact same
// A5 sticker PDF from the same StickerDocument component.

const MALAYALAM_BLOCK = "ഀ-ൿ";
const NON_FILENAME_CHARS = new RegExp(`[^a-zA-Z0-9${MALAYALAM_BLOCK}\\s-]`, "g");

export const sanitizeName = (value) =>
  String(value || "")
    .replace(NON_FILENAME_CHARS, "")
    .trim()
    .replace(/\s+/g, "-") || "Unnamed";

export const buildStickerPdfBlob = async (sticker, generatedAt) => {
  const doc = React.createElement(StickerDocument, { sticker, generatedAt });
  return pdf(doc).toBlob();
};

export const downloadStickerPdf = async (sticker, generatedAt) => {
  const blob = await buildStickerPdfBlob(sticker, generatedAt);
  saveAs(blob, `${sanitizeName(sticker.examCenterName)}-sticker.pdf`);
};

// Builds a State/District/Area/ExamCenter/sticker.pdf zip from a flat list of
// sticker data rows. Centers flagged `hasIncompleteRegno` are skipped (never
// generate an incomplete sticker) — the skipped count is returned so the
// caller can surface it to the user instead of silently dropping centers.
export const buildStickersZip = async (stickers = [], { stateName = "State", generatedAt, onProgress } = {}) => {
  const zip = new JSZip();
  const usable = stickers.filter((s) => !s?.hasIncompleteRegno);
  const skipped = stickers.length - usable.length;

  for (let i = 0; i < usable.length; i += 1) {
    const sticker = usable[i];
    const blob = await buildStickerPdfBlob(sticker, generatedAt);
    const folder = zip
      .folder(sanitizeName(stateName))
      .folder(sanitizeName(sticker.district || "Unknown-District"))
      .folder(sanitizeName(sticker.area || "Unknown-Area"))
      .folder(sanitizeName(sticker.examCenterName || "Unknown-Center"));
    folder.file("sticker.pdf", blob);
    onProgress?.(i + 1, usable.length);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  return { blob, skipped, generated: usable.length };
};

export const downloadStickersZip = async (stickers, opts = {}) => {
  const { blob, skipped, generated } = await buildStickersZip(stickers, opts);
  saveAs(blob, `${sanitizeName(opts.zipName || "Exam-Center-Stickers")}.zip`);
  return { skipped, generated };
};
