import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Building2, Download, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import "jspdf-autotable";
import Layout from "../../../core/layout";
import { Container } from "../../../core/layout/styels";
import { getData } from "../../../../backend/api";

// Exam Consolidation — sibling of examConsolidationReport, but grouped by
// exam instead of district/area/centre: one row per exam, showing how many
// distinct exam centres offer it and how many students registered for it,
// across the WHOLE dataset — no district/area filters here, by design.
// Grouping/summing happens server-side (exam-registration/centre-consolidation-report).

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

const ExamConsolidationByCentre = (props) => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = `Exam Consolidation - QSC Automation`;
  }, []);

  const [exams, setExams] = useState([]);
  const [totalCentres, setTotalCentres] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // No district/area filter — always the whole dataset, grouped by exam.
      const r = await getData({}, "exam-registration/centre-consolidation-report");
      setExams(r?.data?.exams || []);
      setTotalCentres(r?.data?.total_centres || 0);
      setTotalStudents(r?.data?.total_students || 0);
    } catch (e) {
      props.setMessage?.({
        type: 1,
        content: e?.response?.data?.message || e.message || "Failed to load exam consolidation data.",
        proceed: "Okay",
      });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const scopeLabel = "All Kerala";

  const [pdfLoading, setPdfLoading] = useState(false);

  const downloadPdf = async () => {
    if (!exams.length || pdfLoading) return;
    setPdfLoading(true);
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const today = new Date().toLocaleDateString("en-GB");

      doc.setFontSize(14);
      doc.text("Exam Consolidation", pageWidth / 2, 30, { align: "center" });
      doc.setFontSize(11);
      doc.text(`${scopeLabel}  |  Total: ${totalStudents}  |  Printed: ${today}`, pageWidth / 2, 48, { align: "center" });

      doc.autoTable({
        startY: 62,
        head: [["#", "Exam Name", "Exam Centres", "Registered Students"]],
        body: [
          ...exams.map((e, i) => [i + 1, e.exam_name, e.centres_count, e.students]),
          ["", "Total", totalCentres, totalStudents],
        ],
        styles: { fontSize: 9, cellPadding: 4, lineColor: 0, lineWidth: 0.2, textColor: 0 },
        headStyles: { fillColor: [230, 230, 230], textColor: 0, fontStyle: "bold" },
        footStyles: { fontStyle: "bold" },
        theme: "grid",
        columnStyles: {
          0: { halign: "center", cellWidth: 30 },
          2: { halign: "center" },
          3: { halign: "center" },
        },
        didParseCell: (data) => {
          if (data.row.index === exams.length) data.cell.styles.fillColor = [245, 245, 245];
        },
        didDrawPage: (d) => {
          doc.setFontSize(9);
          doc.text(`Page ${d.pageNumber}`, pageWidth - 40, doc.internal.pageSize.getHeight() - 12, { align: "right" });
        },
      });

      doc.save(`Exam Consolidation - ${scopeLabel} - ${today}.pdf`);
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
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Consolidation Report
            </button>
            <h3 className="text-lg font-semibold m-0">Exam Consolidation</h3>
            <p className="text-sm text-gray-500 m-0">{scopeLabel}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Users className="w-4 h-4" />
              <span>Total: {totalStudents}</span>
            </div>
            <button
              type="button"
              onClick={downloadPdf}
              disabled={!exams.length || pdfLoading}
              className="flex items-center gap-1 text-sm px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5" /> {pdfLoading ? "Preparing…" : "Export PDF"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <SummaryCard icon={Building2} label="Total Exam Centres" value={totalCentres} />
          <SummaryCard icon={Users} label="Total Registered Students" value={totalStudents} />
        </div>

        <div className="overflow-auto border border-gray-200 rounded-lg">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold border-b border-gray-200">#</th>
                <th className="px-3 py-2 text-left font-semibold border-b border-gray-200">Exam Name</th>
                <th className="px-3 py-2 text-center font-semibold border-b border-gray-200">Exam Centres</th>
                <th className="px-3 py-2 text-center font-semibold border-b border-gray-200">Registered Students</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-gray-400">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && exams.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-gray-400">
                    No exam centres found for the selected filters.
                  </td>
                </tr>
              )}
              {!loading &&
                exams.map((e, i) => (
                  <tr key={e.exam_id} className="border-t border-gray-100">
                    <td className="px-3 py-2">{i + 1}</td>
                    <td className="px-3 py-2">{e.exam_name}</td>
                    <td className="px-3 py-2 text-center">{e.centres_count}</td>
                    <td className="px-3 py-2 text-center">{e.students}</td>
                  </tr>
                ))}
            </tbody>
            {!loading && exams.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-300 font-semibold bg-gray-50">
                  <td className="px-3 py-2" colSpan={2}>
                    Grand Total
                  </td>
                  <td className="px-3 py-2 text-center">{totalCentres}</td>
                  <td className="px-3 py-2 text-center">{totalStudents}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </Container>
  );
};

export default Layout(ExamConsolidationByCentre);
