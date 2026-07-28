import React, { useRef, useState } from "react";
import { useSelector } from "react-redux";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { Download } from "lucide-react";
import Layout from "../../../core/layout";
import ListTable from "../../../core/list/list";
import { Container } from "../../../core/layout/styels";
import { getData, putData } from "../../../../backend/api";

const MaterialAccess = (props) => {
  const loggedInUser = useSelector((state) => state.login?.data?.user) || {};
  const adminDistrictId = loggedInUser?.districts?._id || loggedInUser?.districts || "";
  const isDistrictAdmin = Boolean(adminDistrictId);

  const [lastUpdatedDate, setLastUpdatedDate] = useState(null);
  const [downloading, setDownloading] = useState(false);

  // Tracks the table's own district/area filter (including the preFilter seeded
  // for district admins) so the PDF only covers whatever's currently filtered,
  // not every row.
  const currentFilterRef = useRef({});
  const handleFilterChange = (filter) => {
    currentFilterRef.current = filter || {};
  };

  // No skip/limit means the backend returns every matching row (not just the
  // current table page), scoped by whatever district/area filter is active.
  const downloadPasswordsPdf = async () => {
    setDownloading(true);
    try {
      const { district, area } = currentFilterRef.current || {};
      const fields = {};
      if (district) fields.district = district;
      if (area) fields.area = area;

      const response = await getData(fields, "material-access");
      const rows = response?.data?.response || [];
      if (rows.length === 0) {
        props.setMessage({ type: 1, content: "No area admin passwords found to export", proceed: "Okay" });
        return;
      }

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.setFontSize(14);
      doc.text("Area Admin Passwords", pageWidth / 2, 15, { align: "center" });
      doc.autoTable({
        startY: 22,
        head: [["District", "Area", "Password"]],
        body: rows.map((row) => [row.district?.district || "", row.area?.area || "", row.password || ""]),
        styles: { fontSize: 10, cellPadding: 3, lineColor: 0, lineWidth: 0.3, textColor: 0 },
        headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: "bold", halign: "center" },
        tableLineColor: 0,
        tableLineWidth: 0.3,
        theme: "grid",
        margin: { left: 14, right: 14 },
      });
      doc.save(`Area-Admin-Passwords-${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (error) {
      props.setMessage({ type: 1, content: `Error generating PDF: ${error.message || "Unknown error"}`, proceed: "Okay" });
    } finally {
      setDownloading(false);
    }
  };

  const actions = [
    {
      element: "button",
      type: "callback",
      callback: async (item, data) => {
        await putData({ id: data._id, regenerate: true }, "material-access");
        setLastUpdatedDate(new Date().toISOString());
      },
      icon: "refresh",
      title: "Regenerate Password",
      actionType: "button",
    },
  ];

  const attributes = [
    {
      type: "select",
      apiType: "API",
      selectApi: "district/select",
      name: "district",
      label: "District",
      showItem: "district",
      tag: true,
      view: true,
      filter: true,
      add: false,
      update: false,
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
      tag: true,
      view: true,
      filter: true,
      add: false,
      update: false,
    },
    {
      type: "text",
      name: "password",
      label: "Password",
      tag: true,
      view: true,
      add: false,
      update: true,
    },
  ];

  return (
    <Container className="noshadow">
      <div className="p-4 w-full">
        <div className="flex w-full justify-between items-center mb-6">
          <h6 className="text-2xl font-bold">Area Admin Passwords</h6>
          {props.exportPrivilege && (
            <button
              onClick={downloadPasswordsPdf}
              disabled={downloading}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={16} />
              {downloading ? "Generating..." : "Download"}
            </button>
          )}
        </div>

        <ListTable
          api={`material-access`}
          itemTitle={{ name: "password", type: "text" }}
          shortName="Area Admin Password"
          showTitle={false}
          formMode="single"
          surfaceTheme={"district"}
          actions={actions}
          attributes={attributes}
          preFilter={isDistrictAdmin && adminDistrictId ? { district: adminDistrictId } : {}}
          lastUpdateDate={lastUpdatedDate}
          onFilterChange={handleFilterChange}
          {...props}
          exportPrivilege={false}
        />
      </div>
    </Container>
  );
};

export default Layout(MaterialAccess);
