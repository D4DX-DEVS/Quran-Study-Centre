import React, { useState } from "react";
import { Download } from "lucide-react";
import { ActionButton } from "../shared/districtSurface";
import { downloadStickersZip } from "../../../../utils/stickerExport";

// Self-contained "download a zip of stickers" button. `getStickers` is an
// async function that resolves the exact list of sticker rows to bundle —
// the caller decides whether that's the already-loaded filtered grid or a
// fresh fetch of every center in scope (state admin "download all").
const DownloadZipButton = ({ label, zipName, stateName, generatedAt, getStickers, className = "secondary", setMessage }) => {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const stickers = await getStickers();
      if (!stickers || stickers.length === 0) {
        setMessage?.({ type: 1, content: "No stickers found for the current selection.", proceed: "Okay" });
        return;
      }

      const { skipped, generated } = await downloadStickersZip(stickers, { zipName, stateName, generatedAt });

      if (generated === 0) {
        setMessage?.({
          type: 1,
          content: "None of the selected exam centers have completed Attendance Register numbers yet.",
          proceed: "Okay",
        });
      } else if (skipped > 0) {
        setMessage?.({
          type: 2,
          content: `Downloaded ${generated} sticker(s). Skipped ${skipped} exam center(s) with incomplete Attendance Register numbers.`,
          proceed: "Okay",
        });
      }
    } catch (e) {
      setMessage?.({ type: 1, content: "Failed to generate the sticker ZIP.", proceed: "Okay" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ActionButton type="button" className={className} disabled={loading} onClick={handleClick}>
      <Download size={16} />
      <span>{loading ? "Generating..." : label}</span>
    </ActionButton>
  );
};

export default DownloadZipButton;
