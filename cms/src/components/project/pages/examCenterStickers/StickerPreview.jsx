import React from "react";
import { PDFViewer } from "@react-pdf/renderer";
import { Download, X } from "lucide-react";
import { ModalBackdrop, ModalCard, ModalHeader, PdfBody, ActionButton, CloseButton } from "../shared/districtSurface";
import StickerDocument from "./StickerDocument";
import { downloadStickerPdf } from "../../../../utils/stickerExport";

// Preview modal for a single Exam Center Sticker. Printing is done through
// the embedded PDF viewer's own toolbar (same as the browser-native PDF.js
// print control used everywhere else @react-pdf/renderer's PDFViewer is used
// in this app, e.g. centerRegistration/index.jsx) — no separate print path.
const StickerPreview = ({ sticker, generatedAt, onClose, setMessage }) => {
  if (!sticker) return null;

  const handleDownload = async () => {
    try {
      await downloadStickerPdf(sticker, generatedAt);
    } catch (e) {
      setMessage?.({ type: 1, content: "Failed to generate sticker PDF." });
    }
  };

  return (
    <ModalBackdrop onClick={onClose}>
      <ModalCard onClick={(event) => event.stopPropagation()} style={{ width: "min(100%, 620px)", minHeight: "85dvh", overflow: "hidden" }}>
        <ModalHeader>
          <div>
            <h3>{sticker.examCenterName}</h3>
            <p>Exam Center Sticker preview (A5, portrait).</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <ActionButton className="secondary" onClick={handleDownload}>
              <Download size={16} />
              <span>Download PDF</span>
            </ActionButton>
            <CloseButton aria-label="Close" onClick={onClose}>
              <X size={16} />
            </CloseButton>
          </div>
        </ModalHeader>
        <PdfBody>
          <PDFViewer style={{ width: "100%", flex: 1, minHeight: 0 }}>
            <StickerDocument sticker={sticker} generatedAt={generatedAt} />
          </PDFViewer>
        </PdfBody>
      </ModalCard>
    </ModalBackdrop>
  );
};

export default StickerPreview;
