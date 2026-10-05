import React, { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import {
  Search,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Award,
  Download,
  User2,
  Building2,
  MapPin,
  GraduationCap,
  X,
  Save,
  ChevronLeft,
  ChevronRight,
  Filter,
  FileDown,
} from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import JSZip from "jszip";
import ExcelJS from "exceljs";
import Layout from "../../../core/layout";
import { Container } from "../../../core/layout/styels";
import { getData, postData, putData, deleteData } from "../../../../backend/api";
import { buildApiUrl } from "../../../../backend/baseUrl";
import { examName, MAIN_TITLE, upper, fillGroupSheet, groupRowsByExamAndStatus as groupByExamAndStatus } from "./resultSheet";
import { loadMalayalamFont, registerMalayalamFont, drawGroupPdfPage } from "./resultPdf";
import { useDistrictResultsDownload } from "./districtResults";
import { GetIcon } from "../../../../icons";

// Phase — Exam Score / Results redesign.
// Replaces the generic ListTable view with a card-based results board. Each
// candidate shows up with name, regno, institution, exam and a colour-coded
// score/grade chip so the exam office can scan results at a glance. Add/edit
// happens in a focused side drawer; delete and certificate download stay as
// inline row actions.

const PAGE_SIZE = 12;
const MAX_SCORE = 50;

const GRADES = [
  { min: 45, max: 50, grade: "A+", tone: "bg-emerald-100 text-emerald-700 ring-emerald-200" },
  { min: 40, max: 44, grade: "A", tone: "bg-emerald-50 text-emerald-700 ring-emerald-100" },
  { min: 35, max: 39, grade: "B+", tone: "bg-sky-50 text-sky-700 ring-sky-100" },
  { min: 30, max: 34, grade: "B", tone: "bg-indigo-50 text-indigo-700 ring-indigo-100" },
  { min: 25, max: 29, grade: "C+", tone: "bg-amber-50 text-amber-700 ring-amber-100" },
  { min: 0, max: 24, grade: "C", tone: "bg-rose-50 text-rose-700 ring-rose-100" },
];

const gradeInfo = (score) => {
  const n = Number(score);
  if (Number.isNaN(n)) return GRADES[GRADES.length - 1];
  return GRADES.find((g) => n >= g.min && n <= g.max) || GRADES[GRADES.length - 1];
};

const ExamScore = (props) => {
  useEffect(() => {
    document.title = `Results - QSC Automation`;
  }, []);

  const [rows, setRows] = useState([]);
  const [filterCount, setFilterCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [examTypes, setExamTypes] = useState([]);
  const [selExam, setSelExam] = useState("");
  const [page, setPage] = useState(1);

  // District / Area / Exam Center / Gender / Status filters
  const [districts, setDistricts] = useState([]);
  const [areas, setAreas] = useState([]);
  const [centers, setCenters] = useState([]);
  // District Admins are locked to their own district: it is pre-selected (so the
  // Area / Exam Centre filters work) and the District dropdown is hidden.
  const loggedInUser = useSelector((state) => state.login?.data?.user) || {};
  const adminDistrictId = String(loggedInUser?.districts?._id || loggedInUser?.districts || "");
  const [selDistrict, setSelDistrict] = useState(adminDistrictId);
  const [selArea, setSelArea] = useState("");
  const [selCenter, setSelCenter] = useState("");
  const [selGender, setSelGender] = useState("");
  const [selStatus, setSelStatus] = useState("");

  // Drawer / form state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [confirmDelete, setConfirmDelete] = useState(null);

  // "All Exam Centre's Results" — result PDFs of every exam centre in the
  // current district (a District Admin's own, or the District filter) as one ZIP.
  const allCentreResults = useDistrictResultsDownload({ getDistrictId: () => adminDistrictId || selDistrict });

  useEffect(() => {
    (async () => {
      const [t, d] = await Promise.all([
        getData({}, "exam-type/select"),
        getData({}, "district/select"),
      ]);
      setExamTypes(t?.data?.response || t?.data || []);
      setDistricts(d?.data?.response || d?.data || []);
    })();
  }, []);

  // Load areas whenever district changes
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

  // Load exam centers whenever area changes
  useEffect(() => {
    if (!selArea) {
      setCenters([]);
      setSelCenter("");
      return;
    }
    (async () => {
      const r = await getData({ area: selArea }, "center-registration/area");
      setCenters(r?.data?.response || r?.data || []);
    })();
  }, [selArea]);

  const load = async () => {
    setLoading(true);
    try {
      const query = {
        skip: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      };
      if (search) query.searchkey = search;
      if (selExam) query.exam = selExam;
      if (selDistrict) query.district = selDistrict;
      if (selArea) query.area = selArea;
      if (selCenter) query.centerRegistration = selCenter;
      if (selGender) query.gender = selGender;
      if (selStatus) query.studentStatus = selStatus;
      const r = await getData(query, "exam-score");
      setRows(r?.data?.response || []);
      setFilterCount(r?.data?.filterCount || 0);
      setTotalCount(r?.data?.totalCount || 0);
    } catch (e) {
      props.setMessage?.({
        type: 1,
        content: e?.response?.data?.message || "Could not load results.",
        proceed: "Okay",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, selExam, selDistrict, selArea, selCenter, selGender, selStatus]);

  // Search debounced on Enter / button.
  const onSearchSubmit = () => {
    setPage(1);
    load();
  };

  const openAdd = () => {
    setEditing(null);
    setDrawerOpen(true);
  };
  const openEdit = (row) => {
    setEditing(row);
    setDrawerOpen(true);
  };

  const onSaved = async () => {
    setDrawerOpen(false);
    await load();
  };

  const onDelete = async () => {
    if (!confirmDelete?._id) return;
    try {
      await deleteData({ id: confirmDelete._id }, "exam-score");
      props.setMessage?.({ type: 2, content: "Result deleted.", proceed: "Okay" });
      setConfirmDelete(null);
      await load();
    } catch (e) {
      props.setMessage?.({
        type: 1,
        content: e?.response?.data?.message || e.message,
        proceed: "Okay",
      });
    }
  };

  const downloadCertificate = async (row) => {
    if (!row?._id || !row?.student?.mobileNumber) {
      props.setMessage?.({
        type: 1,
        content: "Candidate mobile number missing — cannot generate certificate.",
        proceed: "Okay",
      });
      return;
    }
    try {
      props.setLoaderBox?.(true);
      const r = await getData(
        { id: row._id, regno: row.student.mobileNumber },
        "exam-registration/download-state-certificate"
      );
      const urlPath = r?.data?.url;
      if (urlPath) {
        const base = import.meta.env.VITE_APP_CDN || buildApiUrl("");
        const full = base.endsWith("/") ? base + urlPath : `${base}/${urlPath}`;
        window.open(full, "_blank");
      } else {
        props.setMessage?.({
          type: 1,
          content: r?.data?.message || "Failed to generate certificate.",
          proceed: "Okay",
        });
      }
    } catch (e) {
      props.setMessage?.({
        type: 1,
        content: e?.response?.data?.message || e.message,
        proceed: "Okay",
      });
    } finally {
      props.setLoaderBox?.(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(filterCount / PAGE_SIZE));

  // Build a human-readable label for the current filters (used in PDF title)
  const filterLabel = useMemo(() => {
    const parts = [];
    if (selExam) {
      const e = examTypes.find((x) => (x.id || x._id) === selExam);
      if (e) parts.push(examName(e.value || e.examType));
    }
    if (selDistrict) {
      const d = districts.find((x) => (x.id || x._id) === selDistrict);
      if (d) parts.push(d.value || d.district);
    }
    if (selArea) {
      const a = areas.find((x) => (x.id || x._id) === selArea);
      if (a) parts.push(a.value || a.area);
    }
    if (selCenter) {
      const c = centers.find((x) => (x.id || x._id) === selCenter);
      if (c) parts.push(c.value || c.nameOfCenter);
    }
    if (selGender) parts.push(selGender);
    if (selStatus) parts.push(selStatus);
    return parts.length ? parts.join(" · ") : "All";
  }, [selExam, examTypes, selDistrict, districts, selArea, areas, selCenter, centers, selGender, selStatus]);

  // Describes the geographic scope of the currently applied filters — used in
  // the PDF/Excel heading so it's clear whether a report is state-wide,
  // district-wide, area-wide, or a single exam centre.
  const scopeLabel = useMemo(() => {
    if (selCenter) {
      const c = centers.find((x) => (x.id || x._id) === selCenter);
      return `Exam Center-wise: ${c?.value || c?.nameOfCenter || "Selected Center"}`;
    }
    if (selArea) {
      const a = areas.find((x) => (x.id || x._id) === selArea);
      return `Area-wise: ${a?.value || a?.area || "Selected Area"}`;
    }
    if (selDistrict) {
      const d = districts.find((x) => (x.id || x._id) === selDistrict);
      return `District-wise: ${d?.value || d?.district || "Selected District"}`;
    }
    return "State-wise";
  }, [selCenter, centers, selArea, areas, selDistrict, districts]);

  // Which geo columns (Centre / Area / District) to show in exports, based on
  // how specific the active filter scope already is — a column is dropped
  // once the scope itself pins that value (e.g. Center-wise exports don't
  // need a Centre column repeating the same value on every row).
  const geoColumns = useMemo(() => {
    if (selCenter) return { centre: false, area: false, district: false };
    if (selArea) return { centre: true, area: false, district: false };
    if (selDistrict) return { centre: true, area: true, district: false };
    return { centre: true, area: true, district: true };
  }, [selCenter, selArea, selDistrict]);

  const generatePdf = async (data, title) => {
    const fontB64 = await loadMalayalamFont();

    const FONT_NAME = "NotoSansMalayalam";
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const w = doc.internal.pageSize.getWidth();
    const today = new Date().toLocaleDateString("en-GB");

    if (fontB64) {
      doc.addFileToVFS(`${FONT_NAME}-Regular.ttf`, fontB64);
      doc.addFont(`${FONT_NAME}-Regular.ttf`, FONT_NAME, "normal");
    }

    // Helper: detect Malayalam characters (Unicode block U+0D00–U+0D7F)
    const hasMalayalam = (text) => /[\u0D00-\u0D7F]/.test(String(text ?? ""));

    // For doc.text() calls: use Malayalam font only when needed, otherwise helvetica
    const setDocFont = (text) => {
      if (fontB64 && hasMalayalam(text)) doc.setFont(FONT_NAME, "normal");
      else doc.setFont("helvetica", "normal");
    };

    const hpage = doc.internal.pageSize.getHeight();

    doc.setFontSize(16);
    setDocFont(MAIN_TITLE);
    doc.text(MAIN_TITLE, w / 2, 26, { align: "center" });
    doc.setFontSize(14);
    setDocFont("Results Report");
    doc.text("Results Report", w / 2, 44, { align: "center" });
    doc.setFontSize(11);
    setDocFont(scopeLabel);
    doc.text(scopeLabel.toUpperCase(), w / 2, 60, { align: "center" });
    doc.setFontSize(9);
    setDocFont(title);
    doc.text(title.toUpperCase(), w / 2, 74, { align: "center" });

    const head = [["#", "REG NO", "NAME", "PHONE NUMBER", "P/R", "SCORE", "GRADE"]];
    if (geoColumns.centre) head[0].push("CENTRE");
    if (geoColumns.area) head[0].push("AREA");
    if (geoColumns.district) head[0].push("DISTRICT");
    head[0].push("EXAM");

    doc.autoTable({
      startY: 88,
      head,
      body: data.map((r, i) => {
        const row = [
          i + 1,
          upper(r.student?.regno),
          upper(r.student?.nameOfApplicant),
          upper(r.student?.mobileNumber),
          r.student?.status ? r.student.status.charAt(0) : "-",
          r.score ?? "-",
          upper(r.grade),
        ];
        if (geoColumns.centre) row.push(upper(r.student?.centerRegistration?.nameOfCenter));
        if (geoColumns.area) row.push(upper(r.student?.area?.area));
        if (geoColumns.district) row.push(upper(r.student?.district?.district));
        row.push(upper(examName(r.exam?.examType)));
        return row;
      }),
      // Default all cells to helvetica so Latin/numeric text always renders
      styles: { fontSize: 8, cellPadding: 3, lineColor: 0, lineWidth: 0.2, textColor: 0, font: "helvetica" },
      headStyles: { fillColor: [230, 230, 230], textColor: 0, fontStyle: "bold", font: "helvetica" },
      theme: "grid",
      columnStyles: {
        0: { halign: "center", cellWidth: 28 },
        4: { halign: "center", cellWidth: 24 },
        5: { halign: "center", cellWidth: 40 },
        6: { halign: "center", cellWidth: 36 },
      },
      // Per-cell font switch: use Malayalam font only for cells that contain Malayalam text
      didParseCell: (hookData) => {
        if (fontB64 && hookData.section === "body") {
          const text = String(hookData.cell.raw ?? "");
          if (hasMalayalam(text)) {
            hookData.cell.styles.font = FONT_NAME;
            hookData.cell.styles.fontStyle = "normal";
          }
        }
      },
      didDrawPage: () => {
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(`Printed: ${today}`, w - 20, hpage - 16, { align: "right" });
      },
    });

    const filename = `Results-${title.replace(/[\s·/]+/g, "-")}-${today.replace(/\//g, "-")}.pdf`;
    doc.save(filename);
  };

  // Builds a single-table PDF for one exam+status group and returns it as a Blob
  // (does not save to disk) — used when packing the results ZIP.
  const buildGroupPdfBlob = async (rows, title, scope = "State-wise", geo = { centre: true, area: true, district: true }) => {
    const fontB64 = await loadMalayalamFont();
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    registerMalayalamFont(doc, fontB64);
    drawGroupPdfPage(doc, rows, title, scope, geo, fontB64);
    return doc.output("blob");
  };

  // Builds a single-sheet Excel workbook for one exam+status group and returns
  // it as a Blob — used when packing the results ZIP.
  const buildGroupExcelBlob = async (rows, title, scope = "State-wise", geo = { centre: true, area: true, district: true }) => {
    const workbook = new ExcelJS.Workbook();
    fillGroupSheet(workbook.addWorksheet("Results"), rows, title, scope, geo);
    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  };

  // Groups exam-score rows by (exam, Private/Regular) in exam-type list order —
  // see groupRowsByExamAndStatus in ./resultSheet.
  const groupRowsByExamAndStatus = (data) => groupByExamAndStatus(data, examTypes);

  // Sanitizes a label for use as a filesystem/zip path segment.
  const safePathSegment = (text) =>
    String(text || "Unknown")
      .replace(/[\\/:*?"<>|]/g, "-")
      .trim() || "Unknown";

  // Builds a ZIP with one folder per exam, each containing a Private/ and
  // Regular/ subfolder, each holding a sorted-by-score PDF + Excel of that
  // group's results. Groups with no students are skipped entirely.
  // `areaFolder` (Area-wise downloads) switches the layout to
  // "<Area>/ Private Result/ <exam>/" and "<Area>/ Regular Result/ <exam>/";
  // the files are the same.
  const buildResultsZip = async (data, scope = "State-wise", geo = { centre: true, area: true, district: true }, areaFolder = null) => {
    const groups = groupRowsByExamAndStatus(data);
    const zip = new JSZip();
    for (const group of groups) {
      const examFolder = safePathSegment(group.examLabel);
      const statusFolder = group.status;
      const title = `${group.examLabel} — ${group.status}`;
      const baseName = `${safePathSegment(group.examLabel)}-${group.status}`;

      const [pdfBlob, excelBlob] = await Promise.all([
        buildGroupPdfBlob(group.rows, title, scope, geo),
        buildGroupExcelBlob(group.rows, title, scope, geo),
      ]);

      const folder = areaFolder
        ? zip.folder(safePathSegment(areaFolder)).folder(`${statusFolder} Result`).folder(examFolder)
        : zip.folder(examFolder).folder(statusFolder);
      folder.file(`${baseName}.pdf`, pdfBlob);
      folder.file(`${baseName}.xlsx`, excelBlob);
    }
    return zip;
  };

  const saveZip = async (zip, filename) => {
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // "Download Filtered" — same ZIP layout as "Download All" (exam / status /
  // PDF + Excel, sorted by mark), but scoped to the currently applied filters.
  const downloadFiltered = async () => {
    props.setLoaderBox?.(true);
    try {
      const query = { skip: 0, limit: 99999 };
      if (search) query.searchkey = search;
      if (selExam) query.exam = selExam;
      if (selDistrict) query.district = selDistrict;
      if (selArea) query.area = selArea;
      if (selCenter) query.centerRegistration = selCenter;
      if (selGender) query.gender = selGender;
      if (selStatus) query.studentStatus = selStatus;
      const r = await getData(query, "exam-score");
      const data = r?.data?.response || [];
      if (!data.length) {
        props.setMessage?.({ type: 1, content: "No results to download.", proceed: "Okay" });
        return;
      }

      // Area-wise download (an Area filtered, no single Exam Centre): an Area
      // folder grouped by Private / Regular first, like the All Exam Centre's
      // Results ZIP. Exam Centre downloads keep the exam / status layout.
      let areaFolder = null;
      if (selArea && !selCenter) {
        const a = areas.find((x) => (x.id || x._id) === selArea);
        areaFolder = a?.value || a?.area || "Selected Area";
      }
      const zip = await buildResultsZip(data, scopeLabel, geoColumns, areaFolder);
      const today = new Date().toLocaleDateString("en-GB").replace(/\//g, "-");
      await saveZip(zip, `Results-${filterLabel.replace(/[\s·/]+/g, "-")}-${today}.zip`);
    } catch (e) {
      props.setMessage?.({ type: 1, content: e?.response?.data?.message || e.message, proceed: "Okay" });
    } finally {
      props.setLoaderBox?.(false);
    }
  };

  // "Download All" — same ZIP layout, covering every result (no filters).
  const downloadAll = async () => {
    props.setLoaderBox?.(true);
    try {
      const r = await getData({ skip: 0, limit: 99999 }, "exam-score");
      const data = r?.data?.response || [];
      if (!data.length) {
        props.setMessage?.({ type: 1, content: "No results to download.", proceed: "Okay" });
        return;
      }

      const zip = await buildResultsZip(data);
      const today = new Date().toLocaleDateString("en-GB").replace(/\//g, "-");
      await saveZip(zip, `Results-All-${today}.zip`);
    } catch (e) {
      props.setMessage?.({ type: 1, content: e?.response?.data?.message || e.message, proceed: "Okay" });
    } finally {
      props.setLoaderBox?.(false);
    }
  };

  return (
    <Container className="noshadow" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
      <div className="p-6 w-full max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600">
              <Award size={14} />
              Exam results
            </div>
            <h1 className="text-[22px] font-bold tracking-tight text-slate-900 mt-1">Results</h1>
            <p className="text-sm text-slate-500 max-w-2xl mt-1">
              Candidate scores, grades and certificates. Use the filters to narrow down by exam or
              search by candidate name, register number or score.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              type="button"
              onClick={downloadAll}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-slate-200 text-slate-600 bg-white hover:bg-slate-50"
              title="Download a ZIP with a PDF + Excel per exam, split into Private/Regular folders"
            >
              <FileDown size={14} />
              {adminDistrictId ? "District Result" : "Download All (ZIP)"}
            </button>
            <button
              type="button"
              onClick={downloadFiltered}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
              title="Download a ZIP (PDF + Excel per exam/status) with current filters applied"
            >
              <FileDown size={14} />
              Download Filtered
            </button>
            {props.addPrivilege && (
              <button
                type="button"
                onClick={openAdd}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
              >
                <Plus size={14} />
                Add Result
              </button>
            )}
          </div>
        </div>

        {/* Filter bar */}
        <div className="bg-white rounded-lg border border-slate-200 p-3 mb-5 flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:flex-1 sm:min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearchSubmit()}
              placeholder="Search by name, register number, or score"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter size={14} className="hidden sm:block text-slate-400 shrink-0" />
            <select
              value={selExam}
              onChange={(e) => {
                setPage(1);
                setSelExam(e.target.value);
              }}
              className="w-full sm:w-auto sm:max-w-[160px] px-3 py-2 text-sm rounded-md border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            >
              <option value="">All exams</option>
              {examTypes.map((e) => (
                <option key={e.id || e._id} value={e.id || e._id}>
                  {examName(e.value || e.examType)}
                </option>
              ))}
            </select>
          </div>

          {!adminDistrictId && (
            <select
              value={selDistrict}
              onChange={(e) => {
                setPage(1);
                setSelDistrict(e.target.value);
                setSelArea("");
              }}
              className="w-full sm:w-auto sm:max-w-[150px] px-3 py-2 text-sm rounded-md border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            >
              <option value="">All districts</option>
              {districts.map((d) => (
                <option key={d.id || d._id} value={d.id || d._id}>
                  {d.value || d.district}
                </option>
              ))}
            </select>
          )}

          {selDistrict && (
            <select
              value={selArea}
              onChange={(e) => {
                setPage(1);
                setSelArea(e.target.value);
                setSelCenter("");
              }}
              className="w-full sm:w-auto sm:max-w-[150px] px-3 py-2 text-sm rounded-md border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            >
              <option value="">All areas</option>
              {areas.map((a) => (
                <option key={a.id || a._id} value={a.id || a._id}>
                  {a.value || a.area}
                </option>
              ))}
            </select>
          )}

          {selArea && (
            <select
              value={selCenter}
              onChange={(e) => {
                setPage(1);
                setSelCenter(e.target.value);
              }}
              className="w-full sm:w-auto sm:max-w-[160px] px-3 py-2 text-sm rounded-md border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            >
              <option value="">All exam centers</option>
              {centers.map((c) => (
                <option key={c.id || c._id} value={c.id || c._id}>
                  {c.value || c.nameOfCenter}
                </option>
              ))}
            </select>
          )}

          <select
            value={selGender}
            onChange={(e) => {
              setPage(1);
              setSelGender(e.target.value);
            }}
            className="w-full sm:w-auto sm:max-w-[130px] px-3 py-2 text-sm rounded-md border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
          >
            <option value="">All genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>

          <select
            value={selStatus}
            onChange={(e) => {
              setPage(1);
              setSelStatus(e.target.value);
            }}
            className="w-full sm:w-auto sm:max-w-[150px] px-3 py-2 text-sm rounded-md border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
          >
            <option value="">Private + Regular</option>
            <option value="Regular">Regular only</option>
            <option value="Private">Private only</option>
          </select>

          <button
            type="button"
            onClick={onSearchSubmit}
            className="w-full sm:w-auto px-3 py-2 text-sm rounded-md bg-slate-900 text-white hover:bg-slate-800"
          >
            Apply
          </button>

          <button
            type="button"
            onClick={allCentreResults.toolbarButton.onClick}
            disabled={allCentreResults.toolbarButton.disabled}
            title="Download result PDFs of every exam centre in the current district as one ZIP (other filters are ignored)"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-md border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <GetIcon icon={allCentreResults.toolbarButton.icon} />
            {allCentreResults.toolbarButton.label}
          </button>

          <div className="w-full sm:w-auto sm:ml-auto text-xs text-slate-500">
            Showing <span className="font-semibold text-slate-700">{rows.length}</span> of{" "}
            <span className="font-semibold text-slate-700">{filterCount}</span>
            {filterCount !== totalCount && (
              <span className="text-slate-400"> · {totalCount} total</span>
            )}
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500 bg-white rounded-lg border border-slate-200">
            Loading results…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500 bg-white rounded-lg border border-slate-200">
            No results found. Adjust the filters or add a new result to get started.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {rows.map((row) => (
              <ResultCard
                key={row._id}
                row={row}
                // Edit / Delete follow the Result menu's permissions for this role.
                onEdit={props.updatePrivilege ? () => openEdit(row) : null}
                onDelete={props.delPrivilege ? () => setConfirmDelete(row) : null}
                onDownload={() => downloadCertificate(row)}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {rows.length > 0 && (
          <div className="flex items-center justify-between mt-5 text-sm">
            <div className="text-slate-500">
              <span className="font-semibold text-slate-700">{filterCount}</span> Records • Page{" "}
              <span className="font-semibold text-slate-700">{page}</span> of {totalPages}
            </div>
            {filterCount > PAGE_SIZE && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Drawer */}
      {drawerOpen && (
        <ScoreDrawer
          editing={editing}
          examTypes={examTypes}
          onClose={() => setDrawerOpen(false)}
          onSaved={onSaved}
          setMessage={props.setMessage}
        />
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <ConfirmModal
          title="Delete result?"
          message={
            <>
              This will permanently remove the result for{" "}
              <strong>{confirmDelete?.student?.nameOfApplicant || "this candidate"}</strong>. This
              action cannot be undone.
            </>
          }
          confirmLabel="Delete"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={onDelete}
        />
      )}

      {allCentreResults.dialog}
    </Container>
  );
};

const ResultCard = ({ row, onEdit, onDelete, onDownload }) => {
  const student = row.student || {};
  const exam = row.exam || {};
  const center = student.centerRegistration || {};
  const g = gradeInfo(row.score);
  const percent = Math.max(0, Math.min(100, ((Number(row.score) || 0) / MAX_SCORE) * 100));

  return (
    <div className="bg-white rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-sm transition p-4 flex flex-col">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 shrink-0 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center ring-1 ring-indigo-100">
          <User2 size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-800 truncate">
              {student.nameOfApplicant || "Unnamed candidate"}
            </h3>
            {student.status && (
              <span
                className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ring-1 ${
                  student.status === "Private"
                    ? "bg-violet-50 text-violet-700 ring-violet-100"
                    : "bg-emerald-50 text-emerald-700 ring-emerald-100"
                }`}
              >
                {student.status}
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 truncate">
            Reg #{student.regno || "—"}
            {student.mobileNumber ? ` · ${student.mobileNumber}` : ""}
          </div>
        </div>

        <div className="text-right">
          <div className="text-2xl font-bold tabular-nums text-slate-800 leading-none">
            {row.score ?? "—"}
          </div>
          <span
            className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${g.tone}`}
          >
            <Award size={10} />
            {row.grade || g.grade}
          </span>
        </div>
      </div>

      {/* Score bar */}
      <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full ${barColor(percent)}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="mt-3 space-y-1.5 text-sm text-slate-600">
        <InfoRow icon={<GraduationCap size={13} />} label="Exam">
          {examName(exam.examType) || "—"}
        </InfoRow>
        <InfoRow icon={<Building2 size={13} />} label="Study centre">
          {center.nameOfCenter || "—"}
          {center.centerCode && (
            <span className="text-xs text-slate-400"> · {center.centerCode}</span>
          )}
        </InfoRow>
        <InfoRow icon={<MapPin size={13} />} label="Location">
          {[student.area?.area, student.district?.district].filter(Boolean).join(", ") || "—"}
        </InfoRow>
      </div>

      <div className="mt-4 flex items-center justify-end gap-1 pt-3 border-t border-slate-100">
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
          title="Download certificate"
        >
          <Download size={13} />
          Certificate
        </button>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <Pencil size={13} />
            Edit
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded border border-rose-200 text-rose-600 hover:bg-rose-50"
          >
            <Trash2 size={13} />
            Delete
          </button>
        )}
      </div>
    </div>
  );
};

const barColor = (p) => {
  if (p >= 80) return "bg-emerald-500";
  if (p >= 60) return "bg-sky-500";
  if (p >= 50) return "bg-amber-500";
  if (p >= 35) return "bg-orange-500";
  return "bg-rose-500";
};

const InfoRow = ({ icon, label, children }) => (
  <div className="flex items-start gap-2">
    <span className="text-slate-400 mt-0.5">{icon}</span>
    <div className="flex-1 min-w-0">
      <span className="text-[11px] uppercase tracking-wide text-slate-400 mr-1.5">{label}:</span>
      <span className="text-slate-700">{children}</span>
    </div>
  </div>
);

const ScoreDrawer = ({ editing, examTypes, onClose, onSaved, setMessage }) => {
  const [students, setStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [form, setForm] = useState({
    student: editing?.student?._id || "",
    exam: editing?.exam?._id || "",
    score: editing?.score ?? "",
    grade: editing?.grade || "",
  });
  const [saving, setSaving] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  useEffect(() => {
    (async () => {
      setLoadingStudents(true);
      try {
        const r = await getData({}, "exam-registration/select");
        setStudents(r?.data?.response || r?.data || []);
      } finally {
        setLoadingStudents(false);
      }
    })();
  }, []);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students.slice(0, 50);
    return students
      .filter((s) => String(s.value || s.nameOfApplicant || "").toLowerCase().includes(q))
      .slice(0, 50);
  }, [students, studentSearch]);

  const selectedStudent = useMemo(
    () => students.find((s) => (s.id || s._id) === form.student),
    [students, form.student]
  );

  const autoGrade = useMemo(() => gradeInfo(form.score), [form.score]);

  useEffect(() => {
    // Keep grade in sync with score automatically; admin can still override.
    if (form.score !== "" && !Number.isNaN(Number(form.score))) {
      setForm((f) => ({ ...f, grade: autoGrade.grade }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.score]);

  const save = async () => {
    if (!form.student || !form.exam || form.score === "") {
      setMessage?.({
        type: 1,
        content: "Candidate, exam and score are required.",
        proceed: "Okay",
      });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        student: form.student,
        exam: form.exam,
        score: Number(form.score),
        grade: form.grade || autoGrade.grade,
      };
      const res = editing?._id
        ? await putData({ id: editing._id, ...payload }, "exam-score")
        : await postData(payload, "exam-score");

      if (res?.data?.success) {
        setMessage?.({
          type: 2,
          content: editing?._id ? "Result updated." : "Result added.",
          proceed: "Okay",
        });
        await onSaved();
      } else {
        setMessage?.({
          type: 1,
          content: res?.data?.customMessage || res?.data?.message || "Could not save result.",
          proceed: "Okay",
        });
      }
    } catch (e) {
      setMessage?.({
        type: 1,
        content: e?.response?.data?.message || e.message,
        proceed: "Okay",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-slate-900/40" onClick={onClose} />
      <aside className="w-full max-w-md bg-white shadow-xl flex flex-col">
        <div className="flex items-start justify-between p-5 border-b border-slate-200">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              {editing ? "Edit" : "Add"} result
            </div>
            <h2 className="text-lg font-bold text-slate-800 mt-0.5">
              {editing ? "Update score" : "Record a new score"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Student */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Candidate <span className="text-rose-500">*</span>
            </label>
            {editing ? (
              <div className="px-3 py-2 text-sm rounded-md bg-slate-50 border border-slate-200 text-slate-700">
                {editing.student?.nameOfApplicant || "—"}
                <span className="text-xs text-slate-400 ml-2">
                  Reg #{editing.student?.regno || "—"}
                </span>
              </div>
            ) : (
              <>
                <div className="relative mb-1">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder={loadingStudents ? "Loading candidates…" : "Search candidate…"}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto rounded-md border border-slate-200">
                  {filteredStudents.length === 0 ? (
                    <div className="p-3 text-xs text-slate-400 text-center">No candidates</div>
                  ) : (
                    filteredStudents.map((s) => {
                      const id = s.id || s._id;
                      const isSel = form.student === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, student: id }))}
                          className={`w-full text-left px-3 py-2 text-sm border-b border-slate-100 last:border-b-0 ${
                            isSel ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          {s.value || s.nameOfApplicant}
                        </button>
                      );
                    })
                  )}
                </div>
                {selectedStudent && (
                  <p className="mt-1.5 text-xs text-emerald-600">
                    Selected: {selectedStudent.value || selectedStudent.nameOfApplicant}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Exam */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Exam <span className="text-rose-500">*</span>
            </label>
            <select
              value={form.exam}
              onChange={(e) => setForm((f) => ({ ...f, exam: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            >
              <option value="">Select exam…</option>
              {examTypes.map((e) => (
                <option key={e.id || e._id} value={e.id || e._id}>
                  {examName(e.value || e.examType)}
                </option>
              ))}
            </select>
          </div>

          {/* Score */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Score (0–50) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min={0}
              max={50}
              value={form.score}
              onChange={(e) => setForm((f) => ({ ...f, score: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
              placeholder="e.g. 42"
            />
          </div>

          {/* Grade (auto) */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Grade
            </label>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={form.grade}
                onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
                className="flex-1 px-3 py-2 text-sm rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                placeholder="Auto"
              />
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${autoGrade.tone}`}
              >
                Auto: {autoGrade.grade}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Grade is computed from the score automatically, but you can override it if needed.
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-sm rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? "Saving…" : editing ? "Save changes" : "Add result"}
          </button>
        </div>
      </aside>
    </div>
  );
};

const ConfirmModal = ({ title, message, confirmLabel = "Confirm", onCancel, onConfirm }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5">
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      <p className="text-sm text-slate-600 mt-2">{message}</p>
      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 text-sm rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md bg-rose-600 text-white hover:bg-rose-700"
        >
          <Trash2 size={14} />
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
);

export default Layout(ExamScore);
