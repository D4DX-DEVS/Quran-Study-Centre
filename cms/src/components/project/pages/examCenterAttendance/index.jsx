import React, { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import Layout from "../../../core/layout";
import ListTable from "../../../core/list/list";
import { Container } from "../../../core/layout/styels";
import { Download } from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { getData } from "../../../../backend/api";
import { groupDataByDistrictAreaCenter, generateExcelFile, generatePdfFile } from "../../../../utils/attendanceExport";

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
