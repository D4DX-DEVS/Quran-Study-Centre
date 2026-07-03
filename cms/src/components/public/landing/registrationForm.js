import styled from "styled-components";

export const FormContainer = styled.div`
  width: 100%;
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;

  .form-group {
    width: 100%;
    margin-bottom: 20px;
    display: flex;
    flex-direction: column;
  }

  .form-control {
    width: 100%;
    padding: 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 16px;
    margin-top: 8px;
  }

  /* Remove background/padding from the AutoForm Overlay wrapper inside the modal */
  & > div {
    background: transparent !important;
    padding: 0 !important;
    box-shadow: none !important;
  }

  /* Override AutoForm specific styles */
  .plain.embed {
    width: 100% !important;

    .form-row {
      display: block !important;
      width: 100% !important;
    }

    .form-group {
      width: 100% !important;
      min-width: 100% !important;
      flex: 0 0 100% !important;
      padding: 0 !important;
      margin-bottom: 20px !important;
    }

    .form-input {
      width: 100% !important;
      min-width: 100% !important;
    }

    input,
    select,
    textarea {
      width: 100% !important;
      min-width: 100% !important;
      box-sizing: border-box !important;
    }

    /* Target specific fields */
    [name="nameOfApplicant"],
    [name="mobileNumber"],
    [name="whatsappNumber"],
    [name="address"],
    [name="gender"],
    [name="age"],
    [name="educationalQualification"],
    [name="nameOfExamAppearingNow"],
    [name="district"],
    [name="area"],
    [name="status"],
    [name="CenterRegistration"],
    [name="affiliation"] {
      width: 100% !important;
      min-width: 100% !important;
      max-width: 100% !important;
    }

    /* Remove any column layouts */
    .col,
    [class*="col-"] {
      width: 100% !important;
      max-width: 100% !important;
      flex: 0 0 100% !important;
      padding: 0 !important;
    }

    /* Override any grid systems */
    .row {
      display: block !important;
      margin: 0 !important;
    }

    /* Ensure labels are also full width */
    label {
      width: 100% !important;
      display: block !important;
      margin-bottom: 8px !important;
    }

    /* Override any custom classes */
    .full,
    .half,
    .quarter {
      width: 100% !important;
      max-width: 100% !important;
      flex: 0 0 100% !important;
    }
  }

  /* Style for form title */
  h2 {
    font-size: 24px;
    margin-bottom: 20px;
    color: #333;
    width: 100%;
  }

  /* Style for form description */
  p {
    margin-bottom: 30px;
    color: #666;
    width: 100%;
  }

  /* Style for required field asterisk */
  .required {
    color: red;
    margin-left: 4px;
  }

  /* Style for info text */
  .info-text {
    font-size: 14px;
    color: #666;
    margin-top: 4px;
    width: 100%;
  }

  /* Make submit button full width */
  button[type="submit"] {
    width: 100%;
    padding: 12px;
    margin-top: 20px;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 16px;
    cursor: pointer;

    &:hover {
      background-color: #0056b3;
    }
  }
`;

// Add number validation function
export const validatePhoneNumber = (value) => {
  // Remove any non-digit characters
  value = value.replace(/\D/g, "");
  if (value.length > 10) {
    return value.slice(0, 10);
  }
  return value;
};

