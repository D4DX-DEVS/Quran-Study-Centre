import React, { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import Layout from "../../../core/layout";
import ListTable from "../../../core/list/list";
import { Container } from "../../../core/layout/styels";
import { getData } from "../../../../backend/api";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { registerMalayalamFont, malayalamCellHooks } from "./malayalamFont";
//src/components/styles/page/index.js
//if you want to write custom style wirte in above file
const ExamRegistration = (props) => {
  //to update the page title
  useEffect(() => {
    document.title = `Exam Registration - QSC Automation`;
  }, []);

  // Any user scoped to a single district (mirrors the backend's own check in
  // examRegistration.js: `req.user.districts ? { district: req.user.districts } : {}`)
  // gets a locked district filter — no dropdown, no other districts visible.
  // Matched on the districts field itself, not the role name, so it can't drift
  // out of sync with whatever the backend actually enforces.
  const loggedInUser = useSelector((state) => state.login?.data) || {};
  const adminDistrictId = loggedInUser?.districts?._id || loggedInUser?.districts || "";
  const isDistrictAdmin = Boolean(adminDistrictId);

  const [verifyLoading, setVerifyLoading] = useState(false);
  // Tracks the current filter state from the ListTable so the download respects applied filters
  const currentFilterRef = useRef({});

  // Phase 2.4 — Registered students verification PDF.
  // Uses /exam-registration/registered-list which respects district scoping and active filters.
  const downloadVerificationPdf = async () => {
    if (verifyLoading) return;
    setVerifyLoading(true);
    try {
      // Pass current filters so only the visible (filtered) students are exported
      const activeFilter = currentFilterRef.current || {};
      const r = await getData({ ...activeFilter }, "exam-registration/registered-list");
      const rows = r?.data?.response || [];
      if (!rows.length) {
        props.setMessage?.({ type: 1, content: "No registered students to export.", proceed: "Okay" });
        return;
      }

      // Sorting logic is fixed and applies to every download regardless of the active filter
      // (all registrations, district-wise, area-wise, or exam-centre-wise): area, then exam
      // centre, then exam name, then gender. An area header row is inserted between areas when
      // more than one area is present in the export (e.g. district-wise downloads).
      const genderRank = (g) => (g === "Male" ? 0 : g === "Female" ? 1 : 2);
      const hasMultipleAreas = new Set(rows.map((r) => r.area).filter(Boolean)).size > 1;
      const hasMultipleCentres = new Set(rows.map((r) => r.examCentre).filter(Boolean)).size > 1;
      const hasMultipleExamTypes = new Set(rows.map((r) => r.examType).filter(Boolean)).size > 1;

      const sortedRows = [...rows].sort((a, b) => {
        const area = (a.area || "").localeCompare(b.area || "");
        if (area !== 0) return area;
        const centre = (a.examCentre || "").localeCompare(b.examCentre || "");
        if (centre !== 0) return centre;
        const exam = (a.examType || "").localeCompare(b.examType || "");
        if (exam !== 0) return exam;
        const gender = genderRank(a.gender) - genderRank(b.gender);
        if (gender !== 0) return gender;
        return (a.name || "").localeCompare(b.name || "");
      });

      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      // Load the Malayalam font into the DOM so Malayalam cells can be shaped
      // by the browser and embedded as images (jsPDF can't shape Indic scripts).
      await registerMalayalamFont();
      const malayalam = malayalamCellHooks(doc);
      const pageWidth = doc.internal.pageSize.getWidth();

      // Build a clean district label from the actual result rows
      const districtSet = new Set(rows.map((r) => r.district).filter(Boolean));
      const districtName = districtSet.size === 1 ? [...districtSet][0] : "All Districts";

      // Build a human-readable title based on the active filter — used for both the PDF
      // heading and the saved file name so they always match.
      // - No filter:            "All Registrations <year>"
      // - District filter:      "<district> Registration <year>"
      // - Area filter:          "<area> Registration <year>"
      // - Exam centre filter:   "<exam centre> Registrations <year>"
      const year = new Date().getFullYear();
      const areaSet = new Set(rows.map((r) => r.area).filter(Boolean));
      const areaName = areaSet.size === 1 ? [...areaSet][0] : null;
      // Use studyCentre (= centerRegistration.nameOfCenter), not examCentre
      // (assignedExamCenter-first) — studyCentre is the field the "Exam Center"
      // filter actually matches on, so it stays consistent even when a student's
      // exam-day venue (assignedExamCenter) differs from their chosen centre.
      const centreSet = new Set(rows.map((r) => r.studyCentre).filter(Boolean));
      const centreName = centreSet.size === 1 ? [...centreSet][0] : null;

      let title;
      let scopeName;
      if (activeFilter.centerRegistration && centreName) {
        title = `${centreName} Registrations ${year}`;
        scopeName = centreName;
      } else if (activeFilter.area && areaName) {
        title = `${areaName} Registration ${year}`;
        scopeName = areaName;
      } else if (activeFilter.district && districtSet.size === 1) {
        title = `${districtName} Registration ${year}`;
        scopeName = districtName;
      } else {
        title = `All Registrations ${year}`;
        scopeName = districtName;
      }

      const now = new Date();
      const today = now.toLocaleDateString("en-GB");
      const printedTime = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

      doc.setFontSize(14);
      doc.text(title, pageWidth / 2, 30, { align: "center" });
      doc.setFontSize(11);
      doc.text(`${scopeName}  |  Total: ${rows.length}  |  Printed: ${today} ${printedTime}`, pageWidth / 2, 48, {
        align: "center",
      });

      // Build table body, inserting a full-width header row whenever the group changes:
      // an area header when multiple areas are present (district-wise downloads); otherwise,
      // when there's only a single area (area-wise downloads), an exam centre header whenever
      // multiple exam centres are present; otherwise, when there's only a single area and a
      // single exam centre (exam-centre-wise downloads), an exam name header whenever multiple
      // exam names are present.
      const tableBody = [];
      let lastArea = null;
      let lastCentre = null;
      let lastExamType = null;
      let sl = 0;
      sortedRows.forEach((r) => {
        if (hasMultipleAreas && r.area !== lastArea) {
          tableBody.push([
            { content: r.area || "-", colSpan: 8, styles: { fontStyle: "bold", fillColor: [210, 210, 210], halign: "left" } },
          ]);
          lastArea = r.area;
          lastCentre = null;
          lastExamType = null;
        } else if (!hasMultipleAreas && hasMultipleCentres && r.examCentre !== lastCentre) {
          tableBody.push([
            { content: r.examCentre || "-", colSpan: 8, styles: { fontStyle: "bold", fillColor: [210, 210, 210], halign: "left" } },
          ]);
          lastCentre = r.examCentre;
          lastExamType = null;
        } else if (!hasMultipleAreas && !hasMultipleCentres && hasMultipleExamTypes && r.examType !== lastExamType) {
          tableBody.push([
            { content: r.examType || "-", colSpan: 8, styles: { fontStyle: "bold", fillColor: [210, 210, 210], halign: "left" } },
          ]);
          lastExamType = r.examType;
        }
        sl += 1;
        tableBody.push([
          sl,
          r.name,
          r.gender || "-",
          r.mobile,
          r.area || "-",
          r.status || "-",
          r.examCentre || "-",
          r.examType || "-",
        ]);
      });

      doc.autoTable({
        startY: 60,
        head: [["Sl", "Name", "Gender", "Mobile", "Area", "Private/Regular", "Exam Centre", "Exam"]],
        body: tableBody,
        styles: { fontSize: 8, cellPadding: 3, lineColor: 0, lineWidth: 0.2, textColor: 0 },
        headStyles: { fillColor: [230, 230, 230], textColor: 0, fontStyle: "bold" },
        didParseCell: malayalam.didParseCell,
        didDrawCell: malayalam.didDrawCell,
        theme: "grid",
        columnStyles: {
          0: { halign: "center", cellWidth: 26 },
          2: { halign: "center", cellWidth: 48 },
          5: { halign: "center", cellWidth: 60 },
        },
        didDrawPage: (d) => {
          doc.setFontSize(9);
          doc.text(`Page ${d.pageNumber}`, pageWidth - 40, doc.internal.pageSize.getHeight() - 12, {
            align: "right",
          });
        },
      });

      // Per-exam-type summary at the end.
      const byExam = rows.reduce((acc, r) => {
        const k = r.examType || "Unknown";
        acc[k] = acc[k] || { total: 0, male: 0, female: 0, private: 0, regular: 0 };
        acc[k].total += 1;
        if (r.gender === "Male") acc[k].male += 1;
        if (r.gender === "Female") acc[k].female += 1;
        if (r.status === "Private") acc[k].private += 1;
        if (r.status === "Regular") acc[k].regular += 1;
        return acc;
      }, {});
      const entries = Object.entries(byExam).sort((a, b) => a[0].localeCompare(b[0]));
      const totals = entries.reduce(
        (acc, [, v]) => ({
          total: acc.total + v.total,
          male: acc.male + v.male,
          female: acc.female + v.female,
          private: acc.private + v.private,
          regular: acc.regular + v.regular,
        }),
        { total: 0, male: 0, female: 0, private: 0, regular: 0 }
      );

      doc.addPage("landscape");
      doc.setFontSize(14);
      doc.text("Summary by Exam Type", pageWidth / 2, 30, { align: "center" });
      doc.autoTable({
        startY: 50,
        head: [["Exam Type", "Total", "Male", "Female", "Private", "Regular"]],
        body: [
          ...entries.map(([k, v]) => [k, v.total, v.male, v.female, v.private, v.regular]),
          ["Total", totals.total, totals.male, totals.female, totals.private, totals.regular],
        ],
        styles: { fontSize: 10, cellPadding: 4, lineColor: 0, lineWidth: 0.2 },
        headStyles: { fillColor: [230, 230, 230], textColor: 0, fontStyle: "bold" },
        didParseCell: malayalam.didParseCell,
        didDrawCell: malayalam.didDrawCell,
        theme: "grid",
        columnStyles: { 1: { halign: "center" }, 2: { halign: "center" }, 3: { halign: "center" }, 4: { halign: "center" }, 5: { halign: "center" } },
      });

      const filename = `${title}.pdf`;
      doc.save(filename);
    } catch (e) {
      console.error(e);
      props.setMessage?.({
        type: 1,
        content: e?.response?.data?.message || e.message || "Failed to generate verification PDF.",
        proceed: "Okay",
      });
    } finally {
      setVerifyLoading(false);
    }
  };

  const additionalButtons = [
    {
      label: verifyLoading ? "Generating..." : "Verification PDF",
      icon: "print",
      onClick: downloadVerificationPdf,
    },
  ];

  const [attributes] = useState([
    {
      type: "title",
      title: "Basic Information",
      add: true,
      export: false,
    },
    {
      type: "text",
      placeholder: "Name Of Applicant",
      name: "nameOfApplicant",
      validation: "",
      default: "",
      label: "Name Of Applicant",
      tag: true,
      required: true,
      view: true,
      add: true,
      update: true,
      customClass: "full",
    },
    {
      type: "select",
      placeholder: "Gender",
      name: "gender",
      validation: "",
      default: "",
      tag: false,
      label: "Gender",
      showItem: "Gender",
      required: true,
      view: true,
      filter: true,
      add: true,
      update: true,
      apiType: "CSV",
      selectApi: "Male,Female",
    },
    {
      type: "info",
      content: "നിങ്ങളുടെ 10 അക്ക മൊബൈൽ നമ്പർ ടൈപ്പ് ചെയ്യുക,ഹാൾ ടിക്കറ്റ് ഡൗൺലോഡ് ചെയ്യുന്ന സമയത്ത് നൽകേണ്ടതിനാൽ ഈ നമ്പർ നോട്ട് ചെയ്തു വെക്കുക. (ഒരാൾ നൽകിയ മൊബൈൽ നമ്പർ പിന്നീട് മറ്റൊരാൾക്ക് നൽകാൻ കഴിയുന്നതല്ല.)",
      add: true,
      update: true,
      export: false,
    },
    {
      type: "number",
      placeholder: "Mobile Number",
      name: "mobileNumber",
      validation: "",
      default: "",
      label: "Mobile Number",
      tag: true,
      required: true,
      view: true,
      add: true,
      update: true,
    },
    {
      type: "number",
      placeholder: "Whatsapp Number",
      name: "whatsappNumber",
      validation: "",
      default: "",
      label: "Whatsapp Number",
      tag: false,
      required: true,
      add: true,
      view: true,
      update: true,
    },
    {
      type: "textarea",
      placeholder: "Address",
      name: "address",
      validation: "",
      default: "",
      label: "Address",
      tag: false,
      required: true,
      add: true,
      view: true,
      update: true,
    },
    {
      type: "number",
      placeholder: "Age",
      name: "age",
      validation: "",
      default: "",
      label: "Age",
      tag: false,
      required: true,
      add: true,
      view: true,
    },
    {
      type: "title",
      title: "Qualification Details",
      add: true,
      export: false,
    },
    {
      type: "textarea",
      placeholder: "Educational Qualification",
      name: "educationalQualification",
      validation: "",
      default: "",
      label: "Educational Qualification",
      tag: true,
      required: true,
      add: true,
      view: true,
      update: true,
    },
    {
      type: "title",
      title: "Exam Details",
      add: true,
      export: false,
    },
    {
      type: "select",
      apiType: "API",
      selectApi: "exam-type/select",
      placeholder: "Name of Exam Appearing Now",
      updateOn: "",
      name: "nameOfExamAppearingNow",
      // collection: "nameOfExamAppearingNow",
      validation: "",
      showItem: "examType",
      search: false,
      default: "",
      tag: true,
      label: "Name of Exam Appearing Now",
      required: true,
      view: true,
      add: true,
      update: true,
      filter: true,
      export: true,
      customClass: "full",
    },
    {
      type: "info",
      content: "താങ്കൾ എഴുതുന്ന പരീക്ഷയുടെ പേര് തെരഞ്ഞെടുക്കുക",
      add: true,
      update: true,
      export: false,
    },
    {
      type: "select",
      apiType: "API",
      selectApi: "district/select",
      placeholder: "District",
      name: "district",
      // collection: "district",
      validation: "",
      showItem: "district",
      default: "",
      tag: true,
      label: "District",
      search: false,
      required: true,
      view: true,
      add: true,
      update: true,
      filter: true,
      // District Admins get a locked, non-editable filter showing only their own district.
      disabled: isDistrictAdmin,
      customClass: "full",
    },
    {
      type: "select",
      apiType: "API",
      selectApi: "area/get-area-by-district",
      placeholder: "Area",
      updateOn: "district",
      name: "area",
      // collection: "area",
      search: false,
      validation: "",
      showItem: "area",
      default: "",
      tag: true,
      label: "Area",
      required: true,
      view: true,
      add: true,
      update: true,
      filter: true,
    },
    {
      type: "info",
      content: "ഖുർആൻ സ്റ്റഡി സെന്റർ കേരളയിൽ അഫിലിയേറ്റ് ചെയ്തിട്ടുള്ള പ്രാദേശിക സെന്ററുകളിൽ പഠിക്കുന്നവർ Regular വിഭാഗത്തിലും അല്ലാത്തവർ Private വിഭാഗത്തിലും ഉൾപ്പെടുന്നു.(ഈ രണ്ട് വിഭാഗങ്ങളിലും വെവ്വേറെ ేറ്റ് ేറ്റ് റാങ്ക് ലിസ്റ്റ് പ്രസിദ്ധീകരിക്കുന്നതാണ്)",
      add: true,
      update: true,
      export: false,
    },
    {
      type: "select",
      placeholder: "Mode of Study",
      name: "status",
      validation: "",
      default: "",
      customClass: "full",
      tag: true,
      label: "Mode of Study",
      showItem: "",
      required: true,
      view: true,
      filter: true,
      add: true,
      update: true,
      apiType: "CSV",
      selectApi: "Private,Regular",
    },
    {
      type: "info",
      content: "റെഗുലർ സെന്ററുകളിൽ പഠിക്കുന്നവർ തങ്ങളുടെ സ്റ്റഡി സെന്റർ തന്നെയാണ് പരീക്ഷ കേന്ദ്രമായി തെരഞ്ഞെടുക്കേണ്ടത്.",
      add: true,
      update: true,
      customClass: "full",
      condition: {
        item: "status",
        if: "Regular",
        then: "enabled",
        else: "disabled",
      },
      export: false,
    },
    {
      type: "info",
      content: " താങ്കളുട ഏറ്റവും അടുത്തുള്ള സ്റ്റഡി സെന്റർ പരീക്ഷ കേന്ദ്രമായി തിരഞ്ഞെടുക്കുക.",
      add: true,
      update: true,
      customClass: "full",
      condition: {
        item: "status",
        if: "Private",
        then: "enabled",
        else: "disabled",
      },
      export: false,
    },
    {
      type: "select",
      apiType: "API",
      selectApi: "center-registration/area",
      placeholder: "Exam Center",
      customClass: "full",
      updateOn: "area",
      name: "centerRegistration",
      validation: "",
      showItem: "nameOfCenter",
      default: "",
      tag: false,
      label: "Exam Center",
      required: true,
      view: true,
      add: true,
      update: true,
      filter: true,
      search: false,
      export: true,
    },
    
    {
      type: "title",
      title: "Payment Information",
      add: true,
      export: false,
    },
    {
      type: "info",
      content: "രജിസ്ട്രേഷൻ അറിയിപ്പിൻ്റെ കൂടെയുള്ള പോസ്റ്ററിലെ QR കോഡിലേക്ക് പരീക്ഷാ ഫീസ് 100 രൂപ അയക്കുക. ഏത് നമ്പറിൽ നിന്നാണോ അയച്ചത് പ്രസ്തുത നമ്പർ ഇവിടെ നൽകുക.(ഒരു നമ്പറിൽ നിന്ന് ഒരുമിച്ച് അയക്കുന്നവർ എല്ലാവരും പ്രസ്തുത നമ്പർ ആണ് കൊടുക്കേണ്ടത്)",
      add: true,
      update: true,
      export: false,
    },
    {
      type: "number",
      placeholder: "Gpay Number",
      name: "feeDetails",
      validation: "",
      default: "",
      info: "രജിസ്ട്രേഷൻ അറിയിപ്പിൻ്റെ കൂടെയുള്ള പോസ്റ്ററിലെ QR കോഡിലേക്ക് പരീക്ഷാ ഫീസ് 100 രൂപ അയക്കുക. ഏത് നമ്പറിൽ നിന്നാണോ അയച്ചത് പ്രസ്തുത നമ്പർ ഇവിടെ നൽകുക.(ഒരു നമ്പറിൽ നിന്ന് ഒരുമിച്ച് അയക്കുന്നവർ എല്ലാവരും പ്രസ്തുത നമ്പർ ആണ് കൊടുക്കേണ്ടത്)",
      label: "Gpay Number",
      required: true,
      add: true,
      update: true,
      view: true,
      export: true,
    },
    {
      type: "text",
      placeholder: "Register Number",
      name: "regno",
      validation: "",
      default: "",
      label: "Register Number",
      required: false,
      add: false,
      update: true,
      view: true,
      export: true,
      search: true,
    },
  ]);

  return (
    <Container className="noshadow">
      <ListTable
        // actions={actions}
        api={`exam-registration`}
        itemTitle={{ name: "nameOfApplicant", type: "text", collection: "" }}
        shortName={`Exam Registration`}
        showTitle={false}
        formMode={`single`}
        surfaceTheme={"district"}
        preFilter={isDistrictAdmin && adminDistrictId ? { district: adminDistrictId } : {}}
        labels={[
          {
            key: "Male Students",
            title: "MALE STUDENTS",
            icon: "male",
            backgroundColor: "rgba(0, 200, 81, 0.15)", // Light green
            color: "#006B27", // Dark green
          },
          {
            key: "Female Students",
            title: "FEMALE STUDENTS",
            icon: "female",
            backgroundColor: "rgba(0, 122, 255, 0.15)", // Light blue
            color: "#004999", // Dark blue
          },
          {
            key: "Total Students",
            title: "TOTAL STUDENTS",
            icon: "total-center",
            backgroundColor: "rgba(88, 86, 214, 0.15)", // Light purple
            color: "#2B2A69", // Dark purple
          },
        ]}
        onFilterChange={(filter) => {
          currentFilterRef.current = filter;
        }}
        {...props}
        attributes={attributes}
        additionalButtons={additionalButtons}
      ></ListTable>
    </Container>
  );
};

export default Layout(ExamRegistration);
