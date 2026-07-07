import React, { useEffect, useMemo, useState } from "react";
import { Download, Filter, RotateCcw, Users } from "lucide-react";
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
const ExamConsolidationReport = (props) => {
  useEffect(() => {
    document.title = `Exam Consolidation Report - QSC Automation`;
  }, []);

  const [districts, setDistricts] = useState([]);
  const [areas, setAreas] = useState([]);
  const [selDistrict, setSelDistrict] = useState("");
  const [selArea, setSelArea] = useState("");

  const [rows, setRows] = useState([]);
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

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const filter = selArea ? { area: selArea } : selDistrict ? { district: selDistrict } : {};
        const r = await getData(filter, "exam-registration/registered-list");
        setRows(r?.data?.response || []);
      } catch (e) {
        props.setMessage?.({
          type: 1,
          content: e?.response?.data?.message || e.message || "Failed to load consolidation data.",
          proceed: "Okay",
        });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selDistrict, selArea]);

  const level = selArea ? "center" : selDistrict ? "area" : "district";
  const groupLabel = level === "district" ? "District" : level === "area" ? "Area" : "Exam Center";
  const groupField = level === "district" ? "district" : level === "area" ? "area" : "studyCentre";

  const groupedRows = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const group = r[groupField] || "Unknown";
      const examName = r.examType || "Unknown";
      const key = `${group}||${examName}`;
      if (!map.has(key)) {
        map.set(key, { group, examName, total: 0, private: 0, regular: 0, male: 0, female: 0 });
      }
      const entry = map.get(key);
      entry.total += 1;
      if (r.status === "Private") entry.private += 1;
      if (r.status === "Regular") entry.regular += 1;
      if (r.gender === "Male") entry.male += 1;
      if (r.gender === "Female") entry.female += 1;
    }
    return [...map.values()].sort((a, b) => {
      const g = a.group.localeCompare(b.group);
      if (g !== 0) return g;
      return a.examName.localeCompare(b.examName);
    });
  }, [rows, groupField]);

  const totals = useMemo(
    () =>
      groupedRows.reduce(
        (acc, r) => ({
          total: acc.total + r.total,
          private: acc.private + r.private,
          regular: acc.regular + r.regular,
          male: acc.male + r.male,
          female: acc.female + r.female,
        }),
        { total: 0, private: 0, regular: 0, male: 0, female: 0 }
      ),
    [groupedRows]
  );

  const scopeLabel = selArea
    ? areas.find((a) => (a.id || a._id) === selArea)?.value || areas.find((a) => (a.id || a._id) === selArea)?.area
    : selDistrict
    ? districts.find((d) => (d.id || d._id) === selDistrict)?.value || districts.find((d) => (d.id || d._id) === selDistrict)?.district
    : "All Kerala (State)";

  const downloadPdf = () => {
    if (!groupedRows.length) return;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const today = new Date().toLocaleDateString("en-GB");

    doc.setFontSize(14);
    doc.text("Exam Consolidation Report", pageWidth / 2, 30, { align: "center" });
    doc.setFontSize(11);
    doc.text(`${scopeLabel}  |  Total: ${totals.total}  |  Printed: ${today}`, pageWidth / 2, 48, { align: "center" });

    doc.autoTable({
      startY: 62,
      head: [["#", groupLabel, "Exam Name", "Registered Students", "Private", "Regular", "Male", "Female"]],
      body: [
        ...groupedRows.map((r, i) => [i + 1, r.group, r.examName, r.total, r.private, r.regular, r.male, r.female]),
        ["", "Total", "", totals.total, totals.private, totals.regular, totals.male, totals.female],
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
        if (data.row.index === groupedRows.length) data.cell.styles.fillColor = [245, 245, 245];
      },
      didDrawPage: (d) => {
        doc.setFontSize(9);
        doc.text(`Page ${d.pageNumber}`, pageWidth - 40, doc.internal.pageSize.getHeight() - 12, { align: "right" });
      },
    });

    doc.save(`Exam Consolidation Report - ${scopeLabel} - ${today}.pdf`);
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
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Users className="w-4 h-4" />
              <span>Total: {totals.total}</span>
            </div>
            <button
              type="button"
              onClick={downloadPdf}
              disabled={!groupedRows.length}
              className="flex items-center gap-1 text-sm px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5" /> Export PDF
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
                    <td className="px-3 py-2">{i + 1}</td>
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
                    Total
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
      </div>
    </Container>
  );
};

export default Layout(ExamConsolidationReport);
