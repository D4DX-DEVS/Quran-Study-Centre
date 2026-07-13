import React from "react";
import { Eye, Printer, Download, AlertTriangle } from "lucide-react";
import { ActionButton } from "../shared/districtSurface";

// One card per exam center in the Exam Center Stickers grid.
const StickerCard = ({ sticker, exportPrivilege, onPreview, onPrint, onDownload, downloading }) => {
  const disabled = sticker.hasIncompleteRegno;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div>
        <div className="text-base font-semibold text-gray-900">{sticker.examCenterName}</div>
        <div className="text-xs text-gray-500">
          {sticker.area || "-"}, {sticker.district || "-"}
          {sticker.centerCode ? ` · ${sticker.centerCode}` : ""}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
        <span className="text-xs text-gray-500">Total Students</span>
        <span className="text-lg font-bold text-gray-900">{sticker.totalStudents}</span>
      </div>

      {disabled && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>Attendance Register numbers have not been generated for this Exam Center.</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <ActionButton type="button" className="ghost" disabled={disabled} onClick={() => onPreview(sticker)}>
          <Eye size={14} />
          <span>Preview</span>
        </ActionButton>
        <ActionButton type="button" className="ghost" disabled={disabled} onClick={() => onPrint(sticker)}>
          <Printer size={14} />
          <span>Print</span>
        </ActionButton>
        {exportPrivilege && (
          <ActionButton type="button" className="secondary" disabled={disabled || downloading} onClick={() => onDownload(sticker)}>
            <Download size={14} />
            <span>{downloading ? "Generating..." : "Download PDF"}</span>
          </ActionButton>
        )}
      </div>
    </div>
  );
};

export default StickerCard;
