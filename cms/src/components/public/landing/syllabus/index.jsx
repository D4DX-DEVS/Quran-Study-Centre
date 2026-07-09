import React, { useEffect, useState } from "react";
import styled from "styled-components";
import withLayout from "../../layout";
import { getData } from "../../../../backend/api";
import Header from "../Header";
import Footer from "../footer/footer";

const CDN = import.meta.env.VITE_APP_CDN || "";

// Static syllabus content, transcribed from the QSC annual exam syllabus document.
const SECTIONS = [
  {
    group: "പ്രിലിമിനറി വിഭാഗം (PR)",
    code: "PR",
    num: 1,
    roman: "I",
    heading: "ഒന്നാം വർഷം (PR I)",
    portion: "സൂറ അൽഫാതിഹ, സൂറ അൽഅഅ്ല മുതൽ സൂറ അന്നാസ് വരെ",
    prayers:
      "പാഠഭാഗവുമായി ബന്ധപ്പെട്ട പ്രാർത്ഥനകൾ, ഹദീസുകൾ (ഖുർആൻ സ്റ്റഡി സെന്റർ തയ്യാറാക്കിയ ഒന്നാം വർഷ കൈപുസ്തകത്തിൽ പ്രതിപാദിക്കുന്നത്)",
    special:
      "ഇബാദത്ത്, തസ്കിയത്ത് (ഖുർആൻ സ്റ്റഡി സെന്റർ തയ്യാറാക്കിയ ഒന്നാം വർഷ കൈ പുസ്തകത്തിൽ അവസാനഭാഗത്ത് ഇരു വിഷയങ്ങളിലും ആവശ്യമായ കുറിപ്പ് നൽകിയിട്ടുണ്ട്)",
  },
  {
    group: "പ്രിലിമിനറി വിഭാഗം (PR)",
    code: "PR",
    num: 2,
    roman: "II",
    heading: "രണ്ടാം വർഷം (PR II)",
    portion:
      "സൂറ അന്നബഅ് മുതൽ സൂറ അത്വാരിഖ് വരെ, സൂറ യാസീൻ, സൂറ അസ്സജദ, സൂറ അൽ ജുമുഅ, സൂറ അൽ മുനാഫിഖൂൻ, സൂറ അൽ ഇൻസാൻ",
    prayers:
      "പാഠഭാഗവുമായി ബന്ധപ്പെട്ട പ്രാർത്ഥനകൾ, ഹദീസുകൾ (ഖുർആൻ സ്റ്റഡി സെന്റർ തയ്യാറാക്കിയ രണ്ടാം വർഷ കൈപുസ്തകത്തിൽ പ്രതിപാദിക്കുന്നത്)",
    special:
      "നിഫാഖ് അഥവാ കാപട്യം (ഖുർആൻ സ്റ്റഡി സെന്റർ തയ്യാറാക്കിയ രണ്ടാം വർഷ ​​കൈപുസ്തകത്തിൽ അവസാനഭാഗത്ത് ആവശ്യമായ കുറിപ്പ് നൽകിയിട്ടുണ്ട്)",
  },
  {
    group: "പ്രിലിമിനറി വിഭാഗം (PR)",
    code: "PR",
    num: 3,
    roman: "III",
    heading: "മൂന്നാം വർഷം (PR III)",
    portion: "സൂറ അൽബഖറ",
    special: "ഖിലാഫത്ത്, ത്വലാഖ്, ശഹാദത്തുൽ ഹഖ്",
  },
  {
    group: "പ്രിലിമിനറി വിഭാഗം (PR)",
    code: "PR",
    num: 4,
    roman: "IV",
    heading: "നാലാം വർഷം (PR IV)",
    portion: "സൂറ ആലു ഇംറാൻ, അന്നിസാഅ്",
    special: "സ്വബ്ർ, ഹാകിമിയ്യത്",
  },
  {
    group: "പ്രിലിമിനറി വിഭാഗം (PR)",
    code: "PR",
    num: 5,
    roman: "V",
    heading: "അഞ്ചാം വർഷം (PR V)",
    portion: "സൂറ അൽ മാഇദ, സൂറ അൽ അൻആം, സൂറ അൽ അഅ്റാഫ്",
    special: "രിസാലത്തു റസുൽ, തൗഹീദു റുബൂബിയ്യ, തൗഹീദു ഉലൂഹിയ്യ",
  },
  {
    group: "പ്രിലിമിനറി വിഭാഗം (PR)",
    code: "PR",
    num: 6,
    roman: "VI",
    heading: "ആറാം വർഷം (PR VI - FINAL)",
    portion: "സൂറ അൽ അൻഫാൽ മുതൽ സൂറ യൂസുഫ് വരെ, സൂറ അൽ കഹ്ഫ്",
    special: "ജിഹാദ്",
  },
  {
    group: "സെക്കണ്ടറി വിഭാഗം (SEC)",
    code: "SEC",
    num: 1,
    roman: "I",
    heading: "ഒന്നാം വർഷം (SEC I)",
    portion: "സൂറ അറഅ്ദ് മുതൽ അൽ മുഅ്മിനൂൻ വരെ (സൂറ അൽ കഹ്ഫ് ഒഴികെ)",
    special: "ദഅ് വത്ത്, ഉമ്മത്ത്",
  },
  {
    group: "സെക്കണ്ടറി വിഭാഗം (SEC)",
    code: "SEC",
    num: 2,
    roman: "II",
    heading: "രണ്ടാം വർഷം (SEC II)",
    portion: "സൂറ അന്നൂർ മുതൽ സൂറ അസ്സുമർ വരെ (സൂറ യാസീൻ, സൂറ അസ്സജദ എന്നിവ ഒഴികെ)",
    special: "സ്ത്രീ പുരുഷ ബന്ധങ്ങളിലെ സദാചാര നിയമങ്ങൾ",
  },
  {
    group: "സെക്കണ്ടറി വിഭാഗം (SEC)",
    code: "SEC",
    num: 3,
    roman: "III",
    heading: "മൂന്നാം വർഷം (SEC III - FINAL)",
    portion:
      "സൂറ ഗാഫിർ മുതൽ സൂറ അൽമുർസലാത്ത് വരെ (സൂറ അൽ ജുമുഅ, സൂറ അൽ മുനാഫിഖൂൻ, സൂറ അൽ ഇൻസാൻ എന്നിവ ഒഴികെ)",
    special: "ഇഖാമതുദ്ദീൻ",
  },
];

