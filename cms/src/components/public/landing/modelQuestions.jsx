import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { Download } from "lucide-react";
import { getData } from "../../../backend/api";
import withLayout from "../layout";
import Header from "./Header";
import Footer from "./footer/footer";
import { reveal } from "./scrollReveal";
import { usePageSeo } from "../../../utils/seo";
import { EXAM_CATEGORIES, MODEL_PAPER_KINDS } from "./examCategories";

const CDN = import.meta.env.VITE_APP_CDN || "";

const Intro = styled.section`
  padding: var(--landing-page-pad-top) 0 4px;
  text-align: center;
`;

const PageTitle = styled.h1`
  font-family: "Fraunces", serif;
  font-size: var(--landing-h1);
  color: #1a4993;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0 0 8px;

  &::after {
    content: "";
    display: block;
    width: 56px;
    height: 3px;
    background: linear-gradient(90deg, #1a4993, #4f8fe8);
    margin: 10px auto 0;
    border-radius: 4px;
  }
`;

const Lead = styled.p`
  font-family: "Manrope", sans-serif;
  color: #59718a;
  font-size: 15px;
  margin: 0 auto;
  max-width: 560px;
`;

const Picker = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  max-width: 720px;
  margin: 24px auto 0;
  background: #ffffff;
  border-radius: var(--landing-card-radius-sm);
  box-shadow: var(--landing-card-shadow);
  padding: 20px;

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
    padding: 16px;
  }
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-family: "Manrope", sans-serif;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #59718a;
`;

const Select = styled.select`
  width: 100%;
  padding: 11px 14px;
  border-radius: 12px;
  border: 1px solid rgba(29, 78, 216, 0.2);
  background: #ffffff;
  color: #0f2743;
  font-family: "Manrope", sans-serif;
  font-size: 15px;
  font-weight: 600;
  text-transform: none;
  letter-spacing: normal;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: #1d4ed8;
    box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.15);
  }

  &:disabled {
    cursor: not-allowed;
    background: #f4f7fb;
    color: #8aa0b6;
  }
`;

const ResultGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--landing-grid-gap);
  max-width: 720px;
  margin: 20px auto var(--landing-page-pad-bottom);

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

const Card = styled.div`
  background: #ffffff;
  border-radius: var(--landing-card-radius-sm);
  box-shadow: var(--landing-card-shadow);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;

  @media (max-width: 768px) {
    padding: 16px;
  }
`;

const CardHeading = styled.h3`
  font-family: "Fraunces", serif;
  font-size: 17px;
  color: #1a4993;
  font-weight: 700;
  margin: 0;
`;

const KindBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const KindLabel = styled.div`
  font-family: "Manrope", sans-serif;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #59718a;
`;

const FileLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  align-self: flex-start;
  max-width: 100%;
  background: linear-gradient(135deg, #1d4ed8, #3b6ff0);
  color: #ffffff;
  font-family: "Manrope", sans-serif;
  font-weight: 700;
  font-size: 13px;
  padding: 10px 18px;
  border-radius: 999px;
  text-decoration: none;
  word-break: break-word;

  &:hover {
    filter: brightness(1.08);
  }
`;

const NotAvailable = styled.span`
  align-self: flex-start;
  background: rgba(89, 113, 138, 0.12);
  color: #59718a;
  font-family: "Manrope", sans-serif;
  font-weight: 700;
  font-size: 13px;
  padding: 10px 18px;
  border-radius: 999px;
`;

const Notice = styled.p`
  text-align: center;
  color: #59718a;
  font-family: "Manrope", sans-serif;
  margin: 40px 0 var(--landing-page-pad-bottom);
`;

