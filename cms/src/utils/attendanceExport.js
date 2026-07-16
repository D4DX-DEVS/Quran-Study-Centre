import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";

// Shared by examCenterAttendance/index.jsx (admin panel) and the public
// MaterialAccessGate (area-admin password gate) so both pages produce
// identical Excel/PDF attendance sheets from the same grouping logic.

export const groupDataByDistrictAreaCenter = (data) => {
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
            "Register number of the student": row.regno,
            "Name Of Applicant": row.nameOfApplicant,
            "Exam Name": row.examName,
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

// Row order within an exam+gender group: reg no only, matching the exam
// center attendance list's sort (exam name -> gender -> reg no -> name).
export const sortByStatusThenRegno = (arr) =>
  [...arr].sort((a, b) => {
    const numA = parseInt((a["Register number of the student"] || "").replace(/\D/g, ""), 10);
    const numB = parseInt((b["Register number of the student"] || "").replace(/\D/g, ""), 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return (a["Register number of the student"] || "").localeCompare(b["Register number of the student"] || "");
  });

export const generateExcelFile = (data, examCenter) => {
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

    const upperCased = sortedData.map((row) => {
      const out = {};
      Object.keys(row).forEach((key) => {
        out[key] = typeof row[key] === "string" ? row[key].toUpperCase() : row[key];
      });
      return out;
    });

    const ws = XLSX.utils.json_to_sheet(upperCased);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(examCenter || "Attendance"));
    return XLSX.write(wb, { type: "array", bookType: "xlsx" });
  } catch (error) {
    return null;
  }
};

export const generatePdfFile = (data, examCenter) => {
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

    const up = (v) => (typeof v === "string" ? v.toUpperCase() : v);
    const pushRow = (item) =>
      allTableData.push([allTableData.length + 1, up(item["Register number of the student"]), up(item["Name Of Applicant"]), up(item["Exam Name"]), up(item["Gender"]), up(item["P/R"]) || "", "", ""]);

    // Add male students first
    if (examData["Male"] && examData["Male"].length > 0) {
      maleCount = examData["Male"].length;
      sortByStatusThenRegno(examData["Male"]).forEach((item) => pushRow(item));
    }

    // Add female students second
    if (examData["Female"] && examData["Female"].length > 0) {
      femaleCount = examData["Female"].length;
      sortByStatusThenRegno(examData["Female"]).forEach((item) => pushRow(item));
    }

    // Add other gender students if any
    Object.keys(examData).forEach((gender) => {
      if (gender !== "Male" && gender !== "Female" && examData[gender].length > 0) {
        sortByStatusThenRegno(examData[gender]).forEach((item) => pushRow(item));
      }
    });

    if (allTableData.length > 0) {
      doc.autoTable({
        startY: currentY + 5,
        head: [["Sl No", "Register number of the student", "Name", "Name of Examination", "Gender", "P/R", "Signature", "Remarks"]],
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
