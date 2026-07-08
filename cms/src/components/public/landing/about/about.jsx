import React, { useEffect, useState } from "react";
import styled from "styled-components";
import "./style.css";
import withLayout from "../../layout";
import { getData } from "../../../../backend/api";
import Header from "../Header";
import Footer from "../footer/footer";

const Title = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(1.6rem, 4vw, 2.5rem);
  color: #1a4993;
  padding: 10px;
  margin-top: 20px;
  font-weight: 100;
  text-align: center;
`;

const Description = styled.p`
  font-size: 14px;
  line-height: 26px;
  color: black;
  max-width: 100%;
  padding: 0;
`;

const ContainerBox = styled.div`
  background-color: #f5f7fa;
  padding: 0;
  display: flex;
  flex-direction: row;
  justify-content: space-evenly;
  flex-wrap: wrap;
  gap: 24px;

  @media only screen and (max-width: 768px) {
    flex-direction: column;
    align-items: center;
  }
`;

const About = (props) => {
  const [description, setDescription] = useState("");

  useEffect(() => {
    getData({}, "about-us").then((res) => {
      setDescription(res.data.response[0].description);
    });
  }, []);
  return (
    <>
    <Header {...props} />
    <main className="landing-home">
      <div className="landing-page-shell">
        <Title>Quran Study Centre Kerala</Title>
        <Description dangerouslySetInnerHTML={{ __html: description }}></Description>
        <ContainerBox>
          <div className="mission-text">
            <div className="mission-title">Our Vision</div>
            <p>
              The vision of the Quran Study Centre in Kerala is rooted in
              fostering a profound understanding and appreciation of the Quran's
              teachings within the community.
            </p>

            <div className="mission-title">Our Mission</div>
            <p>
              <ul className="blog-details-list mt-30">
                <li>
                  It envisions a society where the values of tolerance, respect,
                  and solidarity are deeply ingrained, fostering harmonious
                  coexistence and mutual understanding among people of diverse
                  backgrounds.
                </li>
                <li>
                  To create empowered and sensitized generation who could peer
                  into the keyhole of tomorrow to build a brave new world for
                  humanity with abiding Islamic ethos, justice and values.
                </li>
                <li>
                  To produce empowered men and women with firm faith in God,
                  capable of discharging their responsibilities rhythmically.
                </li>
                <li>
                  To contribute to the creation of a truly vibrant ideal
                  society.
                </li>
              </ul>
            </p>
          </div>
        </ContainerBox>
      </div>
    </main>
    <Footer />
    </>
  );
};

export default withLayout(About);