// Admins may title papers with the short code ("PR1", "SEC I") or the full
// word ("Preliminary I", "Secondary III(Final)") - match either form.
const PREFIX_ALIASES = {
  PR: ["PR", "Preliminary"],
  SEC: ["SEC", "Secondary"],
};

// Typed-out roman numerals are easy to fat-finger/autocorrect (e.g. "III" -> "Ill"),
// so treat I / l / 1 as interchangeable when matching each "I" in a roman numeral.
const fuzzyRoman = (roman) => roman.replace(/I/g, "[Il1]");

const findPreviousQuestionPaper = (papers, section) => {
  const prefixes = PREFIX_ALIASES[section.code] || [section.code];
  const patterns = prefixes.flatMap((prefix) => [
    new RegExp(`\\b${prefix}\\s*-?\\s*${section.num}\\b`, "i"),
    new RegExp(`\\b${prefix}\\s*-?\\s*${fuzzyRoman(section.roman)}\\b`, "i"),
  ]);
  const matches = papers.filter((paper) =>
    patterns.some((pattern) => pattern.test(paper.title || ""))
  );
  if (!matches.length) return null;
  return matches.sort((a, b) => String(b.year).localeCompare(String(a.year)))[0];
};

const Intro = styled.section`
  padding: 48px 20px 8px;
  text-align: center;
`;

const PageTitle = styled.h1`
  font-family: "Noto Sans Malayalam", sans-serif;
  font-size: clamp(1.5rem, 3.6vw, 2.3rem);
  color: #1a4993;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0 0 12px;

  &::after {
    content: "";
    display: block;
    width: 64px;
    height: 4px;
    background: linear-gradient(90deg, #1a4993, #4f8fe8);
    margin: 14px auto 0;
    border-radius: 4px;
  }
`;

const IntroSub = styled.p`
  font-family: "Noto Sans Malayalam", sans-serif;
  color: #59718a;
  font-size: 15px;
  margin: 0;
`;

const GroupWrap = styled.section`
  padding: 24px 20px 8px;
`;

