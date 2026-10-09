import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { clearLoginSession, fetchLogin } from "../../../store/actions/login";
import AutoForm from "../../core/autoform/AutoForm";
import { logo } from "../../../images";
import withLayout from "../layout";
import { AlertCircle, ArrowLeft } from "lucide-react";
import styled, { keyframes } from "styled-components";
import { postData } from "../../../backend/api";
import { getDefaultMenuPath } from "../../../menuSections";
import { usePageSeo } from "../../../utils/seo";

// Kept outside the component so the form engine sees the same definition on every render.
const formInput = [
  {
    type: "text",
    placeholder: "Enter your email",
    name: "email",
    validation: "email",
    default: "",
    label: "Email",
    minimum: 5,
    maximum: 40,
    required: true,
    icon: "email",
    add: true,
  },
  {
    type: "password",
    placeholder: "Enter your password",
    name: "password",
    default: "",
    label: "Password",
    minimum: 0,
    required: true,
    icon: "password",
    add: true,
  },
];

const CONNECTION_ERROR = "We couldn't reach the server. Please check your connection and try again.";

// The API answers a failed login with a plain message; show it in friendly words.
const friendlyLoginError = (message) => {
  const text = String(message || "");
  if (/no user found/i.test(text)) return "We couldn't find an account with that email address. Please check it and try again.";
  if (/wrong password|incorrect password/i.test(text)) return "That password is incorrect. Please try again.";
  if (!text || /unexpected response|validationfailed|something went wrong/i.test(text)) return "We couldn't sign you in. Please check your details and try again.";
  return text;
};

export const Login = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.login);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState("");
  // Keep the email the administrator typed so only the password has to be re-entered after a failed attempt.
  const [lastEmail, setLastEmail] = useState("");
  const formValues = useMemo(() => ({ email: lastEmail }), [lastEmail]);

  usePageSeo({ title: "QSC System", noindex: true });

  useEffect(() => {
    if (user.data?.token) {
      navigate(getDefaultMenuPath(user.data?.menu ?? []), { replace: true });
      return;
    }

    if (user.error !== null) {
      setLoginError(friendlyLoginError(user.error));
      dispatch(clearLoginSession());
    }
  }, [user.data?.token, user.data?.menu, user.error, navigate, dispatch]);

  const submitChange = async (post) => {
    setIsSubmitting(true);
    setLoginError("");
    setLastEmail(post?.email ?? "");
    try {
      const response = await postData(post, "auth/login");
      if (response.status === 200) {
        dispatch(fetchLogin(post, response));
      } else {
        setLoginError(CONNECTION_ERROR);
        setIsSubmitting(false);
      }
    } catch (error) {
      console.log(error);
      setLoginError(CONNECTION_ERROR);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageContainer data-submitting={isSubmitting ? "true" : "false"}>
      <div className="min-h-screen flex flex-col">
        <nav className="flex justify-between items-center p-6">
          <button onClick={() => navigate("/")} className="back-link flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Website
          </button>
        </nav>

        <main className="flex-1 flex items-center justify-center p-4 pb-12">
          <div className="login-card-wrap w-full max-w-[440px]">
            <div className="login-card">
              <div className="login-head">
                <img src={logo} alt="Quran Study Centre Kerala" className="h-16" />
                <span className="login-eyebrow">Admin portal</span>
                <h1 className="login-title">Welcome back</h1>
                <p className="login-subtitle">Sign in to manage Quran Study Centre Kerala.</p>
              </div>

              {loginError && (
                <div className="login-alert" role="alert">
                  <AlertCircle size={18} aria-hidden="true" />
                  <span>{loginError}</span>
                </div>
              )}

              <AutoForm key={`login-form-${isSubmitting}`} useCaptcha={false} formType="post" header="" description="" formValues={formValues} formInput={formInput} submitHandler={submitChange} button={isSubmitting ? "Signing in..." : "Sign in"} isOpen={true} css="plain embed head-hide landing" plainForm={true} customClass="embed" disabled={isSubmitting} />
            </div>
            <p className="login-footnote">Need help signing in? Contact your QSC administrator.</p>
          </div>
        </main>
      </div>
    </PageContainer>
  );
};

export default withLayout(Login);

const cardIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: none;
  }