export const formReg = [
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
    validation: "^[0-9]{10}$",
    default: "",
    label: "Mobile Number",
    tag: true,
    required: true,
    view: true,
    add: true,
    update: true,
    maxLength: 10,
    onKeyUp: (e) => {
      e.target.value = validatePhoneNumber(e.target.value);
    },
  },
  {
    type: "number",
    placeholder: "Whatsapp Number",
    name: "whatsappNumber",
    validation: "^[0-9]{10}$",
    default: "",
    label: "Whatsapp Number",
    tag: false,
    required: true,
    add: true,
    view: true,
    update: true,
    maxLength: 10,
    onKeyUp: (e) => {
      e.target.value = validatePhoneNumber(e.target.value);
    },
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
    customClass: "quarter",
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
    export: false,
    // customClass: "full",
  },
  {
    type: "info",
    content: "താങ്കൾ എഴുതുന്ന പരീക്ഷയുടെ പേര് തെരഞ്ഞെടുക്കുക",
    add: true,
    update: true,
    export: false,
  },
  {
    type: "line",
    add: false,
    update: true,
    export: false,
  },
  {
    type: "hidden",
    name: "examName",
    label: "Exam Name",
    tag: false,
    add: false,
    update: false,
    view: false,
    export: true,
  },
  {
    type: "hidden",
    name: "examSyllabus",
    label: "Exam Syllabus",
    tag: false,
    add: false,
    update: false,
    view: false,
    export: true,
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
    // customClass: "half",
  },
  {
    type: "line",
    add: false,
    update: true,
    export: false,
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
    // customClass: "half",
  },
  {
    type: "info",
    content: "ഖുർആൻ സ്റ്റഡി സെന്റർ കേരളയിൽ അഫിലിയേറ്റ് ചെയ്തിട്ടുള്ള പ്രാദേശിക സെന്ററുകളിൽ പഠിക്കുന്നവർ Regular വിഭാഗത്തിലും അല്ലാത്തവർ Private വിഭാഗത്തിലും ഉൾപ്പെടുന്നു.(ഈ രണ്ട് വിഭാഗങ്ങളിലും വെവ്വേറെ റാങ്ക് ലിസ്റ്റ് പ്രസിദ്ധീകരിക്കുന്നതാണ്)",
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
    tag: true,
    label: "Mode of Study",
    showItem: "",
    required: true,
    view: true,
    info: "ഖുർആൻ സ്റ്റഡി സെന്റർ കേരളയിൽ അഫിലിയേറ്റ് ചെയ്തിട്ടുള്ള പ്രാദേശിക സെന്ററുകളിൽ പഠിക്കുന്നവർ Regular വിഭാഗത്തിലും അല്ലാത്തവർ Private വിഭാഗത്തിലും ഉൾപ്പെടുന്നു.",
    filter: true,
    add: true,
    update: true,
    apiType: "CSV",
    selectApi: "Private,Regular",
    export: true,
    customClass: "full",
  },
  {
    type: "line",
    add: false,
    update: true,
    export: false,
  },
  {
    type: "info",
    content: "റെഗുലർ സെന്ററുകളിൽ പഠിക്കുന്നവർ തങ്ങളുടെ സ്റ്റഡി സെന്റർ തന്നെയാണ് പരീക്ഷ കേന്ദ്രമായി തെരഞ്ഞെടുക്കേണ്ടത്.",
    add: true,
    update: true,
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
    placeholder: "Study Center",
    customClass: "full",
    updateOn: "area",
    name: "centerRegistration",
    // collection: "centerRegistration",
    validation: "",
    showItem: "nameOfCenter",
    default: "",
    tag: false,
    label: "Study Center (പരീക്ഷാ കേന്ദ്രം കൂടിയാണിത്)",
    required: true,
    view: true,
    add: true,
    update: true,
    filter: true,
    search: false,
    export: true,
  },
  {
    type: "info",
    content:
      "പരീക്ഷാ കേന്ദ്രം: സ്റ്റഡി സെന്ററുകൾ തന്നെ പരീക്ഷാ കേന്ദ്രങ്ങളാണ്. " +
      "ഒരു സ്റ്റഡി സെന്ററിൽ 5-ൽ താഴെ ആളുകൾ മാത്രമാണെങ്കിൽ, സമീപത്തെ സ്റ്റഡി സെന്ററുമായി ചേർത്ത് സംഘടിപ്പിക്കും. " +
      "അന്തിമ പരീക്ഷാ കേന്ദ്രം ഹാൾടിക്കറ്റിൽ ലഭ്യമാകും.",
    add: true,
    update: false,
    export: false,
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
    validation: "^[0-9]{10}$",
    default: "",
    info: "Regular വിഭാഗത്തിന് 100 രൂപയും Private വിഭാഗത്തിന് 150 രൂപയുമാണ് രജിസ്ട്രേഷൻ ഫീസ്. തുക 7994162608 നമ്പറിൽ ഗൂഗിൾ പേ ചെയ്യുക. ഏത് നമ്പറിൽ നിന്നാണോ ഗൂഗിൾ പേ ചെയ്തത്, ആ നമ്പർ ഇവിടെ നൽകുക.",
    label: "Gpay Number",
    required: true,
    add: true,
    view: true,
    export: true,
    maxLength: 10,
    onKeyUp: (e) => {
      e.target.value = validatePhoneNumber(e.target.value);
    },
  },
];
