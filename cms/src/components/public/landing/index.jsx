import React from "react";
import Hero from "./Hero";
import withLayout from "../layout";
import Header from "./Header";
import Footer from "./footer/footer";
import { usePageSeo } from "../../../utils/seo";

//src/components/styles/page/index.js
//if you want to write custom style wirte in above file
const Landing = (props) => {
  usePageSeo({
    title: "Quran Study Centre Kerala (QSC) | ഖുർആൻ സ്റ്റഡി സെന്റർ കേരള",
    description: "Quran Study Centre Kerala (QSC) - Quran study programme with annual exams, syllabus, question bank, results and study centres across Kerala.",
  });

  return (
    <>
      <Header {...props} />
      <Hero {...props} />
      <Footer {...props} />
    </>
  );
};

export default withLayout(Landing);
