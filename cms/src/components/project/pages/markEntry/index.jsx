import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Button, ElementContainer, TextBox } from "../../../core/elements";
import Layout from "../../../core/layout";
import styled from "styled-components";
import { getData, postData } from "../../../../backend/api"; // Assuming you have a postData function for posting data
import ListTable from "../../../core/list/list";
import { useToast } from "../../../core/toast";
//src/components/styles/page/index.js
//if you want to write custom style wirte in above file

const PageWrap = styled.div`
  margin-left: 30px;
  margin-top: 50px;
  @media (max-width: 768px) {
    margin-left: 0;
    padding: 0 16px;
  }
`;
const TextDiv = styled.div`
  display: flex;
  gap: 10px;
  width: 50%;
  @media (max-width: 768px) {
    width: 100%;
  }
`;
const ButtonDiv = styled.div`
  margin-top: 23px;
`;
const ExpandedRow = styled(TextDiv)`
  width: 50%;
  margin-bottom: 20px;
  & > div:first-child {
    flex: 1;
    min-width: 0;
  }
  @media (max-width: 768px) {
    width: 100%;
  }
`;
const ResultsWrap = styled.div`
  width: 50%;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  margin-bottom: 30px;
  max-height: 260px;
  overflow-y: auto;
  @media (max-width: 768px) {
    width: 100%;
  }
`;
const ResultsTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  th,
  td {
    text-align: left;
    padding: 8px 12px;
  }
  thead th {
    position: sticky;
    top: 0;
    background: #fafafa;
    border-bottom: 1px solid #e0e0e0;
  }
  tbody tr {
    border-bottom: 1px solid #f0f0f0;
  }
  tbody tr:last-child {
    border-bottom: none;
  }
  &.selectable tbody tr {
    cursor: pointer;
  }
  &.selectable tbody tr:hover {
    background: #f5f5f5;
  }
