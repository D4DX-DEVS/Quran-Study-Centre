import React, { useEffect, useState } from "react";
import "./style.css";
import { Container } from "../../core/layout/styels"; // Corrected "styels" to "styles"
import { GiHamburgerMenu } from "react-icons/gi";
import { RiCloseFill } from "react-icons/ri";
import { motion } from "framer-motion";
import AutoForm from "../../core/form";
import { getData, postData } from "../../../backend/api";
import styled from "styled-components";
import logo from "../../../components/project/brand/logo-header.png";
import { FormContainer, formReg } from "./registrationForm";
import VerifyRegistration from "./VerifyRegistration";
import MaterialAccessGate from "./MaterialAccessGate";
// import { tr } from "date-fns/locale";

const RegisterBtn = styled.button`
  background: linear-gradient(135deg, #1d4ed8, #3b6ff0);
  color: white;
  border-radius: 999px;
  border: none;
  padding: 14px 20px;
  cursor: pointer;
  justify-content: center;
  align-items: center;
  display: flex;
  gap: 10px;
  font-size: 14px;
  font-weight: 800;
  box-shadow: 0 18px 36px rgba(21, 63, 122, 0.24);

  &.float {
    position: fixed;
    left: 16px;
    right: 16px;
    bottom: 16px;
    z-index: 1002;
  }

  @media (max-width: 768px) {
    &.float {
      width: calc(100% - 32px);
    }
  }
`;

const onChange1 = (nameOfCenter, updateValue) => {
  const { studentsCountMale, studentsCountFemale, centerType } = updateValue;
  const male = parseFloat(studentsCountMale) || 0;
  const female = parseFloat(studentsCountFemale) || 0;
  const total = centerType === "Mixed" ? male + female : 0;
  updateValue["studentsCountTotal"] = total.toFixed(0);
  return updateValue;
};

