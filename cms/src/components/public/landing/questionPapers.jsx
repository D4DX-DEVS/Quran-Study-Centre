import React, { useState } from "react";
import styled from "styled-components";
import { getData } from "../../../backend/api";
import { useEffect } from "react";
import withLayout from "../layout";
import Header from "./Header";
import Footer from "./footer/footer";
import { reveal } from "./scrollReveal";
import { usePageSeo } from "../../../utils/seo";

const Main = styled.div`
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  justify-content: center;
  gap: 24px;
  width: 100%;

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: center;
    gap: 0;
  }
`;

const Column = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 640px;

  @media (max-width: 768px) {
    width: 100%;
  }
`;

const Title = styled.h1`
  display: flex;
  align-items: center;
  justify-content: start;
  font-family: "Fraunces", serif;
  font-size: var(--landing-h2);
  font-weight: 700;
  color: #0f2743;
  margin: var(--landing-page-pad-top) 0 0;
  width: 100%;
`;

const StyledButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 72px;
  padding: 8px 16px;
  border-radius: 999px;
  border: 1px solid ${({ $active }) => ($active ? "transparent" : "rgba(29, 78, 216, 0.16)")};
  background: ${({ $active }) => ($active ? "linear-gradient(135deg, #1d4ed8, #3b6ff0)" : "#ffffff")};
  color: ${({ $active }) => ($active ? "#ffffff" : "#0f2743")};
  font-family: "Manrope", sans-serif;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease;

  &:hover {
    border-color: rgba(29, 78, 216, 0.4);
  }
`;

const ContentBox = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  background: #ffffff;
  border-radius: var(--landing-card-radius);
  box-shadow: var(--landing-card-shadow);
  margin: 14px 0 var(--landing-page-pad-bottom);
  padding: 18px 0;
`;

const ListItem = styled.div`
  display: flex;
  align-items: center;
  padding: 0 24px;
  color: #005ca3;
  font-weight: 700;
  transition: color 0.2s;
  font-size: 15px;

  &:hover {
    color: #1d4ed8;
  }

  a {
    display: block;
    flex: 1;
    min-width: 0;
  }

  p {
    margin: 0;
    padding: 9px 4px;
    word-break: break-word;
  }

  @media (max-width: 768px) {
    padding: 0 14px;
    font-size: 14px;
  }
`;

const Arrow = styled.span`
  margin-right: 10px;
`;

const TabBox = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 8px;
  width: 100%;
  margin-top: 12px;
`;

const QuestionPapersComponent = (props) => {
  usePageSeo({ title: "Question Bank - Quran Study Centre Kerala", description: "Download previous question papers (Question Bank) of Quran Study Centre Kerala exams." });
  const [activeTab, setActiveTab] = useState(0);
  const [tabs, setTabs] = useState([]);
  useEffect(() => {
    // Fetch data from the backend when the component mounts
    getData({}, "old-question-papers")
      .then((res) => {
        if (res && res.data.response) {
          const grouped = {};
          res.data.response.forEach((item) => {
            if (!grouped[item.year]) grouped[item.year] = { year: item.year, items: [] };
            grouped[item.year].items.push(item);
          });
          const groupedTabs = Object.values(grouped).sort((a, b) => String(b.year).localeCompare(String(a.year)));
          groupedTabs.forEach((tab) => {
            tab.items.sort((a, b) => String(a.title).localeCompare(String(b.title)));
          });
          setTabs(groupedTabs);
        }
      })
      .catch((error) => {
        console.error("Error fetching data:", error);
      });
  }, []); // Run this effect only once when the component mounts

  const handleTabClick = (index) => {
    setActiveTab(index);
  };

  return (
    <>
      <Header {...props} />
      <main className="landing-home">
        <div className="landing-page-shell">
          <Main>
            <Column>
              <Title ref={reveal}>Download Question Banks Now!</Title>
              <TabBox>
                {tabs.map((tab, index) => (
                  <StyledButton key={index} $active={index === activeTab} onClick={() => handleTabClick(index)}>
                    {tab.year}
                  </StyledButton>
                ))}
              </TabBox>
              <ContentBox ref={reveal}>
                {tabs.length === 0 ? (
                  <p style={{ textAlign: "center", color: "#888" }}>
                    No question papers found.
                  </p>
                ) : (
                  tabs[activeTab]?.items.map((item, index) => (
                    <ListItem key={index}>
                      <Arrow>&#11208;</Arrow>
                      <a href={import.meta.env.VITE_APP_CDN + item.attachment} target="_blank" rel="noopener noreferrer" download={import.meta.env.VITE_APP_CDN + item.attachment} style={{ color: "#1a4993" }}>
                        <p>{item.title}</p>
                      </a>
                    </ListItem>
                  ))
                )}
              </ContentBox>
            </Column>
          </Main>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default withLayout(QuestionPapersComponent);
