import React, { useEffect, useState } from "react";
import Layout from "../../../core/layout";
import ListTable from "../../../core/list/list";
import { Container } from "../../../core/layout/styels";
import { EXAM_CATEGORIES, MODEL_PAPER_KINDS } from "../../../public/landing/examCategories";
//src/components/styles/page/index.js
//if you want to write custom style wirte in above file

// Next year down to 2016 (the Question Bank's first year), so a model paper can
// be uploaded ahead of the coming exam.
const YEAR_OPTIONS = Array.from({ length: new Date().getFullYear() + 2 - 2016 }, (_, i) => new Date().getFullYear() + 1 - i).join(", ");

// Admin screen for the public "Model Question & Answer Key" section. Same list
// / upload mechanism as the Question Bank page, but a separate collection: a
// file added here only ever appears under Model Question & Answer Key.
const ModelQuestionPapers = (props) => {
  //to update the page title
  useEffect(() => {
    document.title = `Model Question & Answer Key - QSC Automation`;
  }, []);

  const [attributes] = useState([
    {
      type: "select",
      placeholder: "Exam",
      apiType: "CSV",
      selectApi: EXAM_CATEGORIES.map((category) => category.value).join(", "),
      name: "category",
      validation: "",
      default: "",
      label: "Exam",
      required: true,
      view: true,
      add: true,
      update: true,
      tag: true,
    },
    {
      type: "select",
      placeholder: "Year",
      apiType: "CSV",
      selectApi: YEAR_OPTIONS,
      name: "year",
      validation: "",
      default: "",
      label: "Year",
      required: true,
      view: true,
      add: true,
      update: true,
      tag: true,
    },
    {
      type: "select",
      placeholder: "Type",
      apiType: "CSV",
      selectApi: MODEL_PAPER_KINDS.join(", "),
      name: "kind",
      validation: "",
      default: "",
      label: "Type",
      required: true,
      view: true,
      add: true,
      update: true,
      tag: true,
    },
    {
      type: "file",
      placeholder: "PDF file",
      name: "attachment",
      validation: "",
      default: "",
      tag: false,
      label: "PDF file",
      showItem: "",
      required: true,
      view: true,
      add: true,
      update: true,
      allowedFileTypes: ["application/pdf"],
    },
  ]);

  return (
    <Container className="noshadow">
      <ListTable
        api={`model-question-papers`}
        itemTitle={{
          name: "category",
          type: "text",
          collection: "",
        }}
        shortName={`Model Question & Answer Key`}
        formMode={`single`}
        surfaceTheme={"district"}
        {...props}
        attributes={attributes}
      ></ListTable>
    </Container>
  );
};

export default Layout(ModelQuestionPapers);
