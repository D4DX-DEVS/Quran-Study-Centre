import React, { useEffect, useState } from "react";
import styled from "styled-components";
import "./style.css";
import withLayout from "../../layout";
import { getData } from "../../../../backend/api";
import Header from "../Header";
import Footer from "../footer/footer";

const AboutSection = styled.section`
  margin: 0 auto;
  padding: 48px 20px 40px;
`;

const Card = styled.div`
  background: #ffffff;
  border-radius: 20px;
  box-shadow: 0 4px 24px rgba(26, 73, 147, 0.08);
  overflow: hidden;
  text-align: center;
`;

const ImageFrame = styled.div`
  img {
    display: block;
    width: 100%;
    height: 100px;
    object-fit: cover;
  }

  @media only screen and (max-width: 768px) {
    img {
      height: 80px;
    }
  }
`;

const CardBody = styled.div`
  padding: 32px 32px 40px;

  @media only screen and (max-width: 768px) {
    padding: 24px 20px 32px;
  }
`;

const Title = styled.h1`
  font-family: "Noto Sans Malayalam", sans-serif;
  font-size: clamp(1.7rem, 4vw, 2.6rem);
  color: #1a4993;
  font-weight: 700;
  letter-spacing: -0.02em;
  text-align: center;
  margin: 0 0 16px;

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

const Description = styled.div`
  font-family: "Noto Sans Malayalam", sans-serif;
  font-size: 16px;
  line-height: 1.6;
  color: #444444;
  text-align: justify;
  text-justify: inter-word;
  white-space: pre-line;
  word-break: normal;
  overflow-wrap: anywhere;

  p {
    margin: 0 0 0px;
  }
  p:last-child {
    margin-bottom: 0;
  }

  @media only screen and (max-width: 600px) {
    text-align: left;
  }
`;

const CDN = import.meta.env.VITE_APP_CDN || "";

const About = (props) => {
  const [title, setTitle] = useState("Quran Study Centre Kerala");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getData({}, "about-us")
      .then((res) => {
        const record = res.data.response[0];
        if (record) {
          setTitle(record.title || "Quran Study Centre Kerala");
          setDescription(record.description);
          setImage(record.image || "");
        }
      })
      .finally(() => setLoading(false));
  }, []);
  return (
    <>
    <Header {...props} />
    <main className="landing-home">
      <div className="landing-page-shell">
        <AboutSection>
          <Card>
            {loading ? (
              <CardBody>
                <p>Loading…</p>
              </CardBody>
            ) : (
              <>
            {image && (
              <ImageFrame>
                <img src={`${CDN}${image}`} alt={title} />
              </ImageFrame>
            )}
            <CardBody>
              <Title>{title}</Title>
              <Description dangerouslySetInnerHTML={{ __html: description }}></Description>
            </CardBody>
              </>
            )}
          </Card>
        </AboutSection>
      </div>
    </main>
    <Footer />
    </>
  );
};

export default withLayout(About);