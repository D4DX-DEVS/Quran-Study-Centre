import React, { useEffect, useState } from "react";
import { Filter, RotateCcw, Download } from "lucide-react";
import { useSelector } from "react-redux";
import jsPDF from "jspdf";
import "jspdf-autotable";
import Layout from "../../../core/layout";
import { Container } from "../../../core/layout/styels";
import { getData } from "../../../../backend/api";

// Mark Entry Report — state / district / exam-center wise counts of marks
// entered vs total registered. District filter narrows to one district;
// Area further narrows within it. Counts only, no per-student detail.
const MarkEntryReport = (props) => {
  useEffect(() => {
    document.title = `Mark Entry Report - QSC Automation`;
  }, []);

  // Any user scoped to a single district gets a locked district filter — mirrors markEntry/index.jsx.
  const loggedInUser = useSelector((state) => state.login?.data?.user) || {};
  const adminDistrictId = loggedInUser?.districts?._id || loggedInUser?.districts || "";
  const isDistrictAdmin = Boolean(adminDistrictId);

  const [districts, setDistricts] = useState([]);
  const [areas, setAreas] = useState([]);
  const [selDistrict, setSelDistrict] = useState(adminDistrictId);
  const [selArea, setSelArea] = useState("");

  const [reportData, setReportData] = useState(null);
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
    setLoading(true);
    const filter = {};
    if (selDistrict) filter.district = selDistrict;
    if (selArea) filter.area = selArea;
    getData(filter, "exam-score/mark-entry-report")
      .then((response) => {
        setReportData(response?.data?.response || null);
      })
      .catch(() => {
        props.setMessage?.({ type: 1, content: "Failed to load mark entry report.", proceed: "Okay" });
      })
      .finally(() => setLoading(false));
  }, [selDistrict, selArea]);

  const scopeLabel = selArea
    ? areas.find((a) => (a.id || a._id) === selArea)?.value || areas.find((a) => (a.id || a._id) === selArea)?.area
    : selDistrict
    ? districts.find((d) => (d.id || d._id) === selDistrict)?.value || districts.find((d) => (d.id || d._id) === selDistrict)?.district
    : "All Kerala";

  const downloadReportPdf = () => {
    if (!reportData) return;
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const today = new Date().toLocaleDateString("en-GB");

    doc.setFontSize(14);
    doc.text("Mark Entry Report", pageWidth / 2, 30, { align: "center" });
    doc.setFontSize(11);
    doc.text(`${scopeLabel}  |  State Total: ${reportData.entered} / ${reportData.total}  |  Printed: ${today}`, pageWidth / 2, 48, { align: "center" });

    const body = [];
    reportData.districts.forEach((d) => {
      body.push([
        { content: d.district, styles: { fontStyle: "bold", fillColor: [225, 225, 225] } },
        { content: `${d.entered} / ${d.total}`, styles: { fontStyle: "bold", fillColor: [225, 225, 225], halign: "center" } },
      ]);
      d.areas.forEach((a) => {
        body.push([
          { content: a.area, styles: { fontStyle: "bold", cellPadding: { left: 14, top: 4, right: 4, bottom: 4 } } },
          { content: `${a.entered} / ${a.total}`, styles: { fontStyle: "bold", halign: "center" } },
        ]);
        a.centers.forEach((c) => {
          body.push([
            { content: c.center, styles: { cellPadding: { left: 28, top: 4, right: 4, bottom: 4 } } },
            { content: `${c.entered} / ${c.total}`, styles: { halign: "center" } },
          ]);
        });
      });
    });

    doc.autoTable({
      startY: 65,
      head: [["District / Area / Exam Center", "Entered / Total"]],
      body,
      styles: { fontSize: 9, cellPadding: 4, lineColor: 0, lineWidth: 0.2 },
      headStyles: { fillColor: [230, 230, 230], textColor: 0, fontStyle: "bold" },
      theme: "grid",
    });

    doc.save(`Mark Entry Report - ${scopeLabel} - ${today}.pdf`);
  };

  return (
    <Container className="noshadow">
      <div className="p-4 w-full flex-1 min-w-0">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold m-0">Mark Entry Report</h3>
            <p className="text-sm text-gray-500 m-0">{scopeLabel}</p>
          </div>
          <button
            type="button"
            onClick={downloadReportPdf}
            disabled={!reportData}
            className="flex items-center gap-1 text-sm px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" /> Download PDF
          </button>
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

          {((selDistrict && !isDistrictAdmin) || selArea) && (
            <button
              type="button"
              onClick={() => {
                setSelDistrict(isDistrictAdmin ? adminDistrictId : "");
                setSelArea("");
              }}
              className="flex items-center gap-1 text-sm px-3 py-2 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          )}
        </div>

        {loading && <p className="text-sm text-gray-400">Loading...</p>}

        {!loading && reportData && (
          <div className="w-full border border-gray-200 rounded-lg p-4">
            <div className="font-semibold mb-4 text-base">
              State Total: {reportData.entered} / {reportData.total}
            </div>
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-x-8">
              {reportData.districts.map((d) => (
                <div key={d.district} className="mb-4 break-inside-avoid">
                  <div className="font-semibold">
                    {d.district}: {d.entered} / {d.total}
                  </div>
                  {d.areas.map((a) => (
                    <div key={a.area} className="ml-5">
                      <div className="font-medium text-gray-700">
                        {a.area}: {a.entered} / {a.total}
                      </div>
                      {a.centers.map((c) => (
                        <div key={c.center} className="ml-5 text-gray-600">
                          {c.center}: {c.entered} / {c.total}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            {reportData.districts.length === 0 && <div className="text-gray-400">No data.</div>}
          </div>
        )}
      </div>
    </Container>
  );
};

export default Layout(MarkEntryReport);
