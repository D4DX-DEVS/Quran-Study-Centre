import React, { useState } from "react";
import styled from "styled-components";
import AutoForm from "../../core/form";
import { getData, putData } from "../../../backend/api";
import { FormContainer, formReg, validatePhoneNumber } from "./registrationForm";

const lookupForm = [
  {
    type: "info",
    content: "രജിസ്ട്രേഷൻ സമയത്ത് നൽകിയ മൊബൈൽ നമ്പർ നൽകി സെർച്ച് ചെയ്യുക",
  },
  {
    type: "number",
    placeholder: "Mobile Number",
    name: "mobileNumber",
    validation: "^[0-9]{10}$",
    default: "",
    label: "Mobile Number",
    required: true,
    add: true,
    maxLength: 10,
    onKeyUp: (e) => {
      e.target.value = validatePhoneNumber(e.target.value);
    },
  },
];

const RegistrationList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;

  .reg-card {
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 16px;
  }

  .reg-card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    font-weight: 600;
  }

  dl {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 16px;
    margin: 0 0 16px;
  }

  dl div {
    display: flex;
    flex-direction: column;
  }

  dt {
    font-size: 12px;
      
  }

  dd {
    margin: 0;
    font-size: 14px;
  }

  .reg-card button {
    padding: 10px 16px;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;

    &:hover {
      background-color: #0056b3;
    }
  }
`;

const BackButton = styled.button`
  margin-top: 8px;
  background: none;
  border: none;
  color: #007bff;
  cursor: pointer;
  padding: 0;
  font-size: 14px;
`;

// Convert a populated exam registration record into AutoForm formValues,
// resolving populated refs (district/area/etc) down to their id.
const buildEditValues = (record) => {
  const values = {};
  formReg.forEach((item) => {
    if (!item.name) return;
    const raw = record[item.name];
    values[item.name] = item.type === "select" ? raw?._id ?? raw ?? "" : raw ?? "";
  });
  return values;
};

function VerifyRegistration({ onClose, setMessage, setLoaderBox }) {
  const [step, setStep] = useState("lookup");
  const [mobile, setMobile] = useState("");
  const [registrations, setRegistrations] = useState([]);
  const [selected, setSelected] = useState(null);

  const fetchRegistrations = async (mobileNumber) => {
    const response = await getData({ regno: mobileNumber }, "exam-registration/result");
    if (response.status === 200 && response.data?.success) {
      const list = [...(response.data.response || [])].sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      );
      setRegistrations(list);
      return true;
    }
    return false;
  };

  const lookup = async (post) => {
    setLoaderBox(true);
    const found = await fetchRegistrations(post.mobileNumber);
    setLoaderBox(false);

    if (found) {
      setMobile(post.mobileNumber);
      setStep("list");
    } else {
      setMessage({
        type: 3,
        content: "No registration found for this mobile number.",
        proceed: "Okay",
      });
    }
  };

  const submitEdit = async (post) => {
    setLoaderBox(true);
    // AutoForm only forwards keys that appear in formReg, so it drops the "id"
    // we injected in buildEditValues. Re-attach it from the selected record.
    const response = await putData({ ...post, id: selected._id }, "exam-registration");

    if (response.data?.success) {
      // The PUT response returns the raw document with unpopulated refs
      // (district/area/exam as plain ids), so refetch the populated list
      // instead of merging the raw response in.
      await fetchRegistrations(mobile);
      setLoaderBox(false);
      const backToList = async () => {
        try {
          setSelected(null);
          setStep("list");
        } catch (error) {}
      };
      setMessage({
        type: 2,
        content: "Registration updated successfully",
        proceed: "Okay",
        onClose: backToList,
        onProceed: backToList,
      });
    } else {
      setLoaderBox(false);
      setMessage({
        type: 3,
        content: response.data?.customMessage || response.data?.message || "Could not update your registration.",
        proceed: "Okay",
      });
    }
  };

  if (step === "edit" && selected) {
    return (
      <FormContainer>
        <AutoForm
          useCaptcha={false}
          key={"form"}
          formType={"put"}
          header={"Edit Registration"}
          description={"Update any mismatched details below."}
          css="plain embed"
          formInput={formReg}
          formValues={buildEditValues(selected)}
          submitHandler={submitEdit}
          button={"Save Changes"}
          isOpenHandler={() => setStep("list")}
          isOpen={true}
          plainForm={false}
          formMode={"single"}
        />
      </FormContainer>
    );
  }

  if (step === "list") {
    return (
      <FormContainer>
        <h2>Your Registrations</h2>
        <p>Registrations linked to this mobile number, listed in the order you registered.</p>
        <RegistrationList>
          {registrations.map((item, index) => (
            <div className="reg-card" key={item._id}>
              <div className="reg-card-head">
                <span>#{index + 1}</span>
                <span>{item.regno || "Reg No will be provided later"}</span>
              </div>
              <dl>
                <div>
                  <dt>Name</dt>
                  <dd>{item.nameOfApplicant}</dd>
                </div>
                <div>
                  <dt>Mobile</dt>
                  <dd>{item.mobileNumber}</dd>
                </div>
                <div>
                  <dt>Exam</dt>
                  <dd>{item.nameOfExamAppearingNow?.examType || "-"}</dd>
                </div>
                <div>
                  <dt>Mode of Study</dt>
                  <dd>{item.status || "-"}</dd>
                </div>
                <div>
                  <dt>District</dt>
                  <dd>{item.district?.district || "-"}</dd>
                </div>
                <div>
                  <dt>Area</dt>
                  <dd>{item.area?.area || "-"}</dd>
                </div>
                <div>
                  <dt>Exam Center</dt>
                  <dd>{item.centerRegistration?.nameOfCenter || "-"}</dd>
                </div>
                <div>
                  <dt>Registered On</dt>
                  <dd>{item.createdAt ? new Date(item.createdAt).toLocaleString() : "-"}</dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={() => {
                  setSelected(item);
                  setStep("edit");
                }}
              >
                Edit Details
              </button>
            </div>
          ))}
        </RegistrationList>
        <BackButton type="button" onClick={() => setStep("lookup")}>
          Search another number
        </BackButton>
      </FormContainer>
    );
  }

  return (
    <FormContainer>
      <AutoForm
        useCaptcha={false}
        key={"form"}
        formType={"post"}
        header={"Verify Your Registration"}
        description={"Enter your registered mobile number to view your registrations."}
        css="plain embed"
        formInput={lookupForm}
        submitHandler={lookup}
        button={"Search"}
        isOpenHandler={onClose}
        isOpen={true}
        plainForm={false}
        formMode={"single"}
      />
    </FormContainer>
  );
}

export default VerifyRegistration;
