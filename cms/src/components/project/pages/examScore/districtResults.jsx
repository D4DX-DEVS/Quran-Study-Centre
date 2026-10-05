import React, { useState } from "react";
import { createPortal } from "react-dom";
import { X, Download, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import JSZip from "jszip";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { getData } from "../../../../backend/api";
import { groupRowsByExamAndStatus } from "./resultSheet";
import { loadMalayalamFont, registerMalayalamFont, drawGroupPdfPage, hasMalayalam } from "./resultPdf";

// "All Exam Centre's Results" — result PDFs for every exam centre of a
// district, in one ZIP:
//
//   District/ Area/ Exam Centre/ Private Result.pdf + Regular Result.pdf
//
// Each PDF has one section per exam (Preliminary I, II, …), drawn exactly like
// the Results page's per-centre PDF export. Results come from the same
// GET /exam-score endpoint — it requires a login and scopes District Admins to
// their own district on the server.

const STATUSES = ["Private", "Regular"];

// Makes a District / Area / Exam Centre name safe as a ZIP path segment on
// Windows, macOS and Linux. Names shown inside the PDFs are untouched.
const safeZipName = (text) => {
  let name = String(text || "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "")
    .slice(0, 100)
    .trim();
  if (!name) name = "Unknown";
  if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(name)) name = `${name}_`;
  return name;
};

// Appends " (2)", " (3)"… when a sibling already uses the name, so two
// centres with the same name never overwrite each other inside the ZIP.
const uniqueName = (name, used, maxLength = Infinity) => {
  let candidate = name.slice(0, maxLength);
  for (let n = 2; used.has(candidate.toLowerCase()); n++) {
    const suffix = ` (${n})`;
    candidate = `${name.slice(0, maxLength - suffix.length)}${suffix}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
};

// getData resolves (never throws) on HTTP errors, so check status explicitly —
// a failed request must not be mistaken for "no results".
const fetchOrThrow = async (fields, url, what) => {
  const r = await getData(fields, url);
  if (r?.status === 401 || r?.status === 403) throw new Error(`You are not authorised to load ${what}.`);
  if (r?.status !== 200) {
    throw new Error(`Could not load ${what}${typeof r?.data === "string" && r.data ? `: ${r.data}` : ""}.`);
  }
  return r.data;
};

const listOf = (data) => (Array.isArray(data) ? data : data?.response || []);

// Lets React paint progress between centres so the page never looks frozen.
const yieldToBrowser = () => new Promise((resolve) => setTimeout(resolve, 0));

const buildDistrictResultsZip = async (district, onProgress) => {
  const fontB64 = await loadMalayalamFont();
  const districtId = district.id || district._id;
  const districtName = district.value || district.district;

  // One request each for areas, exam types and every result in the district,
  // then the exam centres of all areas in parallel.
  const [areaList, examTypeList, scoreRes] = await Promise.all([
    fetchOrThrow({ district: districtId }, "area/get-area-by-district", "areas"),
    fetchOrThrow({}, "exam-type/select", "exam types"),
    fetchOrThrow({ district: districtId, skip: 0, limit: 99999 }, "exam-score", "results"),
  ]);
  if (!scoreRes?.success) throw new Error(scoreRes?.message || "Could not load results.");
  const areas = listOf(areaList);
  const examTypes = listOf(examTypeList);
  const data = scoreRes.response || [];
  if (!areas.length) return { empty: `${districtName} has no areas.` };
  if (!data.length) return { empty: `No results to download for ${districtName}.` };

  const centreLists = await Promise.all(
    areas.map((a) => fetchOrThrow({ area: a.id }, "center-registration/area", `exam centres for ${a.value}`).then(listOf))
  );
  const totalCentres = centreLists.reduce((n, list) => n + list.length, 0);

  // Bucket every result row by the candidate's own area + centre (centerRegistration)
  // — the same fields the existing Area / Exam Centre filters and per-centre
  // download use, so a candidate is under the same centre in both downloads.
  const buckets = new Map();
  data.forEach((r) => {
    const key = `${r.student?.area?._id || ""}__${r.student?.centerRegistration?._id || ""}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(r);
  });

  const report = { areas: areas.length, centres: totalCentres, rows: 0, failed: [], unplaced: 0 };
  const zip = new JSZip();
  const root = zip.folder(safeZipName(districtName));
  const areaNames = new Set();
  let done = 0;

  for (let ai = 0; ai < areas.length; ai++) {
    const area = areas[ai];
    const areaFolder = root.folder(uniqueName(safeZipName(area.value), areaNames));
    const centreNames = new Set();

    for (const centre of centreLists[ai]) {
      onProgress(`Area ${ai + 1} of ${areas.length} · Exam Centre ${++done} of ${totalCentres}`);
      await yieldToBrowser();

      const key = `${area.id}__${centre.id}`;
      const rows = buckets.get(key) || [];
      buckets.delete(key);

      try {
        const scope = `Exam Center-wise: ${centre.value}`;
        const geo = { centre: false, area: false, district: false };
        const byStatus = { Private: [], Regular: [] };
        groupRowsByExamAndStatus(rows, examTypes).forEach((g) => byStatus[g.status].push(g));

        // Exactly two PDFs per centre, one section per exam. An empty one
        // carries a clear "no results" title instead of a table.
        const files = [];
        for (const status of STATUSES) {
          const sections = byStatus[status].length
            ? byStatus[status].map((g) => ({ rows: g.rows, title: `${g.examLabel} — ${status}` }))
            : [{ rows: [], title: `No ${status} candidates have results in this exam centre` }];
          // Embed the Malayalam font only when this PDF has Malayalam text — it
          // renders the same and keeps the ZIP far smaller.
          const needsFont =
            hasMalayalam(scope) ||
            sections.some((sec) => hasMalayalam(sec.title) || sec.rows.some((r) => hasMalayalam(`${r.student?.regno} ${r.student?.nameOfApplicant} ${r.grade}`)));
          const font = needsFont ? fontB64 : null;
          const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
          registerMalayalamFont(doc, font);
          sections.forEach((sec, i) => {
            if (i > 0) doc.addPage();
            drawGroupPdfPage(doc, sec.rows, sec.title, scope, geo, font);
          });
          files.push({ name: `${status} Result.pdf`, buffer: doc.output("arraybuffer") });
        }

        const centreFolder = areaFolder.folder(uniqueName(safeZipName(centre.value), centreNames));
        files.forEach((f) => centreFolder.file(f.name, f.buffer));
        report.rows += rows.length;
      } catch (e) {
        report.failed.push(`${area.value} / ${centre.value}: ${e.message}`);
      }
    }
  }

  // Rows whose area/centre did not match any listed centre would otherwise be
  // dropped silently — count them and treat the ZIP as incomplete.
  buckets.forEach((rows) => (report.unplaced += rows.length));

  onProgress("Creating ZIP…");
  let blob;
  try {
    blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  } catch (e) {
    throw new Error(`Could not create the ZIP file: ${e.message}`);
  }
  return { blob, report };
};

const saveBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

// Toolbar entry point shared by the district pages. `getDistrictId` returns the
// page's current district (a District Admin's own district, or the District
// picked in the page's filter). Returns the toolbar button and the small
// progress popup to render.
export const useDistrictResultsDownload = ({ getDistrictId }) => {
  // idle | running | done | incomplete | error
  const [job, setJob] = useState({ status: "idle" });
  const running = job.status === "running";

  const zipName = (name, suffix = "") => `${safeZipName(name)}${suffix}.zip`;

  const start = async () => {
    if (running) return;
    const districtId = getDistrictId();
    if (!districtId) {
      setJob({ status: "error", message: "Select a District in the filter first, then click All Exam Centre's Results." });
      return;
    }
    setJob({ status: "running", progress: "" });
    try {
      const districts = listOf(await fetchOrThrow({}, "district/select", "districts"));
      const district = districts.find((d) => String(d.id || d._id) === String(districtId));
      if (!district) throw new Error("The current district could not be found.");
      const districtName = district.value || district.district;
      setJob({ status: "running", districtName, progress: "" });

      const result = await buildDistrictResultsZip(district, (progress) => setJob({ status: "running", districtName, progress }));
      if (result.empty) {
        setJob({ status: "error", districtName, message: result.empty });
        return;
      }
      if (result.report.failed.length || result.report.unplaced) {
        setJob({ status: "incomplete", districtName, ...result });
        return;
      }
      setJob({ status: "done", districtName, ...result });
      saveBlob(result.blob, zipName(districtName));
    } catch (e) {
      setJob((j) => ({ status: "error", districtName: j.districtName, message: e?.message || "Could not generate district results." }));
    }
  };

  const toolbarButton = {
    label: running ? "Preparing…" : "All Exam Centre's Results",
    icon: "result-certificates",
    disabled: running,
    onClick: start,
  };
  const dialog =
    job.status === "idle" ? null : (
      <DistrictResultsDialog job={job} onDownloadIncomplete={() => saveBlob(job.blob, zipName(job.districtName, " (INCOMPLETE)"))} onClose={() => setJob({ status: "idle" })} />
    );
  return { toolbarButton, dialog };
};

const DistrictResultsDialog = ({ job, onDownloadIncomplete, onClose }) => {
  const running = job.status === "running";
  // Portalled to <body> so the sticky list toolbar (z-index 100) can never sit on top of it.
  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-4 bg-slate-900/40" style={{ zIndex: 1100 }}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-5 max-h-[90vh] overflow-y-auto text-left">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-800">
            All Exam Centre's Results{job.districtName ? ` — ${job.districtName}` : ""}
          </h3>
          {!running && (
            <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-slate-100 text-slate-500">
              <X size={16} />
            </button>
          )}
        </div>

        {running && (
          <div className="mt-4 text-sm text-slate-700">
            <div className="flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-indigo-600" />
              Preparing exam centre results… Please wait.
            </div>
            {job.progress && <div className="text-xs text-slate-500 mt-1 ml-6">{job.progress}</div>}
          </div>
        )}

        {job.status === "done" && (
          <div className="mt-4 text-sm text-emerald-700">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} />
              Results ready. Downloading…
            </div>
            <div className="text-xs text-slate-500 mt-1 ml-6">
              {job.report.areas} areas · {job.report.centres} exam centres · {job.report.rows} results
            </div>
          </div>
        )}

        {job.status === "incomplete" && (
          <div className="mt-4 text-sm text-rose-600">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              Some results could not be included, so the ZIP is incomplete.
            </div>
            <ul className="mt-2 ml-6 max-h-32 overflow-y-auto text-xs list-disc pl-4 space-y-0.5">
              {job.report.failed.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
              {job.report.unplaced > 0 && <li>{job.report.unplaced} result(s) whose area / exam centre is not listed under this district</li>}
            </ul>
          </div>
        )}

        {job.status === "error" && (
          <div className="mt-4 flex items-start gap-2 text-sm text-rose-600">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            {job.message}
          </div>
        )}

        {!running && (
          <div className="mt-5 flex items-center justify-end gap-2">
            {job.status === "incomplete" && (
              <button
                type="button"
                onClick={onDownloadIncomplete}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-rose-200 text-rose-700 hover:bg-rose-50"
              >
                <Download size={14} />
                Download incomplete ZIP
              </button>
            )}
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50">
              Close
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
