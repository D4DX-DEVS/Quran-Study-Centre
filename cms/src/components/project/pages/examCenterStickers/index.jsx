import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import Layout from "../../../core/layout";
import { Container } from "../../../core/layout/styels";
import { getData } from "../../../../backend/api";
import { DistrictPageHeader, DistrictOverviewCards, PageWrap } from "../shared/districtSurface";
import { Building2, Users, AlertTriangle } from "lucide-react";
import StickerFilters from "./StickerFilters";
import StickerCard from "./StickerCard";
import StickerPreview from "./StickerPreview";
import DownloadZipButton from "./DownloadZipButton";
import { downloadStickerPdf } from "../../../../utils/stickerExport";

const ExamCenterStickers = (props) => {
  const loggedInUser = useSelector((state) => state.login?.data?.user) || {};
  const adminDistrictId = loggedInUser?.districts?._id || loggedInUser?.districts || "";
  const isDistrictAdmin = Boolean(adminDistrictId);

  const [filters, setFilters] = useState({ district: "", area: "", examCenter: "" });
  const [stickers, setStickers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewSticker, setPreviewSticker] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [generatedAt] = useState(() => new Date());
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);

  useEffect(() => {
    document.title = "Exam Center Stickers - QSC Automation";
  }, []);

  const fetchRequestIdRef = useRef(0);

  const fetchStickers = useCallback(
    async (activeFilters) => {
      const requestId = ++fetchRequestIdRef.current;
      setLoading(true);
      try {
        const query = {
          ...(activeFilters.district ? { district: activeFilters.district } : {}),
          ...(activeFilters.area ? { area: activeFilters.area } : {}),
          ...(activeFilters.examCenter ? { examCenter: activeFilters.examCenter } : {}),
        };
        const res = await getData(query, "exam-center-stickers/list");
        if (requestId !== fetchRequestIdRef.current) return; // stale response from a superseded filter change
        if (res?.data?.success) {
          setStickers(res.data.response || []);
        } else {
          setStickers([]);
        }
      } catch (e) {
        if (requestId !== fetchRequestIdRef.current) return;
        setStickers([]);
        props.setMessage?.({ type: 1, content: "Failed to load exam center stickers.", proceed: "Okay" });
      } finally {
        if (requestId === fetchRequestIdRef.current) setLoading(false);
      }
    },
    [props]
  );

  useEffect(() => {
    fetchStickers(filters);
  }, [filters, fetchStickers]);

  const totals = useMemo(() => {
    const totalStudents = stickers.reduce((sum, s) => sum + (s.totalStudents || 0), 0);
    const incomplete = stickers.filter((s) => s.hasIncompleteRegno).length;
    return { centers: stickers.length, totalStudents, incomplete };
  }, [stickers]);

  // Incomplete centers always float to the top so they're visible without
  // hunting through the whole grid; clicking the "Incomplete" stat isolates
  // just those.
  const displayedStickers = useMemo(() => {
    const sorted = [...stickers].sort((a, b) => Number(b.hasIncompleteRegno) - Number(a.hasIncompleteRegno));
    return showIncompleteOnly ? sorted.filter((s) => s.hasIncompleteRegno) : sorted;
  }, [stickers, showIncompleteOnly]);

  const overviewCards = useMemo(
    () => [
      { key: "centers", label: "Exam Centers", value: totals.centers, meta: "Matching current filters", icon: <Building2 size={16} /> },
      { key: "students", label: "Total Students", value: totals.totalStudents, meta: "Across matching exam centers", icon: <Users size={16} /> },
      ...(totals.incomplete > 0
        ? [
            {
              key: "incomplete",
              label: "Incomplete",
              value: totals.incomplete,
              meta: showIncompleteOnly ? "Showing only these — click to clear" : "Attendance Register numbers pending — click to view",
              icon: <AlertTriangle size={16} />,
              active: showIncompleteOnly,
              onClick: () => setShowIncompleteOnly((prev) => !prev),
            },
          ]
        : []),
    ],
    [totals, showIncompleteOnly]
  );

  const handleDownloadSingle = async (sticker) => {
    setDownloadingId(sticker.examCenterId);
    try {
      await downloadStickerPdf(sticker, generatedAt);
    } catch (e) {
      props.setMessage?.({ type: 1, content: "Failed to generate sticker PDF.", proceed: "Okay" });
    } finally {
      setDownloadingId(null);
    }
  };

  const fetchAllStickers = useCallback(async () => {
    const res = await getData({}, "exam-center-stickers/export-list");
    return res?.data?.success ? res.data.response || [] : [];
  }, []);

  const districtLabel = filters.district ? stickers[0]?.district || "Selected-District" : isDistrictAdmin ? stickers[0]?.district || "District" : "All-Districts";

  return (
    <Container className="noshadow">
      <PageWrap>
        <DistrictPageHeader
          title="Exam Center Stickers"
          description="A5 printable stickers summarizing each exam center's assigned students and exam-wise register number ranges, sourced from the Attendance Register."
        />

        <DistrictOverviewCards cards={overviewCards} />

        <StickerFilters isDistrictAdmin={isDistrictAdmin} filters={filters} onChange={setFilters} />

        {props.exportPrivilege && (
          <div className="flex flex-wrap items-center gap-2">
            <DownloadZipButton
              label="Download Filtered ZIP"
              zipName={`Exam-Center-Stickers-${districtLabel}`}
              stateName="QSC"
              generatedAt={generatedAt}
              getStickers={async () => stickers}
              setMessage={props.setMessage}
            />
            {!isDistrictAdmin && (
              <DownloadZipButton
                label="Download All"
                zipName="Exam-Center-Stickers-All"
                stateName="QSC"
                generatedAt={generatedAt}
                getStickers={fetchAllStickers}
                className="ghost"
                setMessage={props.setMessage}
              />
            )}
          </div>
        )}

        {loading && <div className="py-10 text-center text-sm text-gray-500">Loading exam center stickers...</div>}

        {!loading && stickers.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-14 text-center text-sm text-gray-500">
            No exam centers with assigned students found for the current filters.
          </div>
        )}

        {!loading && stickers.length > 0 && displayedStickers.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-14 text-center text-sm text-gray-500">
            No incomplete exam centers in the current filters.
          </div>
        )}

        {!loading && displayedStickers.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {displayedStickers.map((sticker) => (
              <StickerCard
                key={sticker.examCenterId}
                sticker={sticker}
                exportPrivilege={props.exportPrivilege}
                downloading={downloadingId === sticker.examCenterId}
                onPreview={setPreviewSticker}
                onPrint={setPreviewSticker}
                onDownload={handleDownloadSingle}
              />
            ))}
          </div>
        )}

        {previewSticker && (
          <StickerPreview sticker={previewSticker} generatedAt={generatedAt} onClose={() => setPreviewSticker(null)} setMessage={props.setMessage} />
        )}
      </PageWrap>
    </Container>
  );
};

export default Layout(ExamCenterStickers);