`;

const spin = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

const PageContainer = styled.div`
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  overflow-x: hidden;
  /* soft blue tint (same family as the public site header) with two faint light pools */
  background:
    radial-gradient(60% 50% at 12% 8%, rgba(59, 111, 240, 0.12) 0%, rgba(59, 111, 240, 0) 70%),
    radial-gradient(55% 45% at 92% 92%, rgba(79, 143, 232, 0.14) 0%, rgba(79, 143, 232, 0) 70%),
    linear-gradient(180deg, #eef3fc 0%, #f8fafd 100%);

  .back-link {
    padding: 8px 12px;
    margin-left: -12px;
    border-radius: 999px;
    transition: background-color 0.2s ease, color 0.2s ease;
  }

  .back-link:hover {
    background: rgba(29, 78, 216, 0.08);
    color: #1d4ed8;
  }

  .login-card-wrap {
    animation: ${cardIn} 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .login-card {
    position: relative;
    background: #ffffff;
    border: 1px solid #dbe5f7;
    border-radius: 20px;
    box-shadow: 0 24px 56px rgba(21, 63, 122, 0.16), 0 4px 12px rgba(21, 63, 122, 0.08);
    padding: 34px 28px 28px;
    overflow: hidden;
  }

  /* accent bar along the top edge, clipped by the card's rounded corners */
  .login-card::before {
    content: "";
    position: absolute;
    inset: 0 0 auto 0;
    height: 4px;
    background: linear-gradient(90deg, #1d4ed8, #4f8fe8);
  }

  .login-head {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 6px;
    margin-bottom: 22px;
  }

  .login-eyebrow {
    margin-top: 10px;
    font-size: 11.5px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #1d4ed8;
  }

  .login-title {
    margin: 0;
    font-size: 26px;
    line-height: 1.2;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: #0f2743;
  }

  .login-subtitle {
    margin: 0;
    font-size: 14.5px;
    line-height: 1.5;
    color: #59718a;
  }

  .login-alert {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin: 0 0 18px;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid rgba(220, 38, 38, 0.22);
    background: rgba(220, 38, 38, 0.06);
    color: #b42318;
    font-size: 14px;
    line-height: 1.45;
    animation: ${cardIn} 0.3s ease both;
  }

  .login-alert svg {
    flex: none;
    margin-top: 1px;
  }

  .login-footnote {
    margin: 18px 0 0;
    text-align: center;
    font-size: 13px;
    color: #6b7f95;
  }

  /* Fields: calmer borders and a clear, smooth focus ring. */
  && label .label {
    font-weight: 600;
    color: #0f2743;
  }

  && input.input {
    min-height: 46px;
    border-radius: 12px;
    border-color: #cfd9ec;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
  }

  /* the leading field icon is placed at a fixed offset for 40px inputs; re-centre it for 46px */
  && div.single > svg {
    top: 36px;
  }

  && input.input:hover {
    border-color: #a9bbdc;
  }

  && input.input:focus,
  && input.input:focus-visible {
    outline: none;
    border-color: #1d4ed8;
    box-shadow: 0 0 0 4px rgba(29, 78, 216, 0.14);
  }

  /* The form footer is a fixed 80px tall, 300px wide with padding; let it hug
     the Sign in button at the full width of the fields so the card ends right
     after it (the card's own padding remains). div only: the button carries
     the same "landing" class. */
  && div.landing {
    height: auto;
    width: 100%;
    padding: 0 !important;
  }

  /* Larger Sign in button with a gentle lift on hover */
  && button.submit {
    position: relative;
    height: 52px;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 700;
    transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
  }

  @media (hover: hover) and (pointer: fine) {
    && button.submit:not(:disabled):hover {
      transform: translateY(-1px);
      box-shadow: 0 14px 28px rgba(29, 78, 216, 0.28);
      filter: brightness(1.04);
    }
  }

  && button.submit:not(:disabled):active {
    transform: scale(0.99);
  }

  /* While signing in: keep the button blue (not the greyed "can't submit yet" look) and spin. */
  &&&[data-submitting="true"] button.submit {
    background: linear-gradient(135deg, #1d4ed8, #3b6ff0) !important;
    color: #ffffff !important;
    opacity: 1 !important;
    cursor: progress;
  }

  &&&[data-submitting="true"] button.submit::before {
    content: "";
    display: inline-block;
    width: 16px;
    height: 16px;
    margin-right: 10px;
    vertical-align: -3px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.45);
    border-top-color: #ffffff;
    animation: ${spin} 0.8s linear infinite;
  }

  @media (max-width: 480px) {
    .login-card {
      padding: 26px 20px 22px;
      border-radius: 18px;
    }

    .login-title {
      font-size: 23px;
    }

    && button.submit {
      height: 54px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .login-card-wrap,
    .login-alert,
    &&&[data-submitting="true"] button.submit::before {
      animation: none;
    }

    .back-link,
    && input.input,
    && button.submit {
      transition: none;
    }
  }
`;