`;

const MarkEntry = (props) => {
  const toast = useToast();
  const navigate = useNavigate();
  //to update the page title
  useEffect(() => {
    document.title = `Mark Entry - QSC Automation`;
  }, []);
  const [regNo, setRegNo] = useState("");
  const [score, setScore] = useState("");
  const [name, setName] = useState("");
  const [exam, setExam] = useState("");
  const [student, setstudent] = useState("");
  const [selectedRegno, setSelectedRegno] = useState("");
  const [examName, setExamName] = useState("");
  const [matches, setMatches] = useState([]);
  const [searched, setSearched] = useState(false);

  // Any user scoped to a single district (mirrors the backend's own check in
  // examScore.js: `req.user.districts ? { student: { $in: districtStudentIds } } : {}`)
  // gets a locked district filter — no dropdown, no other districts visible.
  const loggedInUser = useSelector((state) => state.login?.data?.user) || {};
  const adminDistrictId = loggedInUser?.districts?._id || loggedInUser?.districts || "";
  const isDistrictAdmin = Boolean(adminDistrictId);

  const [attributes] = useState([

    {
      // Export-only SI number provided by API
      type: "number",
      placeholder: "Sl no",
      name: "slno",
      validation: "",
      default: "",
      label: "Sl no",
      required: false,
      tag: false,
      view: false,
      add: false,
      update: false,
      filter: false,
      export: true,
    },
    {
      // Registration number — shown in the list, and in the edit form as a disabled
      // (unclickable) field — update:true + disabled:true.
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
      update: true,
      disabled: true,
      export: true,
      collection: "student",
      showItem: "regno",
    },
    {
      // Name — shown in the list, and in the edit form as a plain disabled text field
      // (no select dropdown chrome) — update:true + disabled:true.
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
      update: true,
      disabled: true,
      export: true,
      filter: false,
    },
    {
      // Display-only: district of the linked student, shown in the list/export.
      // Not shown in the edit form (update:false).
      type: "text",
      placeholder: "District",
      name: "studentDistrictName",
      validation: "",
      default: "",
      label: "District",
      required: false,
      tag: true,
      view: true,
      add: false,
      update: false,
      filter: false,
      export: true,
      collection: "student",
      showItem: "district",
      showSubItem: "district",
      hideOnMobile: true,
    },
    {
      // Display-only: area of the linked student, shown in the list/export.
      // Not shown in the edit form (update:false).
      type: "text",
      placeholder: "Area",
      name: "studentAreaName",
      validation: "",
      default: "",
      label: "Area",
      required: false,
      tag: true,
      view: true,
      add: false,
      update: false,
      filter: false,
      export: true,
      collection: "student",
      showItem: "area",
      showSubItem: "area",
      hideOnMobile: true,
    },
    {
      // Filter-only district dropdown (top filter bar) — resolved server-side in getExamScore.
      // District Admins get a locked, non-editable filter pre-filled with their own district.
      type: "select",
      apiType: "API",
      selectApi: "district/select",
      placeholder: "District",
      updateOn: "",
      name: "district",
      validation: "",
      showItem: "district",
      search: true,
      default: isDistrictAdmin ? adminDistrictId : "",
      tag: true,
      label: "District",
      required: false,
      view: false,
      add: false,
      update: false,
      filter: true,
      disabled: isDistrictAdmin,
      export: false,
    },
    {
      // Filter-only area dropdown (top filter bar) — resolved server-side in getExamScore.
      type: "select",
      apiType: "API",
      selectApi: "area/get-area-by-district",
      placeholder: "Area",
      updateOn: "district",
      name: "area",
      validation: "",
      showItem: "area",
      search: true,
      default: "",
      tag: true,
      label: "Area",
      required: false,
      view: false,
      add: false,
      update: false,
      filter: true,
      export: false,
    },
    {
      // Filter-only exam center dropdown (top filter bar) — resolved server-side in
      // getExamScore via ExamRegistration.centerRegistration. Chains off the area filter
      // like the Registered Students / Hall Ticket pages do.
      type: "select",
      apiType: "API",
      selectApi: "center-registration/area",
      placeholder: "Exam Center",
      updateOn: "area",
      name: "centerRegistration",
      validation: "",
      showItem: "nameOfCenter",
      search: true,
      default: "",
      tag: true,
      label: "Exam Center",
      required: false,
      view: false,
      add: false,
      update: false,
      filter: true,
      export: false,
    },
    {
      // Filter-only gender dropdown (top filter bar) — resolved server-side in getExamScore
      // via ExamRegistration.gender.
      type: "select",
      apiType: "CSV",
      selectApi: "Male,Female",
      placeholder: "Gender",
      name: "gender",
      validation: "",
      default: "",
      tag: true,
      label: "Gender",
      required: false,
      view: false,
      add: false,
      update: false,
      filter: true,
      export: false,
    },
    {
      // Phase 2.5 — Private/Regular status from the linked exam registration (view/export only)
      // Phase 3 — also exposed as a filter; resolved server-side in getExamScore.
      type: "select",
      apiType: "CSV",
      selectApi: "Private,Regular",
      placeholder: "P / R",
      name: "studentStatus",
      validation: "",
      default: "",
      label: "P/R",
      required: false,
      tag: true,
      view: true,
      export: true,
      filter: true,
      collection: "student",
      showItem: "status",
      hideOnMobile: true,
    },
    {
      type: "select",
      apiType: "API",
      selectApi: "exam-type/select",
      placeholder: "Name of Exam",
      updateOn: "",
      name: "exam",
      validation: "",
      collection: "exam",
      showItem: "examType",
      search: true,
      default: "",
      tag: true,
      label: "Name of Exam",
      required: true,
      view: true,
      add: true,
      update: true,
      disabled: true,
      filter: true,
      export: true,
    },
    {
      type: "number",
      placeholder: "Mark",
      name: "score",
      validation: "",
      default: "",
      label: "Mark",
      tag: true,
      required: false,
      view: true,
      add: true,
      update: true,
      export: true,
    },
    {
      // Display-only: exam center of the linked student. Shown in the record's
      // "Details" view (view:true); kept out of the edit form (update:false) and
      // out of the main list/export (tag:false, export:false).
      type: "text",
      placeholder: "Exam Center",
      name: "studentExamCenterName",
      validation: "",
      default: "",
      label: "Exam Center",
      required: false,
      tag: false,
      view: true,
      add: false,
      update: false,
      filter: false,
      export: false,
      collection: "student",
      showItem: "centerRegistration",
      showSubItem: "nameOfCenter",
    },
    {
      // Grade isn't verified yet — hidden from the UI until later. Backend still
      // computes and stores it on submit (see addExamScore), this only hides display.
      type: "text",
      placeholder: "Grade",
      name: "grade",
      validation: "",
      default: "",
      label: "Grade",
      tag: false,
      required: false,
      view: false,
      add: false,
      update: false,
      export: false,
    },
  ]);

  const selectCandidate = (candidate, narrowTable = false) => {
    setName(candidate.nameOfApplicant);
    setstudent(candidate._id);
    setExam(candidate.nameOfExamAppearingNow?._id ?? "");
    setExamName(candidate.nameOfExamAppearingNow?.examType ?? "");
    setSelectedRegno(candidate.regno);
    if (narrowTable) {
      // Collapse the table down to just the picked student (shown, not clickable).
      setMatches([candidate]);
    }
  };

  const clearRegNo = () => {
    setRegNo("");
    setName("");
    setstudent("");
    setExam("");
    setExamName("");
    setSelectedRegno("");
    setMatches([]);
    setSearched(false);
  };

  const handleSearch = () => {
    setName("");
    setstudent("");
    setExam("");
    setExamName("");
    setSelectedRegno("");
    setMatches([]);
    setSearched(true);
    // Match registration numbers ENDING with the typed digits, e.g. typing "1001"
    // finds every regno ending in ...1001, not just an exact one.
    // Table always shows the matches; a single match also auto-fills the summary
    // line below. With multiple matches, clicking a row selects that candidate.
    getData({ regnoSuffix: regNo, limit: 0 }, "exam-registration").then((response) => {
      const results = response.data.response || [];
      setMatches(results);
      if (results.length === 1) {
        selectCandidate(results[0]);
      }
    });
  };

  const additionalButtons = isDistrictAdmin
    ? []
    : [
        {
          label: "Report",
          icon: "print",
          onClick: () => navigate("/mark-entry-report"),
        },
      ];

  const handleSubmit = () => {
    // Prepare the data to be sent to the backend
    const formData = {
      regNo,
      student,
      exam,
      score,
    };
    // postData never rejects — it always resolves, even on a failed request — so the
    // actual outcome has to be read from response.status/customMessage here.
    postData(formData, "exam-score").then((response) => {
      if (response.status === 200 || response.status === 201) {
        toast.success("Mark entered successfully!");
        window.location.reload();
      } else {
        toast.error(response.customMessage || response.data?.customMessage || "Something went wrong while submitting the mark.");
      }
    });
  };

  return (
    <ElementContainer
      className="dashboard"
      style={{
        display: "flex",
        flexDirection: "column",
        paddingTop: "0px",
        flexWrap: "nowrap",
      }}
    >
      <PageWrap>
        <h2 style={{ marginTop: "0px", marginBottom: "10px" }}>Student Mark Entry</h2>
        <ExpandedRow>
          <TextBox
            className="text-box"
            label="Enter Register Number"
            value={regNo}
            onChange={(value) => {
              console.log("Text Changed", value);
              setRegNo(value);
            }}
            onClear={clearRegNo}
          ></TextBox>
          <ButtonDiv>
            <Button
              className="btn-search"
              type={"secondary"}
              align="right"
              icon={"search"}
              ClickEvent={handleSearch}
              value="Search"
            ></Button>
          </ButtonDiv>
        </ExpandedRow>

        {matches.length > 0 && (
          <ResultsWrap>
            <ResultsTable className={matches.length > 1 ? "selectable" : ""}>
              <thead>
                <tr>
                  <th>Reg No</th>
                  <th>Name</th>
                  <th>Exam Name</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((candidate) => (
                  <tr key={candidate._id} onClick={matches.length > 1 ? () => selectCandidate(candidate, true) : undefined}>
                    <td>{candidate.regno}</td>
                    <td>{candidate.nameOfApplicant}</td>
                    <td>{candidate.nameOfExamAppearingNow?.examType ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </ResultsTable>
          </ResultsWrap>
        )}
        {searched && matches.length === 0 && !name && <p style={{ textAlign: "left", marginBottom: "10px", marginTop: "10px" }}>No matching registration number found.</p>}
        <ExpandedRow>
          <TextBox
            className="text-box"
            label="Enter Score"
            value={score}
            onChange={(value) => {
              console.log("Text Changed", value);
              setScore(value);
            }}
          ></TextBox>
          <ButtonDiv>
            <Button
              type={"secondary"}
              align="right"
              icon={"checked"}
              ClickEvent={handleSubmit} // Use handleSubmit function here
              value="Submit"
            ></Button>
          </ButtonDiv>
        </ExpandedRow>
      </PageWrap>
      <ListTable
        api={`exam-score`}
        itemTitle={{
          name: "nameOfApplicant",
          type: "text",
          collection: "student",
        }}
        shortName={`Exam Score`}
        formMode={`single`}
        surfaceTheme={"district"}
        // viewMode="table"
        mobileScrollTable={true}
        attributes={attributes}
        {...props}
        additionalButtons={additionalButtons}
        addPrivilege={false}
        delPrivilege={true}
        printPrivilege={false}
        preFilter={isDistrictAdmin && adminDistrictId ? { district: adminDistrictId } : {}}
      ></ListTable>
    </ElementContainer>
  );
};

export default Layout(MarkEntry);