function Header(props) {
  const [openMenuSetup, setOpenMenuSetup] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [openAffiliation, setOpenAffiliation] = useState(false);
  const [openHallTicket, setOpenHallTicket] = useState(false);
  const [openVerifyRegistration, setOpenVerifyRegistration] = useState(false);
  const [openMaterialAccess, setOpenMaterialAccess] = useState(false);
  const [showHelpPopup, setShowHelpPopup] = useState(false);
  const [isFloating, setIsFloating] = useState(window.matchMedia("(max-width: 600px)").matches);

  useEffect(() => {
    const handleResize = () => {
      setIsFloating(window.matchMedia("(max-width: 600px)").matches);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const handleMenu = (e) => {
    e.preventDefault();
    setShowMenu(!showMenu);
  };

  const toggleHelpPopup = () => {
    setShowHelpPopup(!showHelpPopup);
    setShowMenu(false);
  };

  const openActionPanel = (action) => {
    setShowMenu(false);
    setOpenMenuSetup(false);
    setOpenAffiliation(false);
    setOpenHallTicket(false);
    setOpenVerifyRegistration(false);
    setOpenMaterialAccess(false);
    setShowHelpPopup(false);

    if (action === "examRegistration") setOpenMenuSetup(true);
    if (action === "centerRegistration") setOpenAffiliation(true);
    if (action === "hallTicket") setOpenHallTicket(true);
    if (action === "verifyRegistration") setOpenVerifyRegistration(true);
    if (action === "examInstructions") setShowHelpPopup(true);
    if (action === "material") setOpenMaterialAccess(true);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const formInput = [
    {
      type: "title",
      title: "Center Details",
      add: true,
    },
    {
      type: "text",
      placeholder: "Name Of Center",
      name: "nameOfCenter",
      validation: "",
      default: "",
      label: "Name Of Center",
      required: true,
      add: true,
    },
    {
      type: "select",
      apiType: "CSV",
      selectApi: "Male,Female,Mixed",
      placeholder: "Center Type",
      updateOn: "centerType",
      name: "centerType",
      validation: "",
      showItem: "userDisplayName",
      default: "",
      tag: false,
      label: "Center Type",
      required: true,
      view: true,
      add: true,
      update: true,
      filter: true,
    },
    {
      type: "select",
      apiType: "API",
      selectApi: "district/select",
      placeholder: "District",
      name: "district",
      validation: "",
      showItem: "userDisplayName",
      default: "",
      tag: false,
      label: "District",
      required: true,
      view: true,
      add: true,
      update: true,
      search: true,
      filter: true,
    },
    {
      type: "select",
      apiType: "API",
      selectApi: "area/get-area-by-district",
      placeholder: "Area",
      updateOn: "district",
      name: "area",
      validation: "",
      showItem: "userDisplayName",
      default: "",
      tag: false,
      label: "Area",
      required: true,
      view: true,
      add: true,
      update: true,
      search: true,
      filter: true,
    },
    {
      type: "text",
      placeholder: "Halqa Name",
      name: "halqaName",
      validation: "",
      default: "",
      label: "Halqa Name",
      required: true,
      add: true,
    },
    {
      type: "title",
      title: "Students Details",
      add: true,
    },
    {
      type: "number",
      placeholder: "Male Students",
      name: "studentsCountMale",
      validation: "",
      default: 0,
      label: "Male Students",
      required: true,
      add: true,
      onChange: onChange1,
      condition: {
        item: "centerType",
        if: "Female",
        then: "disabled",
        else: "enabled",
      },
    },
    {
      type: "number",
      placeholder: "Female Students",
      name: "studentsCountFemale",
      validation: "",
      default: 0,
      label: "Female Students",
      required: true,
      add: true,
      onChange: onChange1,
      condition: {
        item: "centerType",
        if: "Male",
        then: "disabled",
        else: "enabled",
      },
    },
    {
      type: "number",
      placeholder: "Total Students",
      name: "studentsCountTotal",
      validation: "",
      default: 0,
      label: "Total Students",
      required: true,
      add: true,
      onChange: onChange1,
      condition: {
        item: "centerType",
        if: "Mixed",
        then: "enabled",
        else: "disabled",
      },
      update: true,
    },
    // {
    //   type: "title",
    //   title: "Co Ordinator Details",
    //   add: true,
    // },
    // {
    //   type: "text",
    //   placeholder: "Area Qsc Co Ordinator Name",
    //   name: "AreaQscCoOrdinatorName",
    //   validation: "",
    //   default: "",
    //   label: "Area Qsc Co Ordinator Name",
    //   required: true,
    //   add: true,
    // },
    // {
    //   type: "text",
    //   placeholder: "Mobile Number Of Co Ordinator",
    //   name: "mobNumberOfAreaQscCoOrdinator",
    //   validation: "",
    //   default: "",
    //   label: "Mobile Number Of Co Ordinator",
    //   required: true,
    //   add: true,
    // },
  ];

  const hallTicket = [
    {
      type: "info",
      content: "Enter Mobile Number to download Hall Ticket",
    },
    {
      type: "number",
      placeholder: "Mobile Number",
      name: "mobileNumber",
      validation: "",
      default: "",
      label: "Mobile Number",
      required: true,
      add: true,
    },
  ];

  const isCreatingHandler = (value, callback) => {
    setOpenMenuSetup(false);
    setOpenAffiliation(false);
    setOpenHallTicket(false);
    setOpenVerifyRegistration(false);
    setOpenMaterialAccess(false);
  };

  const submitHallticket = async (post) => {
    props.setLoaderBox(true);
    try {
      const response = await postData({ ...post }, "hall-ticket/download");

      if (response && (response.data?.success || response.success === true)) {
        setOpenHallTicket(false);
        props.setLoaderBox(false);
        props.setMessage({
          type: 3,
          content: "Downloaded Successfully",
          proceed: "Okay",
        });
        window.open(response.data.url, "_blank");
      } else {
        props.setLoaderBox(false);
        props.setMessage({
          type: 3,
          content: "User not registered for the exam",
          proceed: "Okay",
        });
      }
    } catch (error) {
      props.setLoaderBox(false);
      props.setMessage({
        type: 3,
        content: "An error occurred while submitting the hall ticket",
        proceed: "Okay",
      });
    }
  };

  const submitChange = async (post) => {
    postData({ ...post }, "center-registration").then((response) => {
      if (response.data.success === true) {
        setOpenAffiliation(false);
        props.setMessage({
          type: 1,
          content: "Submitted Successfully",
          proceed: "Okay",
        });
      }
    });
  };

  const submitReg = async (post) => {
    postData({ ...post }, "exam-registration")
      .then((response) => {
        if (response.data.success === true) {
          props.setMessage({
            type: 2,
            content: "Submitted Successfully",
            proceed: "Okay",
            okay: "Cancel",
            onClose: async () => {
              try {
                setOpenMenuSetup(false);
              } catch (error) {}
            },
            onProceed: async () => {
              try {
                setOpenMenuSetup(false);
              } catch (error) {}
            },
            data: { id: 1 },
          });
        } else {
          // Handle error case with customMessage
          props.setMessage({
            type: 3, // Using type 3 for error messages
            content: response.data.customMessage || "An error occurred during registration",
            proceed: "Okay",
          });
        }
      })
      .catch((error) => {
        // Handle network errors or other exceptions
        props.setMessage({
          type: 3,
          content: error.response?.data?.customMessage || "An error occurred during registration",
          proceed: "Okay",
        });
      });
  };

  const [showCenterRegistration, setCenterRegistration] = useState(false);
  const [showHallTicket, setHallTicket] = useState(false);
  const [showExamRegistration, setExamRegistration] = useState(false);
  const [showDownloads, setDownloads] = useState(false);
  const [showMaterial, setMaterial] = useState(false);
  const [showAboutUs, setAboutUs] = useState(false);
  const [showResult, setResult] = useState(false);
  const [showExamInstructions, setExamInstructions] = useState(false);
  const [showVerifyRegistration, setShowVerifyRegistration] = useState(true);

  useEffect(() => {
    getData({}, "floating-menu-settings").then((response) => {
      const settings = response?.data?.response?.[0] || {
        downloads: true,
        about: true,
      };

      setCenterRegistration(!!settings.centerRegistration);
      setHallTicket(!!settings.hallTicket);
      setExamRegistration(!!settings.examRegistration);
      setDownloads(!!settings.downloads);
      setMaterial(settings.material !== false);
      setAboutUs(!!settings.about);
      setResult(!!settings.result);
      setExamInstructions(!!settings.examInstruction);
      setShowVerifyRegistration(settings.verifyRegistration !== false);
    });
  }, []);

  useEffect(() => {
    const handleLandingAction = (event) => {
      const action =
        typeof event.detail === "string" ? event.detail : event.detail?.action;

      if (action) {
        openActionPanel(action);
      }
    };

    window.addEventListener("qsc:landing-action", handleLandingAction);

    return () => {
      window.removeEventListener("qsc:landing-action", handleLandingAction);
    };
  }, []);

  const navLinks = [
    { label: "Home", href: "/" },
    showDownloads ? { label: "Downloads", href: "/question-papers" } : null,
    showMaterial ? { label: "Material", action: "material" } : null,
    showAboutUs ? { label: "About QSC", href: "/about-us" } : null,
    showResult ? { label: "Result", href: "/result" } : null,
  ].filter(Boolean);

  const renderModal = (content) => (
    <div className="landing-modal-backdrop" onClick={() => isCreatingHandler()}>
      <div
        className="landing-modal-card"
        onClick={(event) => event.stopPropagation()}
      >
        {content}
      </div>
    </div>
  );

  return (
    <>
      <header className="landing-site-header">
        <div className="landing-header-shell">
          <a href="/" className="landing-brand">
            <img src={logo} alt="QSC logo" />
          </a>

          <div className="landing-navbar">
            {navLinks.map((item) =>
              item.action ? (
                <button
                  key={item.label}
                  type="button"
                  className="landing-nav-btn"
                  onClick={() => openActionPanel(item.action)}
                >
                  {item.label}
                </button>
              ) : (
                <a key={item.label} href={item.href}>
                  {item.label}
                </a>
              )
            )}
            {showExamInstructions && (
              <button
                type="button"
                className="landing-nav-btn"
                onClick={() => openActionPanel("examInstructions")}
              >
                Instructions
              </button>
            )}
            {showCenterRegistration && (
              <button
                type="button"
                className="landing-nav-btn"
                onClick={() => openActionPanel("centerRegistration")}
              >
                Centre Affiliation
              </button>
            )}
          </div>

          <div className="landing-header-actions">
            {showHallTicket && (
              <button
                type="button"
                className="landing-header-btn secondary"
                onClick={() => openActionPanel("hallTicket")}
              >
                Hall Ticket
              </button>
            )}
            {showExamRegistration && (
              <button
                type="button"
                className="landing-header-btn primary landing-register-highlight"
                onClick={() => openActionPanel("examRegistration")}
              >
                Exam Registration
              </button>
            )}
            {showVerifyRegistration && (
              <button
                type="button"
                className="landing-header-btn secondary"
                onClick={() => openActionPanel("verifyRegistration")}
              >
                Verify Your Registration
              </button>
            )}
            <a
              href="/admin"
              className="landing-header-btn secondary"
              style={{ padding: "14px 28px", fontSize: "15px", minWidth: "110px" }}
            >
              Login
            </a>
            {showMenu ? (
              <RiCloseFill className="landing-hamburger" onClick={handleMenu} />
            ) : (
              <GiHamburgerMenu className="landing-hamburger" onClick={handleMenu} />
            )}
          </div>
        </div>

        {showMenu && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="landing-mobile-nav"
          >
            {navLinks.map((item) =>
              item.action ? (
                <button
                  key={item.label}
                  type="button"
                  className="landing-nav-btn"
                  onClick={() => openActionPanel(item.action)}
                >
                  {item.label}
                </button>
              ) : (
                <a key={item.label} href={item.href} onClick={() => setShowMenu(false)}>
                  {item.label}
                </a>
              )
            )}
            {showExamInstructions && (
              <button
                type="button"
                className="landing-nav-btn"
                onClick={() => openActionPanel("examInstructions")}
              >
                Exam Instructions
              </button>
            )}
            {showCenterRegistration && (
              <button
                type="button"
                className="landing-nav-btn"
                onClick={() => openActionPanel("centerRegistration")}
              >
                Centre Affiliation
              </button>
            )}
            {showHallTicket && (
              <button
                type="button"
                className="landing-nav-btn"
                onClick={() => openActionPanel("hallTicket")}
              >
                Hall Ticket
              </button>
            )}
            {showExamRegistration && (
              <button
                type="button"
                className="landing-mob-register-btn landing-register-highlight"
                onClick={() => openActionPanel("examRegistration")}
              >
                Exam Registration
              </button>
            )}
            {showVerifyRegistration && (
              <button
                type="button"
                className="landing-nav-btn"
                onClick={() => openActionPanel("verifyRegistration")}
              >
                Verify Your Registration
              </button>
            )}
            <a href="/admin" onClick={() => setShowMenu(false)}>
              Login
            </a>
          </motion.div>
        )}
      </header>

      {showExamRegistration &&
        isFloating &&
        !showMenu &&
        !openMenuSetup &&
        !openAffiliation &&
        !openHallTicket &&
        !openVerifyRegistration && (
        <RegisterBtn
          className="float"
          onClick={(event) => {
            event.preventDefault();
            openActionPanel("examRegistration");
          }}
        >
          Exam Registration
        </RegisterBtn>
      )}

      <Container className="noshadow landing-modal-layer">
        {openMenuSetup &&
          renderModal(
            <FormContainer>
              <AutoForm
                useCaptcha={false}
                key={"form"}
                formType={"post"}
                header={"Registration"}
                description={"ഖുർആൻ സ്റ്റഡി സെന്റർ കേരള വാർഷിക പരീക്ഷയ്ക്ക് രജിസ്റ്റർ ചെയ്യാനുള്ള ഫോം ആണിത്. ഇംഗ്ലീഷിൽ ടൈപ്പ് ചെയ്താൽ മാത്രമേ സബ്മിറ്റ് ആവുകയുള്ളൂ എന്നത് പ്രത്യേകം ശ്രദ്ധിക്കുക."}
                css="plain embed"
                formInput={formReg}
                submitHandler={submitReg}
                button={"Submit"}
                isOpenHandler={isCreatingHandler}
                isOpen={true}
                plainForm={false}
                formMode={"single"}
              />
            </FormContainer>
          )}

        {openAffiliation &&
          renderModal(
            <FormContainer>
              <AutoForm
                useCaptcha={false}
                key={"form"}
                formType={"post"}
                header={"Centre Affiliation"}
                description={"പ്രാദേശിക തലങ്ങളിൽ പ്രവർത്തിക്കുന്ന ഖുർആൻ പഠന വേദികൾ, ഖുർആൻ സ്റ്റഡി സെന്റർ കേരളയിൽ അഫിലിയേറ്റ് ചെയ്യുന്നതിനുള്ള ഫോം."}
                css="plain embed"
                formInput={formInput}
                submitHandler={submitChange}
                button={"Submit"}
                isOpenHandler={isCreatingHandler}
                isOpen={true}
                plainForm={false}
                formMode={"single"}
              />
            </FormContainer>
          )}

        {openHallTicket &&
          renderModal(
            <FormContainer>
              <AutoForm
                useCaptcha={false}
                key={"form"}
                formType={"post"}
                header={"Hall Ticket Download"}
                description={"രജിസ്ട്രേഷൻ സമയത്ത് നൽകിയ മൊബൈൽ നമ്പർ താഴെ നൽകി സബ്മിറ്റ് ചെയ്യുക."}
                css="plain embed"
                formInput={hallTicket}
                submitHandler={submitHallticket}
                button={"Submit"}
                isOpenHandler={isCreatingHandler}
                isOpen={true}
                plainForm={false}
                formMode={"single"}
              />
            </FormContainer>
          )}

        {openVerifyRegistration &&
          renderModal(
            <VerifyRegistration
              onClose={() => setOpenVerifyRegistration(false)}
              setMessage={props.setMessage}
              setLoaderBox={props.setLoaderBox}
            />
          )}

        {openMaterialAccess &&
          renderModal(<MaterialAccessGate onClose={() => setOpenMaterialAccess(false)} />)}

        {showHelpPopup && (
          <div className="help-popup" onClick={toggleHelpPopup}>
            <div className="help-content" onClick={(event) => event.stopPropagation()}>
              <h3>നിര്‍ദ്ദേശങ്ങള്‍</h3>
              <p>
                ഖുർആൻ സ്റ്റഡി സെന്റർ കേരള വാർഷിക പരീക്ഷയുടെ രജിസ്ട്രേഷൻ ഫോം
                പൂരിപ്പിക്കുന്നതിന് മുമ്പ് താഴെ നൽകിയ നിർദേശങ്ങൾ ശ്രദ്ധിച്ച്
                വായിക്കുക.
              </p>
              <p>
                1. ഖുർആൻ സ്റ്റഡി സെന്റർ കേരളയിൽ അഫിലിയേറ്റ് ചെയ്തിട്ടുള്ള
                പ്രാദേശിക സ്റ്റഡി സെന്ററുകളിൽ പഠിച്ചു പരീക്ഷ എഴുതുന്നവർ റഗുലർ
                വിഭാഗത്തിലും സ്വന്തമായി പഠിച്ചു പരീക്ഷ എഴുതുന്നവർ പ്രൈവറ്റ്
                വിഭാഗത്തിലുമാണ് രജിസ്റ്റർ ചെയ്യേണ്ടത്. ഫോമിൽ Mode of Study എന്ന
                ഓപ്ഷനിൽ Private അല്ലെങ്കിൽ Regular തെരഞ്ഞെടുക്കുക.
              </p>
              <p>
                2. നിശ്ചിത കോളത്തിൽ, ലഭ്യമായ പരീക്ഷകളുടെ ലിസ്റ്റിൽ നിന്ന് നിങ്ങൾ
                എഴുതുന്നത് കൃത്യമായി തെരഞ്ഞെടുക്കണം.
              </p>
              <p>
                3. റഗുലർ വിഭാഗത്തിൽ ഉള്ളവർ തങ്ങൾ പഠിക്കുന്ന സെന്ററിന്റെ പേര് Study
                Centre ഓപ്ഷനിലെ ലിസ്റ്റിൽ നിന്ന് തെരഞ്ഞെടുക്കുക. അഫിലിയേഷൻ നമ്പറും
                ചേർക്കണം.
              </p>
              <p>
                4. നിങ്ങൾ പഠിക്കുന്ന പ്രാദേശിക സെന്ററിന്റെ പേര് ലിസ്റ്റിൽ ഇല്ലെങ്കിൽ
                Area QSC കോഡിനേറ്ററെ അറിയിക്കേണ്ടതാണ്. അവർ മുഖേന അഫിലിയേഷൻ
                വിവരങ്ങൾ ലഭ്യമാകുന്നതാണ്.
              </p>
              <p>
                5. രജിസ്ട്രേഷൻ ഫീസ് ഏത് വിഭാഗത്തിലാണോ ബാധകമാകുന്നത്, ആ തുക
                നിർദേശിച്ച നമ്പറിലേക്ക് അടച്ച ശേഷം ഗൂഗിൾ പേ ചെയ്ത നമ്പർ തന്നെയാണ്
                ഫോമിൽ നൽകേണ്ടത്.
              </p>
              <button className="landing-help-close" onClick={toggleHelpPopup}>
                Close
              </button>
            </div>
          </div>
        )}
      </Container>
    </>
  );
}

export default Header;
