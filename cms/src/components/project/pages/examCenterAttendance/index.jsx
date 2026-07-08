import React, { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import Layout from "../../../core/layout";
import ListTable from "../../../core/list/list";
import { Container } from "../../../core/layout/styels";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { getData } from "../../../../backend/api";
import jsPDF from "jspdf";
import "jspdf-autotable";

const ExamCenterAttendance = (props) => {
  // Any user scoped to a single district gets a locked district filter — no
  // dropdown, no other districts visible. Same pattern as examRegistration/index.jsx.
  const loggedInUser = useSelector((state) => state.login?.data?.user) || {};
  const adminDistrictId = loggedInUser?.districts?._id || loggedInUser?.districts || "";
  const isDistrictAdmin = Boolean(adminDistrictId);

  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedArea, setSelectedArea] = useState("");

  useEffect(() => {
    document.title = `Exam Center Attendance - QSC Automation`;
  }, []);

  // Export dataset (whole-district fetch + populate) is heavy, so it's only
  // pulled on-demand when Download is clicked — not on every filter change —
  // to avoid stacking a second expensive query on top of the table's own
  // paginated fetch every time district/area is picked.
  const fetchData = async (districtId) => {
    const response = await getData({ district: districtId }, "exam-registration/attendance-sheet");
    if (response?.data?.success) {
      return response.data.response;
    }
    return null;
  };

  // The separate top-of-page district picker was removed — the table's own
  // District filter (below) is now the single source of truth.
  const currentFilterRef = useRef({});
  const handleFilterChange = (filter) => {
    currentFilterRef.current = filter || {};
    setSelectedDistrict(filter?.district || "");
    setSelectedArea(filter?.area || "");
  };

  const groupDataByDistrictAreaCenter = (data) => {
    const grouped = {};
    data.forEach((item) => {
      let district, area, center;

      // Group by the student's home study centre (centerRegistration).
      // This is the primary grouping key so that each attendance sheet
      // corresponds to a study centre, not the allocated exam centre.
      // Fall back to assignedExamCenter for records that have no
      // centerRegistration populated, and then to legacy fields.
      if (item.centerRegistration && item.centerRegistration.nameOfCenter) {
        district = item.district?.district || "Unknown District";
        area = item.area?.area || "Unknown Area";
        center = item.centerRegistration.nameOfCenter;
      } else if (item.assignedExamCenter && item.assignedExamCenter.nameOfCenter) {
        district = item.district?.district || "Unknown District";
        area = item.area?.area || "Unknown Area";
        center = item.assignedExamCenter.nameOfCenter;
      } else if (item.outsideExamCenter && item.outsideExamCenter.centerName) {
        district = item.examDistrict?.district || "Unknown District";
        area = "Unknown Area";
        center = item.outsideExamCenter.centerName;
      } else if (item.examCenter && item.examCenter.centerName) {
        district = item.district?.district || "Unknown District";
        area = item.area?.area || "Unknown Area";
        center = item.examCenter.centerName;
      } else {
        district = "Unknown District";
        area = "Unknown Area";
        center = "Unknown Center";
      }

      if (!grouped[district]) grouped[district] = {};
      if (!grouped[district][area]) grouped[district][area] = {};
      if (!grouped[district][area][center]) grouped[district][area][center] = [];

      grouped[district][area][center].push({
        regno: item.regno,
        nameOfApplicant: item.nameOfApplicant,
        examName: item.nameOfExamAppearingNow?.examType?.split(":")[0]?.trim() || "",
        gender: item.gender || "Unknown",
        status: item.status || "", // Private / Regular — Phase 2.5
      });
    });

    // Now sort each center's array by regno and assign S.No
    Object.keys(grouped).forEach((district) => {
      Object.keys(grouped[district]).forEach((area) => {
        Object.keys(grouped[district][area]).forEach((center) => {
          grouped[district][area][center] = grouped[district][area][center]
            .sort((a, b) => {
              const numA = parseInt(a.regno?.replace(/\D/g, ""), 10);
              const numB = parseInt(b.regno?.replace(/\D/g, ""), 10);
              if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
              return (a.regno || "").localeCompare(b.regno || "");
            })
            .map((row, idx) => ({
              "S.No": idx + 1,
              "Exam Name": row.examName,
              "Reg No": row.regno,
              "Name Of Applicant": row.nameOfApplicant,
              Gender: row.gender,
              "P/R": row.status ? row.status.charAt(0).toUpperCase() : "", // Phase 2.5
              Signature: " ",
              Remarks: " ",
            }));
        });
      });
    });
    return grouped;
  };

  // Row order within an exam+gender group: mode of study (Private/Regular)
  // first, then reg no. Mirrors the exam center attendance list's sort:
  // exam name -> gender -> mode of study -> reg no -> name.
  const sortByStatusThenRegno = (arr) =>
    [...arr].sort((a, b) => {
      const statusCompare = (a["P/R"] || "").localeCompare(b["P/R"] || "");
      if (statusCompare !== 0) return statusCompare;
      const numA = parseInt((a["Reg No"] || "").replace(/\D/g, ""), 10);
      const numB = parseInt((b["Reg No"] || "").replace(/\D/g, ""), 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return (a["Reg No"] || "").localeCompare(b["Reg No"] || "");
    });

  const generateExcelFile = (data, examCenter) => {
    const sanitizeSheetName = (name) => {
      return name.replace(/[:\\/?*[\]]/g, "").substring(0, 31);
    };

    if (!data || !Array.isArray(data) || data.length === 0) {
      return null;
    }

    try {
      // Group data by Exam Name first, then by Gender
      const groupedByExam = data.reduce((acc, item) => {
        const exam = item["Exam Name"] || "Unknown Exam";
        const gender = item["Gender"] || "Unknown";

        if (!acc[exam]) acc[exam] = {};
        if (!acc[exam][gender]) acc[exam][gender] = [];

        acc[exam][gender].push(item);
        return acc;
      }, {});

      const preferredOrder = ["Preliminary I", "Preliminary II", "Secondary II New", "Secondary II Old", "Preliminary III"];

      let sortedData = [];

      // Process exams in preferred order
      preferredOrder.forEach((examName) => {
        const examData = groupedByExam[examName];
        if (!examData) return;

        // Add male students first
        if (examData["Male"] && examData["Male"].length > 0) {
          sortByStatusThenRegno(examData["Male"]).forEach((item, index) => {
            sortedData.push({
              ...item,
              "S.No": sortedData.length + 1,
            });
          });
        }

        // Add female students second
        if (examData["Female"] && examData["Female"].length > 0) {
          sortByStatusThenRegno(examData["Female"]).forEach((item, index) => {
            sortedData.push({
              ...item,
              "S.No": sortedData.length + 1,
            });
          });
        }

        // Add other gender students if any
        Object.keys(examData).forEach((gender) => {
          if (gender !== "Male" && gender !== "Female" && examData[gender].length > 0) {
            sortByStatusThenRegno(examData[gender]).forEach((item, index) => {
              sortedData.push({
                ...item,
                "S.No": sortedData.length + 1,
              });
            });
          }
        });

        delete groupedByExam[examName];
      });

      // Process remaining exams in alphabetical order
      Object.keys(groupedByExam)
        .sort()
        .forEach((examName) => {
          const examData = groupedByExam[examName];
          if (!examData) return;

          // Add male students first
          if (examData["Male"] && examData["Male"].length > 0) {
            examData["Male"].forEach((item, index) => {
              sortedData.push({
                ...item,
                "S.No": sortedData.length + 1,
              });
            });
          }

          // Add female students second
          if (examData["Female"] && examData["Female"].length > 0) {
            examData["Female"].forEach((item, index) => {
              sortedData.push({
                ...item,
                "S.No": sortedData.length + 1,
              });
            });
          }

          // Add other gender students if any
          Object.keys(examData).forEach((gender) => {
            if (gender !== "Male" && gender !== "Female" && examData[gender].length > 0) {
              examData[gender].forEach((item, index) => {
                sortedData.push({
                  ...item,
                  "S.No": sortedData.length + 1,
                });
              });
            }
          });
        });

      const ws = XLSX.utils.json_to_sheet(sortedData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(examCenter || "Attendance"));
      return XLSX.write(wb, { type: "array", bookType: "xlsx" });
    } catch (error) {
      return null;
    }
  };

  // Inside your generatePdfFile function, replace the previous version with:

  const generatePdfFile = (data, examCenter) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(14);
    doc.text(`Attendance Sheet - ${examCenter}`, pageWidth / 2, 15, { align: "center" });

    const preferredOrder = ["Preliminary I", "Preliminary II", "Secondary II New", "Secondary II Old", "Preliminary III"];

    // Group data by Exam Name first, then by Gender
    const groupedByExam = data.reduce((acc, item) => {
      const exam = item["Exam Name"] || "Unknown Exam";
      const gender = item["Gender"] || "Unknown";

      if (!acc[exam]) acc[exam] = {};
      if (!acc[exam][gender]) acc[exam][gender] = [];

      acc[exam][gender].push(item);
      return acc;
    }, {});

    let currentY = 25;
    const summaryCounts = {};

    const renderExamTable = (examName, examData) => {
      doc.setFontSize(12);
      doc.text(examName, pageWidth / 2, currentY, { align: "center" });

      let allTableData = [];
      let maleCount = 0;
      let femaleCount = 0;

      // Add male students first
      if (examData["Male"] && examData["Male"].length > 0) {
        maleCount = examData["Male"].length;
        sortByStatusThenRegno(examData["Male"]).forEach((item, index) => {
          allTableData.push([allTableData.length + 1, item["Name Of Applicant"], item["Reg No"], item["Exam Name"], item["Gender"], item["P/R"] || "", "", ""]);
        });
      }

      // Add female students second
      if (examData["Female"] && examData["Female"].length > 0) {
        femaleCount = examData["Female"].length;
        sortByStatusThenRegno(examData["Female"]).forEach((item, index) => {
          allTableData.push([allTableData.length + 1, item["Name Of Applicant"], item["Reg No"], item["Exam Name"], item["Gender"], item["P/R"] || "", "", ""]);
        });
      }

      // Add other gender students if any
      Object.keys(examData).forEach((gender) => {
        if (gender !== "Male" && gender !== "Female" && examData[gender].length > 0) {
          sortByStatusThenRegno(examData[gender]).forEach((item, index) => {
            allTableData.push([allTableData.length + 1, item["Name Of Applicant"], item["Reg No"], item["Exam Name"], item["Gender"], item["P/R"] || "", "", ""]);
          });
        }
      });

      if (allTableData.length > 0) {
        doc.autoTable({
          startY: currentY + 5,
          head: [["Sl No", "Name", "Register Number", "Name of Examination", "Gender", "P/R", "Signature", "Remarks"]],
          body: allTableData,
          styles: {
            fontSize: 10,
            halign: "left",
            valign: "middle",
            cellPadding: 3,
            lineColor: 0,
            lineWidth: 0.3,
            textColor: 0,
          },
          headStyles: {
            fillColor: [255, 255, 255],
            textColor: 0,
            fontStyle: "bold",
            halign: "center",
          },
          tableLineColor: 0,
          tableLineWidth: 0.3,
          theme: "grid",
          margin: { left: 14, right: 14 },
        });

        currentY = doc.lastAutoTable.finalY + 10;
        summaryCounts[examName] = {
          total: allTableData.length,
          male: maleCount,
          female: femaleCount,
          private: allTableData.filter((r) => r[5] === "P").length,
          regular: allTableData.filter((r) => r[5] === "R").length,
        };
      }
    };

    // Render exam groups in preferred order
    preferredOrder.forEach((examName) => {
      const examData = groupedByExam[examName];
      if (!examData) return;
      renderExamTable(examName, examData);
      delete groupedByExam[examName];
    });

    // Process remaining exams in alphabetical order
    Object.keys(groupedByExam)
      .sort()
      .forEach((examName) => {
        const examData = groupedByExam[examName];
        if (!examData) return;
        renderExamTable(examName, examData);
      });

    // Add Summary Table — Phase 2.3: per exam-type final counts
    doc.setFontSize(12);
    doc.text("Summary of Students", pageWidth / 2, currentY, { align: "center" });

    const summaryBody = Object.entries(summaryCounts).map(([key, v]) => [
      key,
      v.total,
      v.male || 0,
      v.female || 0,
      v.private || 0,
      v.regular || 0,
    ]);
    const totals = Object.values(summaryCounts).reduce(
      (acc, v) => ({
        total: acc.total + v.total,
        male: acc.male + (v.male || 0),
        female: acc.female + (v.female || 0),
        private: acc.private + (v.private || 0),
        regular: acc.regular + (v.regular || 0),
      }),
      { total: 0, male: 0, female: 0, private: 0, regular: 0 }
    );
    summaryBody.push(["Total", totals.total, totals.male, totals.female, totals.private, totals.regular]);

    doc.autoTable({
      startY: currentY + 5,
      head: [["Exam Category", "Total", "Male", "Female", "Private", "Regular"]],
      body: summaryBody,
      styles: {
        fontSize: 10,
        halign: "left",
        cellPadding: 3,
        lineColor: 0,
        lineWidth: 0.3,
        textColor: 0,
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: 0,
        fontStyle: "bold",
        halign: "center",
      },
      tableLineColor: 0,
      tableLineWidth: 0.3,
      columnStyles: {
        1: { halign: "center" },
        2: { halign: "center" },
        3: { halign: "center" },
        4: { halign: "center" },
        5: { halign: "center" },
      },
      margin: { left: 14, right: 14 },
    });

    // Add Invigilator Signature at the end
    doc.setFontSize(10);
    doc.text("Name and Signature of Chief Invigilator", 14, doc.lastAutoTable.finalY + 10);

    return doc.output("arraybuffer");
  };

  const downloadDistrictWiseData = async () => {
    if (!selectedDistrict) {
      props.setMessage({
        type: 1,
        content: "Please select a district first",
        proceed: "Okay",
      });
      return;
    }

    setLoading(true);

    try {
      const data = await fetchData(selectedDistrict);
      if (!data || data.length === 0) {
        props.setMessage({
          type: 1,
          content: "No attendance data found for the selected district",
          proceed: "Okay",
        });
        setLoading(false);
        return;
      }
      setAttendanceData(data);

      const zip = new JSZip();

      // Filter data to only include the selected district, and (if picked)
      // the selected area. With the study-centre-as-exam-centre model,
      // `item.district` is the student's home district (= exam district).
      // Legacy outside-centre records may still carry `examDistrict`.
      const filteredData = data.filter((item) => {
        const districtMatch = item.district?._id ? item.district._id === selectedDistrict : item.examDistrict?._id === selectedDistrict;
        if (!districtMatch) return false;
        if (selectedArea) return item.area?._id === selectedArea;
        return true;
      });

      const groupedData = groupDataByDistrictAreaCenter(filteredData);

      // Get the only district key from groupedData (since we filtered for one district)
      const districtKey = Object.keys(groupedData)[0];
      if (!districtKey) {
        props.setMessage({
          type: 1,
          content: "No attendance data found for the selected district",
          proceed: "Okay",
        });
        setLoading(false);
        return;
      }

      const areasInDistrict = groupedData[districtKey];
      // When an area filter is active, the data is already scoped to a single
      // area — skip the redundant district wrapper and zip that area folder
      // directly. Without an area filter, zip the whole district with one
      // sub-folder per area.
      const areaKey = selectedArea ? Object.keys(areasInDistrict)[0] : null;
      const rootFolder = areaKey ? zip.folder(areaKey) : zip.folder(districtKey);

      const writeCenterFiles = (folder, centerName, data) => {
        const excelBuffer = generateExcelFile(data, centerName);
        const pdfBuffer = generatePdfFile(data, centerName);

        const centerFolder = folder.folder(centerName);
        if (excelBuffer) {
          centerFolder.file(`${centerName}.xlsx`, excelBuffer);
        }
        if (pdfBuffer) {
          centerFolder.file(`${centerName}.pdf`, pdfBuffer);
        }
      };

      if (areaKey) {
        Object.entries(areasInDistrict[areaKey]).forEach(([centerName, data]) => {
          writeCenterFiles(rootFolder, centerName, data);
        });
      } else {
        Object.entries(areasInDistrict).forEach(([area, centers]) => {
          const areaFolder = rootFolder.folder(area);
          Object.entries(centers).forEach(([centerName, data]) => {
            writeCenterFiles(areaFolder, centerName, data);
          });
        });
      }

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `Attendance Sheet - ${areaKey || districtKey}.zip`);
    } catch (error) {
      console.error("Error generating zip:", error);
      props.setMessage({
        type: 1,
        content: `Error generating attendance sheet: ${error.message}`,
        proceed: "Okay",
      });
    } finally {
      setLoading(false);
    }
  };

  // Column order mirrors the requested attendance-session layout: Reg No, Name,
  // District, Area, Exam Center, Exam Name, Mode of Study. Row order (district ->
  // area -> exam center -> exam name -> gender -> mode of study -> reg no -> name)
  // is applied server-side in getExamRegistrationList, not by any of these `sort` flags.
  // Filters mirror the Exam Registration ("registered students") page: gender, exam
  // name, district, area, exam center, mode of study.
  const [attributes] = useState([
    {
      type: "text",
      name: "regno",
      label: "Reg No",
      tag: true,
      view: true,
      search: false,
    },
    {
      type: "text",
      name: "nameOfApplicant",
      label: "Name Of Applicant",
      tag: true,
      view: true,
      search: false,
    },
    {
      type: "select",
      apiType: "API",
      selectApi: "district/select",
      name: "district",
      label: "District",
      showItem: "district",
      default: "",
      tag: true,
      view: true,
      filter: true,
      search: false,
      // The single district selector for this page (also drives the zip/PDF
      // export) — the old separate top-of-page picker was removed.
      // District Admins get a locked, non-editable filter showing only their own district.
      disabled: isDistrictAdmin,
    },
    {
      type: "select",
      apiType: "API",
      selectApi: "area/get-area-by-district",
      updateOn: "district",
      name: "area",
      label: "Area",
      showItem: "area",
      default: "",
      tag: true,
      view: true,
      filter: true,
      search: false,
    },
    {
      type: "text",
      name: "examCenterName",
      label: "Exam Center",
      tag: true,
      view: true,
      search: false,
    },
    {
      type: "select",
      apiType: "API",
      selectApi: "center-registration/area",
      updateOn: "area",
      name: "centerRegistration",
      label: "Exam Center",
      showItem: "nameOfCenter",
      default: "",
      tag: false,
      view: false,
      filter: true,
      search: false,
    },
    {
      type: "text",
      name: "examName",
      label: "Exam Name",
      tag: true,
      view: true,
    },
    {
      type: "select",
      apiType: "API",
      selectApi: "exam-type/select",
      name: "nameOfExamAppearingNow",
      label: "Exam Name",
      showItem: "examType",
      default: "",
      tag: false,
      view: false,
      filter: true,
      search: false,
    },
    {
      type: "select",
      apiType: "CSV",
      selectApi: "Private,Regular",
      name: "status",
      label: "Mode of Study",
      default: "",
      tag: true,
      view: true,
      filter: true,
      search: false,
    },
    {
      type: "select",
      apiType: "CSV",
      selectApi: "Male,Female",
      name: "gender",
      label: "Gender",
      default: "",
      tag: false,
      view: false,
      filter: true,
      search: false,
    },
  ]);

  return (
    <Container className="noshadow">
      <div className="p-4 w-full">
        <div className="flex w-full justify-between items-center mb-6">
          <h6 className="text-2xl font-bold">Exam Center Attendance</h6>
          <div className="flex items-center gap-4">
            {props.exportPrivilege && (
              <button onClick={downloadDistrictWiseData} disabled={loading || !selectedDistrict} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                <Download size={16} />
                {loading ? "Generating..." : "Download"}
              </button>
            )}
          </div>
        </div>

        <ListTable
          api={`exam-registration/list`}
          itemTitle={{ name: "nameOfApplicant", type: "text" }}
          shortName="Exam Center Attendance"
          showTitle={false}
          formMode="double"
          surfaceTheme={"district"}
          onFilterChange={handleFilterChange}
          attributes={attributes}
          preFilter={isDistrictAdmin && adminDistrictId ? { district: adminDistrictId } : {}}
          {...props}
        />
      </div>
    </Container>
  );
};

export default Layout(ExamCenterAttendance);
