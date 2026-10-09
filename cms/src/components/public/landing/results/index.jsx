import React, { useEffect, useRef, useState } from "react";
import { Button, ElementContainer, TextBox } from "../../../core/elements";
import styled from "styled-components";
import { getData } from "../../../../backend/api"; // Assuming you have a getData function for fetching data
import { CERTIFICATE_DOWNLOADED_MESSAGE, downloadCertificatePdf } from "../../../../utils/certificateDownload";
import { usePageSeo } from "../../../../utils/seo";
import withLayout from "../../layout";
import Header from "../Header";
import Footer from "../footer/footer";
import { reveal } from "../scrollReveal";

const TextDiv = styled.div`
  display: flex;
  gap: 10px;
  width: 50%;
  justify-content: center;
  align-items: end;
  @media (max-width: 768px) {
    /* For tab view and smaller screens */
    width: 100%; /* Optionally adjust the width for smaller screens */
  }
  @media (max-width: 500px) {
    /* For tab view and smaller screens */
    flex-direction: column;
    justify-content: center;
    align-items: start;
    width: 100%; /* Optionally adjust the width for smaller screens */
  }
`;
const ButtonDiv = styled.div`
  /* margin-top: 23px; */
`;

const detailStyle = { textAlign: "left", marginBottom: "10px", marginTop: "10px" };

