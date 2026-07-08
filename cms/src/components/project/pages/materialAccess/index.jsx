import React, { useState } from "react";
import { useSelector } from "react-redux";
import Layout from "../../../core/layout";
import ListTable from "../../../core/list/list";
import { Container } from "../../../core/layout/styels";
import { putData } from "../../../../backend/api";

const MaterialAccess = (props) => {
  const loggedInUser = useSelector((state) => state.login?.data?.user) || {};
  const adminDistrictId = loggedInUser?.districts?._id || loggedInUser?.districts || "";
  const isDistrictAdmin = Boolean(adminDistrictId);

  const [lastUpdatedDate, setLastUpdatedDate] = useState(null);

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
          {...props}
        />
      </div>
    </Container>
  );
};

export default Layout(MaterialAccess);
