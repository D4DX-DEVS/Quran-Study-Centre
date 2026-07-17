import React, { useEffect, useState } from "react";
import styled from "styled-components";
import withLayout from "../../layout";
import { getData } from "../../../../backend/api";
import Header from "../Header";
import Footer from "../footer/footer";

const CDN = import.meta.env.VITE_APP_CDN || "";

const HeroSection = styled.section`
  padding: 40px 20px 48px;
  background: linear-gradient(135deg, rgba(29, 78, 216, 0.08), rgba(59, 111, 240, 0.04));
  border-radius: 28px;
  margin: 0 auto 48px;
`;

const Breadcrumb = styled.div`
  font-family: "Manrope", sans-serif;
  font-size: 13px;
  color: #5b6b85;
  margin-bottom: 18px;

  a {
    color: #5b6b85;
    text-decoration: none;
  }
  a:hover {
    color: #1d4ed8;
  }
`;

const Eyebrow = styled.span`
  display: inline-block;
  font-family: "Manrope", sans-serif;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #1d4ed8;
  margin-bottom: 10px;
`;

const HeroTitle = styled.h1`
  font-family: "Fraunces", serif;
  font-size: clamp(2rem, 4vw, 2.9rem);
  font-weight: 700;
  color: #0f2743;
  margin: 0 0 14px;
`;

const HeroDescription = styled.p`
  font-family: "Manrope", sans-serif;
  font-size: 15px;
  line-height: 1.7;
  color: #4d607f;
  max-width: 560px;
  margin: 0;
`;

const SectionWrap = styled.section`
  margin: 0 auto 56px;
`;

const SectionHead = styled.div`
  text-align: center;
  margin-bottom: 32px;
`;

const SectionEyebrow = styled.span`
  display: block;
  font-family: "Manrope", sans-serif;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #1d4ed8;
  margin-bottom: 8px;
`;

const SectionTitle = styled.h2`
  font-family: "Fraunces", serif;
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: 700;
  color: #0f2743;
  margin: 0;

  &::after {
    content: "";
    display: block;
    width: 56px;
    height: 3px;
    background: linear-gradient(90deg, #1d4ed8, #3b6ff0);
    margin: 14px auto 0;
    border-radius: 4px;
  }
`;

const StateGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const StateCard = styled.div`
  background: #ffffff;
  border-radius: 20px;
  box-shadow: 0 4px 24px rgba(26, 73, 147, 0.08);
  padding: 32px 24px;
  text-align: center;
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 16px 36px rgba(26, 73, 147, 0.16);
  }
`;

const StatePhoto = styled.div`
  width: 96px;
  height: 96px;
  border-radius: 50%;
  margin: 0 auto 18px;
  overflow: hidden;
  background: #eef3fc;
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const StateName = styled.div`
  font-family: "Fraunces", serif;
  font-size: 18px;
  font-weight: 700;
  color: #0f2743;
  margin-bottom: 4px;
`;

const StatePosition = styled.div`
  font-family: "Manrope", sans-serif;
  font-size: 13px;
  font-weight: 700;
  color: #1d4ed8;
`;

const CoordGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 18px;

  @media (max-width: 1100px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  @media (max-width: 700px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  @media (max-width: 460px) {
    grid-template-columns: 1fr;
  }
`;

const CoordCard = styled.div`
  background: #ffffff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 18px rgba(26, 73, 147, 0.08);
`;

const CoordHeader = styled.div`
  background: linear-gradient(135deg, #1d4ed8, #1e3a8a);
  color: #ffffff;
  font-family: "Manrope", sans-serif;
  font-size: 14px;
  font-weight: 800;
  padding: 12px 14px;
`;

