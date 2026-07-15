import React, { useCallback, useEffect, useState } from "react";
import { Building2, ChevronLeft, ChevronRight, Download, Filter, LayoutGrid, MapPin, RotateCcw, Trophy, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import "jspdf-autotable";
import Layout from "../../../core/layout";
import { Container } from "../../../core/layout/styels";
import { getData } from "../../../../backend/api";

// Consolidation report — Student Exam section.
// No filter selected  -> one row per District + Exam (state-wide).
// District selected   -> one row per Area + Exam within that district.
// District + Area sel -> one row per Exam Center + Exam within that area.
// Exam center choice (studyCentre) mirrors examRegistration's verification-PDF
// logic: once scoped to a district/area, the centre a student registered at is
// the meaningful one, not the exam-day venue they may later be reassigned to.
// Grouping/summing happens server-side (exam-registration/consolidation-report)
// so the table can page through 15 group-rows at a time instead of pulling
// every registration into the browser.
const PAGE_SIZE = 15;

// Summary card shown above the table. Which cards appear depends on filter
// level — see the `level === ...` guards where these are rendered.
const SummaryCard = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-3 border border-gray-200 rounded-lg px-4 py-3 bg-white">
    <div className="p-2 rounded-md bg-blue-50 text-blue-600">
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <p className="text-xs text-gray-500 m-0">{label}</p>
      <p className="text-lg font-semibold m-0">{value}</p>
    </div>
  </div>
);