const GroupHeading = styled.h2`
  font-family: "Noto Sans Malayalam", sans-serif;
  font-size: clamp(1.1rem, 2.6vw, 1.5rem);
  color: #0f2743;
  font-weight: 700;
  margin: 0 0 18px;
  padding-bottom: 10px;
  border-bottom: 2px solid rgba(26, 73, 147, 0.12);
`;

const CardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
`;

const Card = styled.div`
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(26, 73, 147, 0.08);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;

  @media (max-width: 768px) {
    padding: 18px;
  }
`;

const CardHeading = styled.h3`
  font-family: "Noto Sans Malayalam", sans-serif;
  font-size: 17px;
  color: #1a4993;
  font-weight: 700;
  margin: 0;
`;

const Field = styled.div`
  font-family: "Noto Sans Malayalam", sans-serif;
`;

const FieldLabel = styled.div`
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #59718a;
  margin-bottom: 4px;
`;

const FieldValue = styled.div`
  font-size: 15px;
  line-height: 1.7;
  color: #333333;
`;

const CardFooter = styled.div`
  margin-top: auto;
  padding-top: 8px;
`;

const QpButton = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: linear-gradient(135deg, #1d4ed8, #3b6ff0);
  color: #ffffff;
  font-family: "Noto Sans Malayalam", sans-serif;
  font-weight: 700;
  font-size: 13px;
  padding: 10px 18px;
  border-radius: 999px;
  text-decoration: none;
`;

const ComingSoon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(89, 113, 138, 0.12);
  color: #59718a;
  font-family: "Noto Sans Malayalam", sans-serif;
  font-weight: 700;
  font-size: 13px;
  padding: 10px 18px;
  border-radius: 999px;
`;

const SECTION_GROUPS = SECTIONS.reduce((groups, section) => {
  const lastGroup = groups[groups.length - 1];
  if (lastGroup && lastGroup.group === section.group) {
    lastGroup.items.push(section);
  } else {
    groups.push({ group: section.group, items: [section] });
  }
  return groups;
}, []);

const SyllabusPage = (props) => {
  const [papers, setPapers] = useState([]);

  useEffect(() => {
    document.title = "Syllabus - ഖുർആൻ സ്റ്റഡി സെന്റർ കേരള";
  }, []);

  useEffect(() => {
    getData({}, "old-question-papers")
      .then((res) => {
        if (res && res.data.response) {
          setPapers(res.data.response);
        }
      })
      .catch((error) => {
        console.error("Error fetching question papers:", error);
      });
  }, []);

  return (
    <>
      <Header {...props} />
      <main className="landing-home">
        <div className="landing-page-shell">
          <Intro>
            <PageTitle>വാർഷിക പരീക്ഷ സിലബസ്</PageTitle>
            <IntroSub>ഖുർആൻ സ്റ്റഡി സെന്റർ കേരള</IntroSub>
          </Intro>

          {SECTION_GROUPS.map((groupBlock) => (
            <GroupWrap key={groupBlock.group}>
              <GroupHeading>{groupBlock.group}</GroupHeading>
              <CardGrid>
                {groupBlock.items.map((section) => {
                  const previousPaper = findPreviousQuestionPaper(papers, section);
                  return (
                    <Card key={`${section.code}-${section.num}`}>
                      <CardHeading>{section.heading}</CardHeading>

                      <Field>
                        <FieldLabel>പഠിക്കേണ്ട ഭാഗം</FieldLabel>
                        <FieldValue>{section.portion}</FieldValue>
                      </Field>

                      {section.prayers && (
                        <Field>
                          <FieldLabel>പ്രാർത്ഥനകൾ &amp; ഹദീസുകൾ</FieldLabel>
                          <FieldValue>{section.prayers}</FieldValue>
                        </Field>
                      )}

                      <Field>
                        <FieldLabel>പ്രത്യേകം പഠിപ്പിക്കേണ്ട വിഷയങ്ങൾ</FieldLabel>
                        <FieldValue>{section.special}</FieldValue>
                      </Field>

                      <CardFooter>
                        {previousPaper ? (
                          <QpButton
                            href={CDN + previousPaper.attachment}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={CDN + previousPaper.attachment}
                          >
                            Previous Question Paper
                          </QpButton>
                        ) : (
                          <ComingSoon>Coming Soon</ComingSoon>
                        )}
                      </CardFooter>
                    </Card>
                  );
                })}
              </CardGrid>
            </GroupWrap>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
};

export default withLayout(SyllabusPage);
