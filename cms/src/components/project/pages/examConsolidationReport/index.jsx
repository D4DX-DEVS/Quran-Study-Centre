import React, { useCallback, useEffect, useState } from "react";
import { Building2, ChevronLeft, ChevronRight, Download, Filter, LayoutGrid, MapPin, RotateCcw, Trophy, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import jsPDF from "jspdf";
import "jspdf-autotable";
import ExcelJS from "exceljs";
import Layout from "../../../core/layout";
import { Container } from "../../../core/layout/styels";
import { getData } from "../../../../backend/api";

// Consolidation report — Student Exam section.
// Rows always break down to District + Area + Exam Center + Exam (finest
// grain), regardless of which district/area filter is active. The District
// dropdown narrows scope; `level` (district/area/studyCentre) still drives
// which "top ..." summary card is shown, mirroring examRegistration's
// verification-PDF logic where the centre a student registered at is the
// meaningful one, not the exam-day venue they may later be reassigned to.
// `centerTotal` on each row is the exam center's headcount across ALL exams,
// not just the row's own exam — used for the "No. of Students" column and
// the "fewer than 5 students" filter. Grouping/summing happens server-side
// (exam-registration/consolidation-report) so the table can page through 15
// group-rows at a time instead of pulling every registration into the browser.
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

  // Any user scoped to a single district gets a locked district filter — no
  // other districts selectable. Same pattern as examCenterAttendance/index.jsx.
  const loggedInUser = useSelector((state) => state.login?.data?.user) || {};
  const adminDistrictId = loggedInUser?.districts?._id || loggedInUser?.districts || "";
  const isDistrictAdmin = Boolean(adminDistrictId);

  const [districts, setDistricts] = useState([]);
  const [areas, setAreas] = useState([]);
  const [selDistrict, setSelDistrict] = useState(adminDistrictId);
  const [selArea, setSelArea] = useState("");
  const [lowStudents, setLowStudents] = useState(false);

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
  const groupField = level === "district" ? "district" : level === "area" ? "area" : "studyCentre";

  const loadPage = useCallback(async () => {
    setLoading(true);
    try {
      const filter = selArea ? { area: selArea } : selDistrict ? { district: selDistrict } : {};
      const r = await getData(
        { ...filter, level: groupField, lowStudents, skip: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE },
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
  }, [selDistrict, selArea, groupField, lowStudents, page]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  useEffect(() => {
    setPage(1);
  }, [selDistrict, selArea, lowStudents]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;

  const scopeLabel = selArea
    ? areas.find((a) => (a.id || a._id) === selArea)?.value || areas.find((a) => (a.id || a._id) === selArea)?.area
    : selDistrict
    ? districts.find((d) => (d.id || d._id) === selDistrict)?.value || districts.find((d) => (d.id || d._id) === selDistrict)?.district
    : "All Kerala";

  const wiseLabel = selArea ? "Area" : selDistrict ? "District" : "State";

  const [exportLoading, setExportLoading] = useState(false);

  const HEAD_ROW = ["District", "Area", "Center Name", "Total Students", "Exam Name", "Registered Students", "Private", "Regular", "Male", "Female"];

  // Group-start detection shared by both PDF and Excel export — rows for the
  // same exam center are adjacent (server sorts by district/area/center/exam).
  const groupStarts = (allGroups) =>
    allGroups.map((r, i) => {
      const prev = allGroups[i - 1];
      const isGroupStart = !prev || prev.district !== r.district || prev.area !== r.area || prev.center !== r.center;
      let groupSpan = 0;
      if (isGroupStart) {
        groupSpan = 1;
        for (let j = i + 1; j < allGroups.length; j++) {
          const n = allGroups[j];
          if (n.district === r.district && n.area === r.area && n.center === r.center) groupSpan++;
          else break;
        }
      }
      return { row: r, isGroupStart, groupSpan };
    });

  const buildPdf = (allGroups, allTotals, today) => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(14);
    doc.text("Exam Consolidation Report", pageWidth / 2, 30, { align: "center" });
    doc.setFontSize(11);
    doc.text(`${scopeLabel} (${wiseLabel} Wise)  |  Total: ${allTotals.total}  |  Printed: ${today}`, pageWidth / 2, 48, { align: "center" });

    // Cells covered by a rowSpan from a prior row must be omitted from
    // this row's array entirely (jspdf-autotable shifts columns using the
    // earlier row's rowSpan) — mirrors the merged District/Area/Center/
    // Total-Students cells in the on-screen table.
    const groupRows = groupStarts(allGroups).map(({ row: r, isGroupStart, groupSpan }) => {
      const examCells = [r.examName, r.total, r.private, r.regular, r.male, r.female];
      return isGroupStart
        ? [
            { content: r.district, rowSpan: groupSpan },
            { content: r.area, rowSpan: groupSpan },
            { content: r.center, rowSpan: groupSpan },
            { content: r.centerTotal, rowSpan: groupSpan, styles: { halign: "center" } },
            ...examCells,
          ]
        : examCells;
    });

    doc.autoTable({
      startY: 62,
      head: [HEAD_ROW],
      body: [
        ...groupRows,
        ["Total", "", "", "", "", allTotals.total, allTotals.private, allTotals.regular, allTotals.male, allTotals.female],
      ],
      styles: { fontSize: 9, cellPadding: 4, lineColor: 0, lineWidth: 0.2, textColor: 0, valign: "top" },
      headStyles: { fillColor: [230, 230, 230], textColor: 0, fontStyle: "bold" },
      footStyles: { fontStyle: "bold" },
      theme: "grid",
      columnStyles: {
        3: { halign: "center" },
        5: { halign: "center" },
        6: { halign: "center" },
        7: { halign: "center" },
        8: { halign: "center" },
        9: { halign: "center" },
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
  };

  const buildExcel = async (allGroups, allTotals, today) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Consolidation Report");

    // Page setup makes the sheet print-ready straight from Excel — landscape,
    // fit-to-width, header row repeated on every printed page.
    worksheet.pageSetup = {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.4, header: 0.2, footer: 0.2 },
      printTitlesRow: "3:3",
    };
    worksheet.headerFooter = {
      oddHeader: "&C&12Exam Consolidation Report",
      oddFooter: `&L${scopeLabel} (${wiseLabel} Wise) — Printed: ${today}&RPage &P of &N`,
    };

    worksheet.mergeCells(1, 1, 1, HEAD_ROW.length);
    const titleRow = worksheet.getRow(1);
    titleRow.getCell(1).value = "Exam Consolidation Report";
    titleRow.getCell(1).font = { bold: true, size: 14 };
    titleRow.getCell(1).alignment = { horizontal: "center" };

    worksheet.mergeCells(2, 1, 2, HEAD_ROW.length);
    const subRow = worksheet.getRow(2);
    subRow.getCell(1).value = `${scopeLabel} (${wiseLabel} Wise)  |  Total: ${allTotals.total}  |  Printed: ${today}`;
    subRow.getCell(1).alignment = { horizontal: "center" };

    worksheet.columns = [
      { key: "district", width: 18 },
      { key: "area", width: 18 },
      { key: "center", width: 26 },
      { key: "centerTotal", width: 14 },
      { key: "examName", width: 26 },
      { key: "total", width: 16 },
      { key: "private", width: 10 },
      { key: "regular", width: 10 },
      { key: "male", width: 10 },
      { key: "female", width: 10 },
    ];

    const headerRow = worksheet.getRow(3);
    HEAD_ROW.forEach((label, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = label;
      cell.font = { bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6E6E6" } };
      cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    const CENTER_COLS = [4, 6, 7, 8, 9, 10];
    let rowIdx = 4;
    groupStarts(allGroups).forEach(({ row: r, isGroupStart, groupSpan }) => {
      const row = worksheet.getRow(rowIdx);
      row.getCell(1).value = r.district;
      row.getCell(2).value = r.area;
      row.getCell(3).value = r.center;
      row.getCell(4).value = r.centerTotal;
      row.getCell(5).value = r.examName;
      row.getCell(6).value = r.total;
      row.getCell(7).value = r.private;
      row.getCell(8).value = r.regular;
      row.getCell(9).value = r.male;
      row.getCell(10).value = r.female;
      for (let c = 1; c <= HEAD_ROW.length; c++) {
        row.getCell(c).border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
        if (CENTER_COLS.includes(c)) row.getCell(c).alignment = { horizontal: "center", vertical: "middle" };
        else row.getCell(c).alignment = { vertical: "top", wrapText: true };
      }
      if (isGroupStart && groupSpan > 1) {
        [1, 2, 3, 4].forEach((c) => worksheet.mergeCells(rowIdx, c, rowIdx + groupSpan - 1, c));
      }
      rowIdx++;
    });

    const totalRow = worksheet.getRow(rowIdx);
    worksheet.mergeCells(rowIdx, 1, rowIdx, 5);
    totalRow.getCell(1).value = "Grand Total";
    totalRow.getCell(6).value = allTotals.total;
    totalRow.getCell(7).value = allTotals.private;
    totalRow.getCell(8).value = allTotals.regular;
    totalRow.getCell(9).value = allTotals.male;
    totalRow.getCell(10).value = allTotals.female;
    for (let c = 1; c <= HEAD_ROW.length; c++) {
      totalRow.getCell(c).font = { bold: true };
      totalRow.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
      totalRow.getCell(c).border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      if (CENTER_COLS.includes(c)) totalRow.getCell(c).alignment = { horizontal: "center" };
    }

    worksheet.pageSetup.printArea = `A1:${worksheet.getColumn(HEAD_ROW.length).letter}${rowIdx}`;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `Exam Consolidation Report - ${scopeLabel} - ${today}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  // Single click -> both files. No separate excel button; fetch the full
  // (unpaginated) report once and hand it to both builders.
  const handleExport = async () => {
    if (!totalCount || exportLoading) return;
    setExportLoading(true);
    try {
      const filter = selArea ? { area: selArea } : selDistrict ? { district: selDistrict } : {};
      const r = await getData({ ...filter, level: groupField, lowStudents }, "exam-registration/consolidation-report");
      const allGroups = r?.data?.response || [];
      const allTotals = r?.data?.totals || totals;
      if (!allGroups.length) return;

      const today = new Date().toLocaleDateString("en-GB");
      buildPdf(allGroups, allTotals, today);
      await buildExcel(allGroups, allTotals, today);
    } catch (e) {
      props.setMessage?.({
        type: 1,
        content: e?.response?.data?.message || e.message || "Failed to export report.",
        proceed: "Okay",
      });
    } finally {
      setExportLoading(false);
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
              onClick={handleExport}
              disabled={!totalCount || exportLoading}
              className="flex items-center gap-1 text-sm px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5" /> {exportLoading ? "Preparing…" : "Export (PDF + Excel)"}
            </button>
          </div>
        </div>

        <div className="flex items-end gap-3 flex-wrap mb-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 flex items-center gap-1">
              <Filter className="w-3 h-3" /> District
            </label>
            <select
              className="border border-gray-300 rounded-md px-3 py-2 text-sm min-w-[220px] disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
              value={selDistrict}
              onChange={(e) => setSelDistrict(e.target.value)}
              disabled={isDistrictAdmin}
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

          <label className="flex items-center gap-2 text-sm text-gray-600 px-3 py-2 border border-gray-300 rounded-md cursor-pointer select-none">
            <input
              type="checkbox"
              checked={lowStudents}
              onChange={(e) => setLowStudents(e.target.checked)}
            />
            Exam centers with fewer than 5 students
          </label>

          {((selDistrict && !isDistrictAdmin) || selArea || lowStudents) && (
            <button
              type="button"
              onClick={() => {
                setSelDistrict(isDistrictAdmin ? adminDistrictId : "");
                setSelArea("");
                setLowStudents(false);
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
                <th className="px-3 py-2 text-left font-semibold border-b border-gray-200">District</th>
                <th className="px-3 py-2 text-left font-semibold border-b border-gray-200">Area</th>
                <th className="px-3 py-2 text-left font-semibold border-b border-gray-200">Center Name</th>
                <th className="px-3 py-2 text-center font-semibold border-b border-gray-200">Total Students</th>
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
                  <td colSpan={10} className="px-3 py-6 text-center text-gray-400">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && groupedRows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-gray-400">
                    No registrations found.
                  </td>
                </tr>
              )}
              {!loading &&
                groupedRows.map((r, i) => {
                  // Rows for the same exam center are adjacent (server sorts
                  // by district/area/center/exam) — merge their District/
                  // Area/Center/Total-Students cells into one spanning cell,
                  // like a paper consolidation sheet, instead of repeating
                  // the same center info on every exam row.
                  const prev = groupedRows[i - 1];
                  const isGroupStart = !prev || prev.district !== r.district || prev.area !== r.area || prev.center !== r.center;
                  let groupSpan = 0;
                  if (isGroupStart) {
                    groupSpan = 1;
                    for (let j = i + 1; j < groupedRows.length; j++) {
                      const n = groupedRows[j];
                      if (n.district === r.district && n.area === r.area && n.center === r.center) groupSpan++;
                      else break;
                    }
                  }
                  return (
                    <tr key={`${r.district}-${r.area}-${r.center}-${r.examName}`} className="border-t border-gray-100">
                      {isGroupStart && (
                        <>
                          <td className="px-3 py-2 align-top" rowSpan={groupSpan}>
                            {r.district}
                          </td>
                          <td className="px-3 py-2 align-top" rowSpan={groupSpan}>
                            {r.area}
                          </td>
                          <td className="px-3 py-2 align-top" rowSpan={groupSpan}>
                            {r.center}
                          </td>
                          <td className="px-3 py-2 text-center align-top" rowSpan={groupSpan}>
                            {r.centerTotal}
                          </td>
                        </>
                      )}
                      <td className="px-3 py-2">{r.examName}</td>
                      <td className="px-3 py-2 text-center">{r.total}</td>
                      <td className="px-3 py-2 text-center">{r.private}</td>
                      <td className="px-3 py-2 text-center">{r.regular}</td>
                      <td className="px-3 py-2 text-center">{r.male}</td>
                      <td className="px-3 py-2 text-center">{r.female}</td>
                    </tr>
                  );
                })}
            </tbody>
            {!loading && groupedRows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-300 font-semibold bg-gray-50">
                  <td className="px-3 py-2" colSpan={5}>
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
