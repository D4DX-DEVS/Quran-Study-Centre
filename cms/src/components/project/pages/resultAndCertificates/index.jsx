import React, { useEffect, useState } from "react";
import Layout from "../../../core/layout";
import ListTable from "../../../core/list/list";
import { Container } from "../../../core/layout/styels";

//src/components/styles/page/index.js
//if you want to write custom style wirte in above file
const ResultAndCertificates = (props) => {
  //to update Certificatesthe page title
  useEffect(() => {
    document.title = `Results - QSC Automation`;
  }, []);

  const [attributes] = useState([
    {
      // Registration number of the linked student — read-only.
      type: "text",
      placeholder: "Registration number",
      name: "studentRegNo",
      validation: "",
      default: "",
      label: "Registration number",
      required: false,
      tag: true,
      view: true,
      add: false,
      update: false,
      export: true,
      collection: "student",
      showItem: "regno",
    },
    {
      // Name of the linked student — read-only.
      type: "text",
      placeholder: "Name",
      name: "student",
      validation: "",
      showItem: "nameOfApplicant",
      collection: "student",
      default: "",
      tag: true,
      label: "Name",
      required: false,
      view: true,
      add: false,
      update: false,
      export: true,
    },
    {
      type: "select",
      apiType: "API",
      selectApi: "exam-type/select",
      placeholder: "Name of Exam",
      name: "exam",
      validation: "",
      collection: "exam",
      showItem: "examType",
      search: true,
      default: "",
      tag: true,
      label: "Name of Exam",
      required: false,
      view: true,
      add: false,
      update: false,
      filter: true,
      export: true,
    },
    {
      type: "number",
      placeholder: "Score",
      name: "score",
      validation: "",
      default: "",
      label: "Score",
      tag: true,
      required: false,
      view: true,
      add: false,
      update: false,
      export: true,
    },
    {
      // Auto-computed server-side by calculateGrade() — same source as Mark Entry.
      type: "text",
      placeholder: "Grade",
      name: "grade",
      validation: "",
      default: "",
      label: "Grade",
      tag: true,
      required: false,
      view: true,
      add: false,
      update: false,
      export: true,
    },
  ]);

  return (
    <Container className="noshadow">
      <ListTable
        api={`exam-score`}
        itemTitle={{
          name: "nameOfApplicant",
          type: "text",
          collection: "student",
        }}
        shortName={`Result`}
        formMode={`single`}
        surfaceTheme={"district"}
        attributes={attributes}
        addPrivilege={false}
        delPrivilege={false}
        {...props}
      ></ListTable>
    </Container>
  );
};

export default Layout(ResultAndCertificates);