// "Mohammed A K" -> "Mohammed-A-K"; names with no Latin letters (Malayalam) fall back to the default.
const certificateFileName = (name) => {
  const slug = String(name || "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `QSC-Certificate-${slug}.pdf` : "QSC-Certificate.pdf";
};

// Motion lives in landing/style.css ("Result page" block): CSS only, and all of
// it is switched off for visitors who prefer reduced motion.
const enterDelay = (ms) => ({ "--enter-delay": `${ms}ms` });

// Shown while real requests are in flight — it appears only as long as the
// request takes (a short CSS fade-in keeps very fast responses from flashing it).
const LoadingPanel = ({ label }) => (
  <div className="landing-result-loading" role="status" aria-live="polite">
    <span className="landing-result-spinner" aria-hidden="true" />
    <span>{label}</span>
  </div>
);

const ResultSkeleton = () => (
  <div className="landing-result-skeleton" role="status" aria-live="polite" aria-label="Searching for your result">
    <span style={{ width: "62%" }} />
    <span style={{ width: "48%" }} />
    <span style={{ width: "36%" }} />
    <span style={{ width: "42%" }} />
    <span style={{ width: "30%" }} />
  </div>
);

const StatusNote = ({ tone, message, onRetry }) => (
  <div className={`landing-result-note ${tone}`} role="alert">
    <span>{message}</span>
    {onRetry && (
      <button type="button" className="landing-result-retry" onClick={onRetry}>
        Try again
      </button>
    )}
  </div>
);

// What the visitor is told when a search cannot be answered — each cause gets its own message.
const EMPTY_MESSAGE = "No published result found for the provided details.";
const NO_CONNECTION_MESSAGE = "Could not connect to the server. Please check your internet connection and try again.";
const SERVER_PROBLEM_MESSAGE = "The result service is having a problem right now. Please try again in a few minutes.";
const SERVICE_UNAVAILABLE_MESSAGE = "The result service is not available right now. Please try again later.";

const Results = (props) => {
  usePageSeo({ title: "Exam Result - Quran Study Centre Kerala", description: "Check your Quran Study Centre Kerala exam result and download your certificate using your register number or mobile number." });
  const [regNo, setRegNo] = useState("");
  // Published results returned by the server for the last search. Each carries
  // only name / exam / mark / grade / rank plus a short-lived `ref` that the
  // certificate download needs — nothing else about the student.
  const [results, setResults] = useState([]);
  // loading -> ready (Landing Page Settings "Result" toggle is on) | off (toggle is off) | error (settings could not be loaded)
  const [pageState, setPageState] = useState("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  // Last search: idle | loading | success | empty (no result for those details) | error (request failed)
  const [search, setSearch] = useState({ status: "idle", message: "" });
  const searchSeq = useRef(0);
  const [downloadingRef, setDownloadingRef] = useState("");
  const downloadLock = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getData({}, "floating-menu-settings").then((response) => {
      if (cancelled) return;
      // getData resolves (never rejects) — a failed request has no `response` list.
      if (response?.status !== 200 || !Array.isArray(response.data?.response)) {
        setPageState("error");
        return;
      }
      // The Result toggle decides. Prefer the server's own verdict (the same check the result API enforces).
      const live = typeof response.data.resultPublished === "boolean" ? response.data.resultPublished : response.data.response[0]?.result === true;
      setPageState(live ? "ready" : "off");
    });
    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  // Keep search engines from indexing the page while results are hidden
  useEffect(() => {
    if (pageState !== "off") return;
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, [pageState]);

  const showError = (content) => props.setMessage({ type: 1, content, icon: "error" });

  const retryPageLoad = () => {
    setPageState("loading");
    setLoadAttempt((attempt) => attempt + 1);
  };

  const searchResult = async () => {
    const value = regNo.trim();
    if (!value) {
      showError("Please enter Register number / Mobile number");
      return;
    }
    if (search.status === "loading") return;

    // Only the newest search may update the screen (guards against out-of-order replies).
    const seq = ++searchSeq.current;
    setResults([]);
    setSearch({ status: "loading", message: "" });

    const response = await getData({ regno: value }, "exam-registration/student-result");
    if (seq !== searchSeq.current) return;

    const found = response?.status === 200 && Array.isArray(response.data?.results) ? response.data.results : [];
    if (found.length) {
      setResults(found);
      setSearch({ status: "success", message: "" });
      return;
    }

    // `data` carries the server's own reason on failure (invalid input, not published, too many tries…).
    const status = response?.status;
    const reason = typeof response?.data === "string" ? response.data : "";
    if (!status) {
      setSearch({ status: "error", message: NO_CONNECTION_MESSAGE }); // request never reached the server
    } else if (status >= 500) {
      setSearch({ status: "error", message: SERVER_PROBLEM_MESSAGE });
    } else if (status === 404 && !reason) {
      setSearch({ status: "error", message: SERVICE_UNAVAILABLE_MESSAGE }); // route missing: not a "no result" answer
    } else if (status === 429) {
      setSearch({ status: "error", message: reason || SERVER_PROBLEM_MESSAGE });
    } else {
      setSearch({ status: "empty", message: reason || EMPTY_MESSAGE }); // 400 / 403 / 404 with the server's reason
    }
  };

  const downloadCertificate = async (item) => {
    // One download at a time, so a double tap cannot fire two requests or two notices.
    if (downloadLock.current) return;
    downloadLock.current = true;
    setDownloadingRef(item.ref);
    props.setLoaderBox(true);
    try {
      const outcome = await downloadCertificatePdf({ ref: item.ref }, certificateFileName(item.name));
      if (outcome.ok) {
        props.setMessage({ type: 1, content: CERTIFICATE_DOWNLOADED_MESSAGE, icon: "success" });
      } else {
        showError(outcome.message);
      }
    } finally {
      props.setLoaderBox(false);
      setDownloadingRef("");
      downloadLock.current = false;
    }
  };

  const searching = search.status === "loading";

  const renderBody = () => {
    if (pageState === "loading") return <LoadingPanel label="Loading…" />;

    if (pageState === "error") {
      return (
        <div className="landing-result-enter">
          <h1 className="landing-section-title" style={{ marginTop: "0px", marginBottom: "10px" }}>Exam Result</h1>
          <StatusNote tone="error" message="Unable to load the result page right now. Please check your connection and try again." onRetry={retryPageLoad} />
        </div>
      );
    }

    if (pageState === "off") {
      return (
        <div className="landing-result-enter">
          <h1 className="landing-section-title" style={{ marginTop: "0px", marginBottom: "10px" }}>Exam Result</h1>
          <h4 style={{ marginTop: "10px", color: "Red" }}>The result is not published yet</h4>
        </div>
      );
    }

    return (
      <div>
        <h1 className="landing-section-title landing-result-enter" style={{ marginTop: "0px", marginBottom: "10px" }}>Exam Result</h1>
        <h4 className="landing-result-enter" style={{ ...enterDelay(70), marginTop: "10px", color: "Red", fontFamily: "'Noto Sans Malayalam', sans-serif" }}>ഖുർആൻ സ്റ്റഡി സെന്റർ കേരള 2026 വാർഷിക പരീക്ഷ എഴുതിയ ,എല്ലാ വിഭാഗങ്ങളിലുമുള്ള പഠിതാക്കളുടെ റിസൽട്ട് പബ്ലിഷ് ചെയ്തിട്ടുണ്ട്. പഠിതാക്കളുടെ രജിസ്റ്റർ നമ്പർ അല്ലെങ്കിൽ മൊബൈൽ നമ്പർ താഴെ നൽകി, Search Result ക്ലിക്ക് ചെയ്താൽ ലഭിച്ച മാർക്കും ഗ്രേഡും കാണാം. Download Certificate click ചെയ്താൽ ഗ്രേഡ് രേഖപ്പെടുത്തിയ സർട്ടിഫിക്കറ്റ് pdf ഫയൽ ആയി ലഭിക്കുന്നതാണ്. </h4>
        <div className="landing-result-enter" style={enterDelay(140)}>
          <TextDiv>
            <TextBox
              className="text-box"
              label="Enter Register Number / Mobile Number"
              value={regNo}
              onChange={(value) => setRegNo(value)}
            ></TextBox>
            <ButtonDiv>
              <Button
                className="btn-search"
                type={"secondary"}
                align="right"
                icon={"search"}
                isDisabled={searching}
                ClickEvent={searchResult}
                value={searching ? "Searching…" : "Search Result"}
              ></Button>
            </ButtonDiv>
          </TextDiv>
        </div>

        {searching && <ResultSkeleton />}
        {search.status === "empty" && <StatusNote tone="empty" message={search.message} />}
        {search.status === "error" && <StatusNote tone="error" message={search.message} onRetry={searchResult} />}

        {results.length > 0 && <h2 ref={reveal} style={{ marginTop: "10px", color: "green" }}>Result Published</h2>}

        {results.map((item) => (
          <div key={item.ref} style={{ marginBottom: "20px" }}>
            <p ref={reveal} style={detailStyle}>
              <b>Name :</b> {item.name}
            </p>
            <p ref={reveal} style={detailStyle}>
              <b>Exam :</b> {item.exam}
            </p>
            <p ref={reveal} style={detailStyle}>
              <b>Mark :</b> {item.mark}
            </p>
            <p ref={reveal} style={detailStyle}>
              <b>Grade :</b> {item.grade}
            </p>
            {item.rank && (
              <p ref={reveal} style={detailStyle}>
                <b>Rank :</b>{" "}
                <span style={{ color: "#1a4993", fontWeight: 700 }}>
                  #{item.rank}
                </span>{" "}
                <span style={{ color: "#666", fontSize: 13 }}>
                  (of {item.totalCandidates} — {item.scopeLabel})
                </span>
              </p>
            )}
            <ButtonDiv ref={reveal} style={{ marginTop: "20px" }}>
              <Button
                key={item.ref}
                className="btn-download"
                icon={"download"}
                isDisabled={downloadingRef === item.ref}
                value={downloadingRef === item.ref ? "Preparing certificate…" : "Download Certificate"}
                ClickEvent={() => downloadCertificate(item)}
              />
            </ButtonDiv>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <Header {...props} />
      <main className="landing-home">
        <div className="landing-page-shell">
          <ElementContainer
            className="dashboard landing-result-page"
            style={{
              display: "flex",
              flexDirection: "column",
              paddingTop: "var(--landing-page-pad-top)",
              paddingBottom: "var(--landing-page-pad-bottom)",
              flexWrap: "nowrap",
            }}
          >
            {renderBody()}
          </ElementContainer>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default withLayout(Results);
