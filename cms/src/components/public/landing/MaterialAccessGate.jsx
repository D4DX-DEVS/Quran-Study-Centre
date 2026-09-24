import React, { useMemo, useState } from "react";
import axios from "axios";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import "jspdf-autotable";
import ExcelJS from "exceljs";
import { Download, LogOut, MapPin } from "lucide-react";
import styled from "styled-components";
import { postData } from "../../../backend/api";
import { buildApiUrl } from "../../../backend/baseUrl";
import { FormContainer } from "./registrationForm";
import { sanitizeFolderName } from "../../../utils/attendanceExport";

const SESSION_KEY = "qsc-material-access";

const Card = styled.div`
  width: min(480px, 100%);
  background: var(--landing-surface-strong, #ffffff);
  border-radius: 20px;
  box-shadow: var(--landing-shadow, 0 24px 80px rgba(13, 32, 58, 0.12));
  padding: 32px clamp(20px, 4vw, 40px) 36px;
  font-family: "Manrope", sans-serif;
  color: var(--landing-ink, #0f2743);
`;

const TitleBox = styled.div`
  text-align: center;
  margin-bottom: 24px;

  h2 {
    margin: 0 0 8px;
    font-family: "Fraunces", serif;
    font-weight: 600;
    font-size: 26px;
  }

  p {
    margin: 0;
    color: var(--landing-muted, #59718a);
    font-size: 14px;
    line-height: 1.6;
  }
`;

const PasswordInput = styled.input`
  width: 100%;
  padding: 14px 16px;
  margin-bottom: 14px;
  border: 1px solid var(--landing-line, rgba(15, 39, 67, 0.14));
  border-radius: 12px;
  font-size: 16px;
  letter-spacing: 0.3em;
  text-align: center;
  text-transform: uppercase;
  color: var(--landing-ink, #0f2743);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;

  &:focus {
    outline: none;
    border-color: var(--landing-blue, #1d4ed8);
    box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.12);
  }
`;

const ErrorText = styled.p`
  color: #c0392b;
  background: rgba(192, 57, 43, 0.08);
  border-radius: 10px;
  padding: 10px 12px;
  margin: 0 0 14px !important;
  font-size: 13px;
`;

const CancelButton = styled.button`
  width: 100%;
  margin-top: 10px;
  border: 1px solid var(--landing-line, rgba(15, 39, 67, 0.14));
  background: transparent;
  border-radius: 999px;
  padding: 12px 18px;
  font-family: "Manrope", sans-serif;
  font-size: 14px;
  font-weight: 700;
  color: var(--landing-muted, #59718a);
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;

  &:hover {
    background: rgba(15, 39, 67, 0.06);
    color: var(--landing-ink, #0f2743);
  }
`;

const SubmitButton = styled.button`
  width: 100%;
  border: none;
  border-radius: 999px;
  padding: 14px 18px;
  font-family: "Manrope", sans-serif;
  font-size: 14px;
  font-weight: 800;
  color: #ffffff;
  cursor: pointer;
  background: linear-gradient(135deg, var(--landing-blue, #1d4ed8), #3b6ff0);
  box-shadow: 0 18px 36px rgba(29, 78, 216, 0.24);
  transition: transform 0.2s ease, opacity 0.2s ease;

  &:hover {
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const SessionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;

  h3 {
    margin: 0;
    font-family: "Fraunces", serif;
    font-size: 22px;
    font-weight: 600;

    span {
      font-weight: 400;
      font-size: 14px;
      color: var(--landing-muted, #59718a);
    }
  }
`;

const ExitButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--landing-line, rgba(15, 39, 67, 0.14));
  background: transparent;
  color: var(--landing-muted, #59718a);
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;

  &:hover {
    background: rgba(192, 57, 43, 0.08);
    color: #c0392b;
  }
`;

const SummaryText = styled.p`
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--landing-muted, #59718a);
`;

const DownloadButton = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 18px;
  border: none;
  border-radius: 999px;
  padding: 13px 18px;
  font-family: "Manrope", sans-serif;
  font-size: 14px;
  font-weight: 800;
  color: var(--landing-ink, #0f2743);
  background: rgba(29, 78, 216, 0.08);
  cursor: pointer;
  transition: transform 0.2s ease, background-color 0.2s ease;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    background: rgba(29, 78, 216, 0.14);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const FilterSelect = styled.select`
  width: 100%;
  padding: 12px 14px;
  margin-bottom: 14px;
  border: 1px solid var(--landing-line, rgba(15, 39, 67, 0.14));
  border-radius: 12px;
  font-size: 14px;
  font-family: "Manrope", sans-serif;
  color: var(--landing-ink, #0f2743);
  background: #ffffff;

  &:focus {
    outline: none;
    border-color: var(--landing-blue, #1d4ed8);
  }
`;

const DownloadRow = styled.div`
  display: flex;
  gap: 10px;
  margin-bottom: 18px;

  button {
    flex: 1;
    margin-bottom: 0;
  }
`;

const CentersList = styled.div`
  max-height: 320px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 4px;

  .center-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    border: 1px solid var(--landing-line, rgba(15, 39, 67, 0.1));
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;

    svg {
      color: var(--landing-blue, #1d4ed8);
      flex-shrink: 0;
    }
  }
`;

const readSession = () => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.expiresAt || parsed.expiresAt <= Date.now()) return null;
    return parsed;
  } catch (_) {
    return null;
  }
};

const writeSession = (session) => {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (_) {}
};

const clearSession = () => {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch (_) {}
};

const MaterialAccessGate = ({ onClose }) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [session, setSession] = useState(() => readSession());
  const [rows, setRows] = useState(null);
  const [centers, setCenters] = useState([]);
  const [selectedCenter, setSelectedCenter] = useState("");
  const [loadingResults, setLoadingResults] = useState(false);

  const fetchResults = async (token) => {
    setLoadingResults(true);
    setError("");
    try {
      const response = await axios.get(buildApiUrl("material-access/results"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response?.data?.success) {
        setRows(response.data.response || []);
        setCenters(response.data.centers || []);
      } else {
        setError("Session expired, please enter the password again.");
        clearSession();
        setSession(null);
      }
    } catch (err) {
      setError("Session expired, please enter the password again.");
      clearSession();
      setSession(null);
    } finally {
      setLoadingResults(false);
    }
  };

  React.useEffect(() => {
    if (session?.token) {
      fetchResults(session.token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

  const filteredRows = useMemo(() => {
    if (!rows) return [];
    if (!selectedCenter) return rows;
    return rows.filter((r) => r.student?.centerRegistration?.nameOfCenter === selectedCenter);
  }, [rows, selectedCenter]);

  const submitPassword = async (event) => {
    event.preventDefault();
    if (!password.trim()) return;

    setSubmitting(true);
    setError("");
    try {
      const response = await postData({ password: password.trim() }, "material-access/verify");
      if (response?.data?.success) {
        const { token, area, district, expiresIn } = response.data.response;
        const nextSession = {
          token,
          area,
          district,
          expiresAt: Date.now() + (expiresIn || 45 * 60) * 1000,
        };
        writeSession(nextSession);
        setSession(nextSession);
      } else {
        setError(response?.data?.message || "Incorrect password");
      }
    } catch (err) {
      setError("Something went wrong, please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    clearSession();
    setSession(null);
    setRows(null);
    setCenters([]);
    setSelectedCenter("");
    setPassword("");
  };

  // Exam names are stored as "Preliminary I: <syllabus text>" — only the short
  // name before the colon is used for folder names / display.
  const examName = (text) => String(text || "Unknown Exam").split(":")[0].trim();

  // Nests result rows Exam -> Private/Regular, each leaf sorted by score
  // descending — matches the admin Result page's ZIP layout exactly.
  const groupResultsByExamStatus = (data) => {
    const grouped = {};
    data.forEach((item) => {
      const exam = examName(item.exam?.examType);
      const status = item.student?.status === "Private" ? "Private" : "Regular";

      if (!grouped[exam]) grouped[exam] = {};
      if (!grouped[exam][status]) grouped[exam][status] = [];
      grouped[exam][status].push(item);
    });

    Object.values(grouped).forEach((statuses) =>
      Object.values(statuses).forEach((list) => list.sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0)))
    );

    return grouped;
  };

  const MAIN_TITLE = "QSC ANNUAL EXAM RESULT - 2026";
  const upper = (text) => (text === undefined || text === null || text === "" ? "-" : String(text).toUpperCase());

  const buildResultExcel = async (data, title, scope, showCentre) => {
    const today = new Date().toLocaleDateString("en-GB");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(title.substring(0, 31));

    const columns = [
      { header: "#", key: "sl", width: 6 },
      { header: "REG NO", key: "regno", width: 14 },
      { header: "NAME", key: "name", width: 28 },
      { header: "PHONE NUMBER", key: "phone", width: 18 },
      { header: "SCORE", key: "score", width: 10 },
      { header: "GRADE", key: "grade", width: 10 },
    ];
    if (showCentre) columns.push({ header: "CENTRE", key: "centre", width: 26 });
    sheet.columns = columns.map((c) => ({ key: c.key, width: c.width }));

    sheet.spliceRows(1, 0, [MAIN_TITLE], [scope.toUpperCase()], [title.toUpperCase()], []);
    sheet.mergeCells(1, 1, 1, columns.length);
    sheet.mergeCells(2, 1, 2, columns.length);
    sheet.mergeCells(3, 1, 3, columns.length);
    sheet.getCell("A1").font = { bold: true, size: 14 };
    sheet.getCell("A1").alignment = { horizontal: "center" };
    sheet.getCell("A2").font = { bold: true, size: 12 };
    sheet.getCell("A2").alignment = { horizontal: "center" };
    sheet.getCell("A3").font = { bold: true, size: 11 };
    sheet.getCell("A3").alignment = { horizontal: "center" };

    const headerRow = sheet.addRow(columns.map((c) => c.header));
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: "center" };
    headerRow.eachCell((cell) => {
      cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
    });

    data.forEach((r, i) => {
      const row = [i + 1, upper(r.student?.regno), upper(r.student?.nameOfApplicant), upper(r.student?.mobileNumber), r.score ?? "-", upper(r.grade)];
      if (showCentre) row.push(upper(r.student?.centerRegistration?.nameOfCenter));
      const dataRow = sheet.addRow(row);
      dataRow.alignment = { horizontal: "center" };
    });

    sheet.addRow([]);
    const printedRow = sheet.addRow([`Printed: ${today}`]);
    sheet.mergeCells(printedRow.number, 1, printedRow.number, columns.length);
    sheet.getCell(printedRow.number, 1).alignment = { horizontal: "right" };

    return workbook.xlsx.writeBuffer();
  };

  const buildResultPdf = (data, title, scope, showCentre) => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const w = doc.internal.pageSize.getWidth();
    const hpage = doc.internal.pageSize.getHeight();
    const today = new Date().toLocaleDateString("en-GB");

    doc.setFontSize(16);
    doc.text(MAIN_TITLE, w / 2, 26, { align: "center" });
    doc.setFontSize(11);
    doc.text(scope.toUpperCase(), w / 2, 44, { align: "center" });
    doc.setFontSize(13);
    doc.text(title.toUpperCase(), w / 2, 62, { align: "center" });

    const head = [["#", "REG NO", "NAME", "PHONE NUMBER", "SCORE", "GRADE"]];
    if (showCentre) head[0].push("CENTRE");

    doc.autoTable({
      startY: 76,
      head,
      body: data.map((r, i) => {
        const row = [
          i + 1,
          upper(r.student?.regno),
          upper(r.student?.nameOfApplicant),
          upper(r.student?.mobileNumber),
          r.score ?? "-",
          upper(r.grade),
        ];
        if (showCentre) row.push(upper(r.student?.centerRegistration?.nameOfCenter));
        return row;
      }),
      styles: { fontSize: 8, cellPadding: 3, lineColor: 0, lineWidth: 0.2, textColor: 0 },
      headStyles: { fillColor: [230, 230, 230], textColor: 0, fontStyle: "bold" },
      theme: "grid",
      didDrawPage: () => {
        doc.setFontSize(8);
        doc.text(`Printed: ${today}`, w - 20, hpage - 16, { align: "right" });
      },
    });

    return doc.output("arraybuffer");
  };

  const downloadZip = async (dataForZip, zipName, scope, showCentre) => {
    if (!dataForZip || dataForZip.length === 0) return;

    const grouped = groupResultsByExamStatus(dataForZip);
    const zip = new JSZip();

    for (const [examLabel, statuses] of Object.entries(grouped)) {
      const examFolder = zip.folder(sanitizeFolderName(examLabel));
      for (const [status, rowsForGroup] of Object.entries(statuses)) {
        if (!rowsForGroup.length) continue;
        const statusFolder = examFolder.folder(status);
        const title = `${examLabel} — ${status}`;
        const baseName = `${sanitizeFolderName(examLabel)}-${status}`;
        statusFolder.file(`${baseName}.xlsx`, await buildResultExcel(rowsForGroup, title, scope, showCentre));
        statusFolder.file(`${baseName}.pdf`, buildResultPdf(rowsForGroup, title, scope, showCentre));
      }
    }

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, zipName);
  };

  const downloadAllResults = () =>
    downloadZip(rows, `${session.area} - Results.zip`, `Area-wise: ${session.area}`, true);
  const downloadFilteredResults = () =>
    downloadZip(
      filteredRows,
      `${session.area} - ${selectedCenter || "All Centers"} - Results.zip`,
      selectedCenter ? `Exam Center-wise: ${selectedCenter}` : `Area-wise: ${session.area}`,
      !selectedCenter
    );

  if (!session?.token) {
    return (
      <FormContainer style={{ display: "flex", justifyContent: "center", padding: "20px" }}>
        <Card>
          <TitleBox>
            <h2>Area Material Access</h2>
            <p>Enter your area's material password to view exam results and centers.</p>
          </TitleBox>
          <form onSubmit={submitPassword}>
            <PasswordInput
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              autoFocus
              maxLength={4}
            />
            {error && <ErrorText>{error}</ErrorText>}
            <SubmitButton type="submit" disabled={submitting}>
              {submitting ? "Checking..." : "Submit"}
            </SubmitButton>
            <CancelButton type="button" onClick={onClose}>
              Cancel
            </CancelButton>
          </form>
        </Card>
      </FormContainer>
    );
  }

  return (
    <FormContainer style={{ display: "flex", justifyContent: "center", padding: "20px" }}>
      <Card style={{ width: "min(560px, 100%)" }}>
        <SessionHeader>
          <h3>
            {session.area} <span>({session.district})</span>
          </h3>
          <ExitButton type="button" onClick={handleLogout}>
            <LogOut size={14} />
            Exit
          </ExitButton>
        </SessionHeader>

        {loadingResults ? (
          <SummaryText>Loading results...</SummaryText>
        ) : (
          <>
            <SummaryText>
              {rows?.length || 0} results across {centers.length} exam centre(s).
            </SummaryText>

            <FilterSelect value={selectedCenter} onChange={(e) => setSelectedCenter(e.target.value)}>
              <option value="">All exam centres</option>
              {centers.map((centerName) => (
                <option key={centerName} value={centerName}>
                  {centerName}
                </option>
              ))}
            </FilterSelect>

            <DownloadRow>
              <DownloadButton type="button" onClick={downloadAllResults} disabled={!rows || rows.length === 0}>
                <Download size={16} />
                Download All
              </DownloadButton>
              <DownloadButton type="button" onClick={downloadFilteredResults} disabled={!filteredRows.length}>
                <Download size={16} />
                Download Filtered
              </DownloadButton>
            </DownloadRow>

            <CentersList>
              {centers.map((centerName) => (
                <div className="center-item" key={centerName}>
                  <MapPin size={15} />
                  {centerName}
                </div>
              ))}
            </CentersList>
          </>
        )}
      </Card>
    </FormContainer>
  );
};

export default MaterialAccessGate;