const ModelQuestionsPage = (props) => {
  // loading | off (switched off in Landing Page Settings) | ready | error
  const [status, setStatus] = useState("loading");
  const [papers, setPapers] = useState([]);
  const [year, setYear] = useState("");
  const [exam, setExam] = useState("");

  // Switched-off sections stay out of search results (see the `off` effect below).
  usePageSeo({
    title: "Model Question & Answer Key - Quran Study Centre Kerala",
    description: "Download model question papers and answer keys for Preliminary I-VI and Secondary I-III exams of Quran Study Centre Kerala.",
    noindex: status === "off",
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const settings = await getData({}, "floating-menu-settings");
      if (cancelled) return;
      if (settings?.data?.response?.[0]?.modelQuestions !== true) {
        setStatus("off");
        return;
      }
      const files = await getData({}, "model-question-papers");
      if (cancelled) return;
      if (files?.status === 200 && Array.isArray(files.data?.response)) {
        // A record without an uploaded file or year is not something a visitor can pick.
        setPapers(files.data.response.filter((item) => item.attachment && item.year));
        setStatus("ready");
      } else {
        setStatus("error");
      }
    };
    load().catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, []);

  // Only years and exams that actually have files are offered, newest year first.
  const years = useMemo(() => [...new Set(papers.map((item) => item.year))].sort((a, b) => b.localeCompare(a)), [papers]);
  const exams = useMemo(
    () => EXAM_CATEGORIES.map((category) => category.value).filter((category) => papers.some((item) => item.year === year && item.category === category)),
    [papers, year]
  );

  const changeYear = (value) => {
    setYear(value);
    // Keep the exam when the new year has it too; otherwise ask again.
    if (!papers.some((item) => item.year === value && item.category === exam)) setExam("");
  };

  const filesFor = (kind) =>
    papers
      .filter((item) => item.year === year && item.category === exam && item.kind === kind)
      .sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));

  return (
    <>
      <Header {...props} />
      <main className="landing-home">
        <div className="landing-page-shell">
          <Intro ref={reveal}>
            <PageTitle>Model Question &amp; Answer Key</PageTitle>
            {status === "ready" && years.length > 0 && <Lead>Choose the year and exam to view the model question paper and its answer key.</Lead>}
          </Intro>

          {status === "loading" && null}
          {status === "off" && <Notice>This section is not available right now.</Notice>}
          {status === "error" && <Notice>Unable to load the files right now. Please try again later.</Notice>}
          {status === "ready" && years.length === 0 && <Notice>Model question papers and answer keys will be published here soon.</Notice>}

          {status === "ready" && years.length > 0 && (
            <>
              <Picker>
                <Field>
                  Year
                  <Select value={year} onChange={(event) => changeYear(event.target.value)}>
                    <option value="">Select year</option>
                    {years.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field>
                  Exam
                  <Select value={exam} onChange={(event) => setExam(event.target.value)} disabled={!year}>
                    <option value="">{year ? "Select exam" : "Select year first"}</option>
                    {exams.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </Select>
                </Field>
              </Picker>

              {year && exam ? (
                <ResultGrid>
                  {MODEL_PAPER_KINDS.map((kind) => {
                    const files = filesFor(kind);
                    return (
                      <Card key={kind} className="landing-hover-lift">
                        <CardHeading>{exam}</CardHeading>
                        <KindBlock>
                          <KindLabel>
                            {kind} · {year}
                          </KindLabel>
                          {files.length === 0 ? (
                            <NotAvailable>Not available yet</NotAvailable>
                          ) : (
                            files.map((file) => (
                              <FileLink
                                key={file._id}
                                href={CDN + file.attachment}
                                target="_blank"
                                rel="noopener noreferrer"
                                download={CDN + file.attachment}
                                aria-label={`Download ${kind} - ${exam} ${year}`}
                              >
                                <Download size={15} aria-hidden="true" />
                                {file.title || `Download ${kind}`}
                              </FileLink>
                            ))
                          )}
                        </KindBlock>
                      </Card>
                    );
                  })}
                </ResultGrid>
              ) : (
                <Notice>Select a year and an exam to see the files.</Notice>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
};

export default withLayout(ModelQuestionsPage);