const CoordBody = styled.div`
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const CoordRow = styled.div`
  font-family: "Manrope", sans-serif;

  .coord-name {
    font-size: 13px;
    font-weight: 700;
    color: #0f2743;
  }
  .coord-phone {
    font-size: 12px;
    color: #6b7d9e;
    margin-top: 2px;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 32px;
  color: #6b7d9e;
  font-family: "Manrope", sans-serif;
  font-size: 14px;
  background: #ffffff;
  border-radius: 16px;
  border: 1px dashed #d4ddeb;
`;

const STATE_ROLES = [
  { key: "director", fallback: "Director" },
  { key: "coordinator1", fallback: "Coordinator" },
  { key: "coordinator2", fallback: "Coordinator" },
];

const Leadership = (props) => {
  const [stateLeadership, setStateLeadership] = useState({});
  const [districts, setDistricts] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [stateRes, districtRes, areaRes] = await Promise.all([
        getData({}, "leadership/state"),
        getData({ skip: 0, limit: 500 }, "leadership/districts"),
        getData({ skip: 0, limit: 500 }, "leadership/areas"),
      ]);
      if (cancelled) return;
      setStateLeadership(stateRes?.data?.response || {});
      setDistricts(districtRes?.data?.response || []);
      setAreas(areaRes?.data?.response || []);
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const stateCards = STATE_ROLES.map((role) => stateLeadership[role.key]).filter((person) => person && (person.name || person.photo));

  return (
    <>
      <Header {...props} />
      <main className="landing-home">
        <div className="landing-page-shell">
          <HeroSection>
            <Breadcrumb>
              <a href="/">Home</a> &gt; Leadership
            </Breadcrumb>
            <Eyebrow>Leadership</Eyebrow>
            <HeroTitle>Our Leadership</HeroTitle>
            <HeroDescription>
              Dedicated individuals working together to spread Quranic knowledge and build a community of learners.
            </HeroDescription>
          </HeroSection>

          {loading ? (
            <EmptyState>Loading leadership details…</EmptyState>
          ) : (
            <>
              <SectionWrap>
                <SectionHead>
                  <SectionEyebrow>State Leaders</SectionEyebrow>
                  <SectionTitle>State Leadership</SectionTitle>
                </SectionHead>
                {stateCards.length === 0 ? (
                  <EmptyState>State leadership details will be published soon.</EmptyState>
                ) : (
                  <StateGrid>
                    {stateCards.map((person, index) => (
                      <StateCard key={index}>
                        <StatePhoto>
                          {person.photo ? <img src={`${CDN}${person.photo}`} alt={person.name} /> : null}
                        </StatePhoto>
                        <StateName>{person.name}</StateName>
                        <StatePosition>{person.position}</StatePosition>
                      </StateCard>
                    ))}
                  </StateGrid>
                )}
              </SectionWrap>

              <SectionWrap>
                <SectionHead>
                  <SectionEyebrow>District Co-ordinators</SectionEyebrow>
                  <SectionTitle>District Co-ordinators</SectionTitle>
                </SectionHead>
                {districts.length === 0 ? (
                  <EmptyState>No district coordinators added yet.</EmptyState>
                ) : (
                  <CoordGrid>
                    {districts.map((district) => (
                      <CoordCard key={district._id}>
                        <CoordHeader>{district.districtName}</CoordHeader>
                        <CoordBody>
                          <CoordRow>
                            <div className="coord-name">{district.coordinator1?.name || "—"}</div>
                            <div className="coord-phone">{district.coordinator1?.phone || "—"}</div>
                          </CoordRow>
                          <CoordRow>
                            <div className="coord-name">{district.coordinator2?.name || "—"}</div>
                            <div className="coord-phone">{district.coordinator2?.phone || "—"}</div>
                          </CoordRow>
                        </CoordBody>
                      </CoordCard>
                    ))}
                  </CoordGrid>
                )}
              </SectionWrap>

              <SectionWrap>
                <SectionHead>
                  <SectionEyebrow>Area Co-ordinators</SectionEyebrow>
                  <SectionTitle>Area Co-ordinators</SectionTitle>
                </SectionHead>
                {areas.length === 0 ? (
                  <EmptyState>No area coordinators added yet.</EmptyState>
                ) : (
                  <CoordGrid>
                    {areas.map((area) => (
                      <CoordCard key={area._id}>
                        <CoordHeader>{area.areaName}</CoordHeader>
                        <CoordBody>
                          <CoordRow>
                            <div className="coord-name">{area.coordinator1?.name || "—"}</div>
                            <div className="coord-phone">{area.coordinator1?.phone || "—"}</div>
                          </CoordRow>
                          <CoordRow>
                            <div className="coord-name">{area.coordinator2?.name || "—"}</div>
                            <div className="coord-phone">{area.coordinator2?.phone || "—"}</div>
                          </CoordRow>
                        </CoordBody>
                      </CoordCard>
                    ))}
                  </CoordGrid>
                )}
              </SectionWrap>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
};

export default withLayout(Leadership);
