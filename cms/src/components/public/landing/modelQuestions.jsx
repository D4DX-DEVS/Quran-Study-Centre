import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { Download } from "lucide-react";
import { getData } from "../../../backend/api";
import withLayout from "../layout";
import Header from "./Header";
import Footer from "./footer/footer";
import { reveal } from "./scrollReveal";
import { usePageSeo } from "../../../utils/seo";
import { EXAM_CATEGORY_GROUPS, MODEL_PAPER_KINDS } from "./examCategories";

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

const GroupWrap = styled.section`
  padding: 20px 0 4px;
`;

const GroupHeading = styled.h2`
  font-family: "Fraunces", serif;
  font-size: clamp(1.05rem, 2vw, 1.3rem);
  color: #0f2743;
  font-weight: 700;
  margin: 0 0 14px;
  padding-bottom: 8px;
  border-bottom: 2px solid rgba(26, 73, 147, 0.12);
`;

const CardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--landing-grid-gap);
  margin-bottom: 20px;
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
        // A record without an uploaded file is not something a visitor can download.
        setPapers(files.data.response.filter((item) => item.attachment));
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

  const filesFor = (category, kind) =>
    papers
      .filter((item) => item.category === category && item.kind === kind)
      .sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));

  return (
    <>
      <Header {...props} />
      <main className="landing-home">
        <div className="landing-page-shell">
          <Intro ref={reveal}>
            <PageTitle>Model Question &amp; Answer Key</PageTitle>
            {status === "ready" && <Lead>Download the model question paper and its answer key for each exam.</Lead>}
          </Intro>

          {status === "loading" && null}
          {status === "off" && <Notice>This section is not available right now.</Notice>}
          {status === "error" && <Notice>Unable to load the files right now. Please try again later.</Notice>}

          {status === "ready" &&
            EXAM_CATEGORY_GROUPS.map(({ group, categories }) => (
              <GroupWrap key={group}>
                <GroupHeading ref={reveal}>{group}</GroupHeading>
                <CardGrid>
                  {categories.map((category) => (
                    <Card key={category} ref={reveal} className="landing-hover-lift">
                      <CardHeading>{category}</CardHeading>
                      {MODEL_PAPER_KINDS.map((kind) => {
                        const files = filesFor(category, kind);
                        return (
                          <KindBlock key={kind}>
                            <KindLabel>{kind}</KindLabel>
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
                                  aria-label={`Download ${kind} - ${category}`}
                                >
                                  <Download size={15} aria-hidden="true" />
                                  {file.title || `Download ${kind}`}
                                </FileLink>
                              ))
                            )}
                          </KindBlock>
                        );
                      })}
                    </Card>
                  ))}
                </CardGrid>
              </GroupWrap>
            ))}
        </div>
      </main>
      <Footer />
    </>
  );
};

export default withLayout(ModelQuestionsPage);