const ExamConsolidationReport = (props) => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = `Exam Consolidation Report - QSC Automation`;
  }, []);

  const [districts, setDistricts] = useState([]);
  const [areas, setAreas] = useState([]);
  const [selDistrict, setSelDistrict] = useState("");
  const [selArea, setSelArea] = useState("");

  const [groupedRows, setGroupedRows] = useState([]);
  const [totals, setTotals] = useState({ total: 0, private: 0, regular: 0, male: 0, female: 0 });
  const [counts, setCounts] = useState({ districtCount: 0, areaCount: 0, centerCount: 0 });
  const [top, setTop] = useState({ name: "-", total: 0 });
  const [topArea, setTopArea] = useState({ name: "-", district: "-", total: 0 });
  const [topCenter, setTopCenter] = useState({ name: "-", district: "-", area: "-", total: 0 });
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const d = await getData({}, "district/select");
      setDistricts(d?.data?.response || d?.data || []);
    })();
  }, []);

  useEffect(() => {
    if (!selDistrict) {
      setAreas([]);
      setSelArea("");
      return;
    }
    (async () => {
      const r = await getData({ district: selDistrict }, "area/get-area-by-district");
      setAreas(r?.data?.response || r?.data || []);
    })();
  }, [selDistrict]);

  const level = selArea ? "center" : selDistrict ? "area" : "district";
  const groupLabel = level === "district" ? "District" : level === "area" ? "Area" : "Exam Center";
  const groupField = level === "district" ? "district" : level === "area" ? "area" : "studyCentre";

  const loadPage = useCallback(async () => {
    setLoading(true);
    try {
      const filter = selArea ? { area: selArea } : selDistrict ? { district: selDistrict } : {};
      const r = await getData(
        { ...filter, level: groupField, skip: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE },
        "exam-registration/consolidation-report"
      );
      setGroupedRows(r?.data?.response || []);
      setTotalCount(r?.data?.totalCount || 0);
      setTotals(r?.data?.totals || { total: 0, private: 0, regular: 0, male: 0, female: 0 });
      setCounts(r?.data?.counts || { districtCount: 0, areaCount: 0, centerCount: 0 });
      setTop(r?.data?.top || { name: "-", total: 0 });
      setTopArea(r?.data?.topArea || { name: "-", district: "-", total: 0 });
      setTopCenter(r?.data?.topCenter || { name: "-", district: "-", area: "-", total: 0 });
    } catch (e) {
      props.setMessage?.({
        type: 1,
        content: e?.response?.data?.message || e.message || "Failed to load consolidation data.",
        proceed: "Okay",
      });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selDistrict, selArea, groupField, page]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  useEffect(() => {
    setPage(1);
  }, [selDistrict, selArea]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;

  const scopeLabel = selArea
    ? areas.find((a) => (a.id || a._id) === selArea)?.value || areas.find((a) => (a.id || a._id) === selArea)?.area
    : selDistrict
    ? districts.find((d) => (d.id || d._id) === selDistrict)?.value || districts.find((d) => (d.id || d._id) === selDistrict)?.district
    : "All Kerala";

  const wiseLabel = selArea ? "Area" : selDistrict ? "District" : "State";

  const [pdfLoading, setPdfLoading] = useState(false);

  const downloadPdf = async () => {
    if (!totalCount || pdfLoading) return;
    setPdfLoading(true);
    try {
      const filter = selArea ? { area: selArea } : selDistrict ? { district: selDistrict } : {};
      // Export always covers the full report, not just the visible page —
      // fetch every group in one shot (limit omitted -> server returns all).
      const r = await getData({ ...filter, level: groupField }, "exam-registration/consolidation-report");
      const allGroups = r?.data?.response || [];
      const allTotals = r?.data?.totals || totals;
      if (!allGroups.length) return;

      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const today = new Date().toLocaleDateString("en-GB");

      doc.setFontSize(14);
      doc.text("Exam Consolidation Report", pageWidth / 2, 30, { align: "center" });
      doc.setFontSize(11);
      doc.text(`${scopeLabel} (${wiseLabel} Wise)  |  Total: ${allTotals.total}  |  Printed: ${today}`, pageWidth / 2, 48, { align: "center" });

      doc.autoTable({
        startY: 62,
        head: [["#", groupLabel, "Exam Name", "Registered Students", "Private", "Regular", "Male", "Female"]],
        body: [
          ...allGroups.map((r, i) => [i + 1, r.group, r.examName, r.total, r.private, r.regular, r.male, r.female]),
          ["", "Total", "", allTotals.total, allTotals.private, allTotals.regular, allTotals.male, allTotals.female],
        ],
        styles: { fontSize: 9, cellPadding: 4, lineColor: 0, lineWidth: 0.2, textColor: 0 },
        headStyles: { fillColor: [230, 230, 230], textColor: 0, fontStyle: "bold" },
        footStyles: { fontStyle: "bold" },
        theme: "grid",
        columnStyles: {
          0: { halign: "center", cellWidth: 30 },
          3: { halign: "center" },
          4: { halign: "center" },
          5: { halign: "center" },
          6: { halign: "center" },
          7: { halign: "center" },
        },
        didParseCell: (data) => {
          if (data.row.index === allGroups.length) data.cell.styles.fillColor = [245, 245, 245];
        },
        didDrawPage: (d) => {
          doc.setFontSize(9);
          doc.text(`Page ${d.pageNumber}`, pageWidth - 40, doc.internal.pageSize.getHeight() - 12, { align: "right" });
        },
      });

      doc.save(`Exam Consolidation Report - ${scopeLabel} - ${today}.pdf`);
    } catch (e) {
      props.setMessage?.({
        type: 1,
        content: e?.response?.data?.message || e.message || "Failed to export PDF.",
        proceed: "Okay",
      });
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <Container className="noshadow">
      <div className="p-4 w-full flex-1 min-w-0">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold m-0">Exam Consolidation Report</h3>
            <p className="text-sm text-gray-500 m-0">{scopeLabel}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/exam-consolidation-by-centre")}
              className="flex items-center gap-1 text-sm px-3 py-2 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50"
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Exam Consolidation
            </button>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Users className="w-4 h-4" />
              <span>Total: {totals.total}</span>
            </div>
            <button
              type="button"
              onClick={downloadPdf}
              disabled={!totalCount || pdfLoading}
              className="flex items-center gap-1 text-sm px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5" /> {pdfLoading ? "Preparing…" : "Export PDF"}
            </button>
          </div>
        </div>

        <div className="flex items-end gap-3 flex-wrap mb-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 flex items-center gap-1">
              <Filter className="w-3 h-3" /> District
            </label>
            <select
              className="border border-gray-300 rounded-md px-3 py-2 text-sm min-w-[220px]"
              value={selDistrict}
              onChange={(e) => setSelDistrict(e.target.value)}
            >
              <option value="">All Districts</option>
              {districts.map((d) => (
                <option key={d.id || d._id} value={d.id || d._id}>
                  {d.value || d.district}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Area
            </label>
            <select
              className="border border-gray-300 rounded-md px-3 py-2 text-sm min-w-[220px] disabled:bg-gray-100 disabled:text-gray-400"
              value={selArea}
              onChange={(e) => setSelArea(e.target.value)}
              disabled={!selDistrict}
            >
              <option value="">All Areas</option>
              {areas.map((a) => (
                <option key={a.id || a._id} value={a.id || a._id}>
                  {a.value || a.area}
                </option>
              ))}
            </select>
          </div>

          {(selDistrict || selArea) && (
            <button
              type="button"
              onClick={() => {
                setSelDistrict("");
                setSelArea("");
              }}
              className="flex items-center gap-1 text-sm px-3 py-2 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          {level === "district" && (
            <SummaryCard icon={MapPin} label="Total Districts" value={counts.districtCount} />
          )}
          {level === "area" && (
            <SummaryCard icon={MapPin} label="Total Areas" value={counts.areaCount} />
          )}
          <SummaryCard icon={Building2} label="Total Exam Centers" value={counts.centerCount} />
          <SummaryCard icon={Users} label="Total Registered Students" value={totals.total} />
          <SummaryCard
            icon={Trophy}
            label={
              level === "district"
                ? "Top District (Most Registered)"
                : level === "area"
                ? "Top Area (Most Registered)"
                : "Top Exam Center (Most Registered)"
            }
            value={top.total ? `${top.name} (${top.total})` : "-"}
          />
          {level === "district" && (
            <SummaryCard
              icon={MapPin}
              label="Top Registration Area"
              value={topArea.total ? `${topArea.name}, ${topArea.district} (${topArea.total})` : "-"}
            />
          )}
          {level !== "center" && (
            <SummaryCard
              icon={Building2}
              label="Top Registration Exam Center"
              value={
                topCenter.total
                  ? selDistrict
                    ? `${topCenter.name}, ${topCenter.area} (${topCenter.total})`
                    : `${topCenter.name}, ${topCenter.district} / ${topCenter.area} (${topCenter.total})`
                  : "-"
              }
            />
          )}
        </div>

        <div className="overflow-auto border border-gray-200 rounded-lg">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold border-b border-gray-200">#</th>
                <th className="px-3 py-2 text-left font-semibold border-b border-gray-200">{groupLabel}</th>
                <th className="px-3 py-2 text-left font-semibold border-b border-gray-200">Exam Name</th>
                <th className="px-3 py-2 text-center font-semibold border-b border-gray-200">Registered Students</th>
                <th className="px-3 py-2 text-center font-semibold border-b border-gray-200">Private</th>
                <th className="px-3 py-2 text-center font-semibold border-b border-gray-200">Regular</th>
                <th className="px-3 py-2 text-center font-semibold border-b border-gray-200">Male</th>
                <th className="px-3 py-2 text-center font-semibold border-b border-gray-200">Female</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-gray-400">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && groupedRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-gray-400">
                    No registrations found.
                  </td>
                </tr>
              )}
              {!loading &&
                groupedRows.map((r, i) => (
                  <tr key={`${r.group}-${r.examName}`} className="border-t border-gray-100">
                    <td className="px-3 py-2">{(page - 1) * PAGE_SIZE + i + 1}</td>
                    <td className="px-3 py-2">{r.group}</td>
                    <td className="px-3 py-2">{r.examName}</td>
                    <td className="px-3 py-2 text-center">{r.total}</td>
                    <td className="px-3 py-2 text-center">{r.private}</td>
                    <td className="px-3 py-2 text-center">{r.regular}</td>
                    <td className="px-3 py-2 text-center">{r.male}</td>
                    <td className="px-3 py-2 text-center">{r.female}</td>
                  </tr>
                ))}
            </tbody>
            {!loading && groupedRows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-300 font-semibold bg-gray-50">
                  <td className="px-3 py-2" colSpan={3}>
                    Grand Total
                  </td>
                  <td className="px-3 py-2 text-center">{totals.total}</td>
                  <td className="px-3 py-2 text-center">{totals.private}</td>
                  <td className="px-3 py-2 text-center">{totals.regular}</td>
                  <td className="px-3 py-2 text-center">{totals.male}</td>
                  <td className="px-3 py-2 text-center">{totals.female}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {totalCount > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-3">
            <span className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </Container>
  );
};

export default Layout(ExamConsolidationReport);
