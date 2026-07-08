import React, { useState } from "react";
import axios from "axios";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Download, LogOut, MapPin } from "lucide-react";
import styled from "styled-components";
import { postData } from "../../../backend/api";
import { buildApiUrl } from "../../../backend/baseUrl";
import { FormContainer } from "./registrationForm";
import { groupDataByDistrictAreaCenter, generateExcelFile, generatePdfFile } from "../../../utils/attendanceExport";

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
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  const fetchAttendance = async (token) => {
    setLoadingAttendance(true);
    setError("");
    try {
      const response = await axios.get(buildApiUrl("material-access/attendance"), {
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
      setLoadingAttendance(false);
    }
  };

  React.useEffect(() => {
    if (session?.token) {
      fetchAttendance(session.token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

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
    setPassword("");
  };

  const downloadZip = async () => {
    if (!rows || rows.length === 0) return;

    const grouped = groupDataByDistrictAreaCenter(rows);
    const districtKey = Object.keys(grouped)[0];
    const areaKey = districtKey ? Object.keys(grouped[districtKey])[0] : null;
    if (!districtKey || !areaKey) return;

    const zip = new JSZip();
    Object.entries(grouped[districtKey][areaKey]).forEach(([centerName, data]) => {
      const excelBuffer = generateExcelFile(data, centerName);
      const pdfBuffer = generatePdfFile(data, centerName);
      const centerFolder = zip.folder(centerName);
      if (excelBuffer) centerFolder.file(`${centerName}.xlsx`, excelBuffer);
      if (pdfBuffer) centerFolder.file(`${centerName}.pdf`, pdfBuffer);
    });

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `${areaKey} - Attendance Sheet.zip`);
  };

  if (!session?.token) {
    return (
      <FormContainer style={{ display: "flex", justifyContent: "center", padding: "20px" }}>
        <Card>
          <TitleBox>
            <h2>Area Material Access</h2>
            <p>Enter your area's material password to view attendance and exam centers.</p>
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

        {loadingAttendance ? (
          <SummaryText>Loading attendance...</SummaryText>
        ) : (
          <>
            <SummaryText>
              {rows?.length || 0} registrations across {centers.length} exam centre(s).
            </SummaryText>
            <DownloadButton
              type="button"
              onClick={downloadZip}
              disabled={!rows || rows.length === 0}
            >
              <Download size={16} />
              Download Attendance (Excel + PDF)
            </DownloadButton>

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
