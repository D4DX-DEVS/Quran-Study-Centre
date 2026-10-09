import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { clearLoginSession, fetchLogin } from "../../../store/actions/login";
import withLayout from "../layout";
import { AlertCircle, ArrowLeft, Eye, EyeOff, Lock, Mail } from "lucide-react";
import styled, { keyframes } from "styled-components";
import { postData } from "../../../backend/api";
import { getDefaultMenuPath } from "../../../menuSections";
import { usePageSeo } from "../../../utils/seo";
// Existing brand assets: white logo (as used in the admin sidebar), compact colour mark, and the
// calligraphy / Quran scene already used on the public home page.
import whiteLogo from "../../project/brand/logo.png";
import brandMark from "../landing/assets/qsc-icon-mark.png";
import heroScene from "../landing/assets/hero-scene.webp";
import heroCalligraphy from "../landing/assets/hero-calligraphy.svg";

// Same rules the shared form engine enforced for this screen (email: required,
// 5-40 characters, standard address pattern; password: required), now applied here.
const EMAIL_PATTERN = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;
const EMAIL_MIN = 5;
const EMAIL_MAX = 40;

const validateEmail = (value) => {
  if (!value) return "Email address is required.";
  if (value.length < EMAIL_MIN || !EMAIL_PATTERN.test(value)) return "Please provide a valid email address.";
  return "";
};
const validatePassword = (value) => (value ? "" : "Password is required.");

const CONNECTION_ERROR = "We couldn't reach the server. Please check your connection and try again.";

// The API answers a failed login with a plain message; show it in friendly words.
const friendlyLoginError = (message) => {
  const text = String(message || "");
  if (/no user found/i.test(text)) return "We couldn't find an account with that email address. Please check it and try again.";
  if (/wrong password|incorrect password/i.test(text)) return "That password is incorrect. Please try again.";
  if (!text || /unexpected response|validationfailed|something went wrong/i.test(text)) return "We couldn't sign you in. Please check your details and try again.";
  return text;
};

// Same typefaces as the public site (headings: Fraunces, text: Manrope).
const FONT_HREF = "https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600&family=Manrope:wght@400;500;600;700&display=swap";

export const Login = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.login);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState("");
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const submitLock = useRef(false);

  usePageSeo({ title: "QSC System", noindex: true });

  const emailError = touched.email ? validateEmail(email) : "";
  const passwordError = touched.password ? validatePassword(password) : "";

  useEffect(() => {
    if (document.querySelector(`link[href="${FONT_HREF}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONT_HREF;
    document.head.appendChild(link);
  }, []);

  // Land on the email field on desktop; skip it on touch devices so the keyboard does not pop up.
  useEffect(() => {
    if (window.matchMedia?.("(pointer: fine)").matches) emailRef.current?.focus();
  }, []);

  useEffect(() => {
    if (user.data?.token) {
      navigate(getDefaultMenuPath(user.data?.menu ?? []), { replace: true });
      return;
    }

    if (user.error !== null) {
      setLoginError(friendlyLoginError(user.error));
      setPassword("");
      setTouched((current) => ({ ...current, password: false }));
      dispatch(clearLoginSession());
    }
  }, [user.data?.token, user.data?.menu, user.error, navigate, dispatch]);

  // After a failed attempt, once the fields are enabled again, put the cursor back in the password field.
  useEffect(() => {
    if (!isSubmitting && loginError) passwordRef.current?.focus();
  }, [isSubmitting, loginError]);

  const submitChange = async (post) => {
    setIsSubmitting(true);
    try {
      const response = await postData(post, "auth/login");
      if (response.status === 200) {
        dispatch(fetchLogin(post, response));
      } else {
        setLoginError(CONNECTION_ERROR);
        setPassword("");
      }
    } catch (error) {
      console.log(error);
      setLoginError(CONNECTION_ERROR);
      setPassword("");
    } finally {
      setIsSubmitting(false);
      submitLock.current = false;
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (submitLock.current) return; // a request is already running
    setTouched({ email: true, password: true });

    const emailProblem = validateEmail(email);
    const passwordProblem = validatePassword(password);
    if (emailProblem || passwordProblem) {
      (emailProblem ? emailRef : passwordRef).current?.focus();
      return;
    }

    submitLock.current = true;
    setLoginError("");
    submitChange({ email, password });
  };

  return (
    <Page $scene={heroScene} $calligraphy={heroCalligraphy}>
      {/* ---------- brand side ---------- */}
      <section className="login-brand">
        <div className="brand-layer brand-scene" aria-hidden="true" />
        <div className="brand-layer brand-pattern" aria-hidden="true" />
        <div className="brand-calligraphy" aria-hidden="true" />

        <div className="brand-inner">
          <div className="brand-head">
            <img src={whiteLogo} alt="Quran Study Centre Kerala" className="brand-logo" />
            <span className="brand-tag">Admin workspace</span>
          </div>

          <div className="brand-copy">
            <span className="brand-eyebrow">Admin workspace</span>
            <h2 className="brand-title">
              Welcome to <span>QSC Kerala</span>
            </h2>
            <p className="brand-text">Manage examinations, student records, certificates, and educational resources through one centralized platform.</p>
          </div>

          <p className="brand-quote">
            “And We have certainly made the Quran easy for remembrance.”
            <cite>Quran 54:17</cite>
          </p>
        </div>
      </section>

      {/* ---------- sign-in side ---------- */}
      <section className="login-panel">
        <div className="panel-top">
          <button type="button" onClick={() => navigate("/")} className="back-link">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to Website
          </button>
        </div>

        <main className="panel-main">
          <div className="form-wrap">
            <img src={brandMark} alt="" className="form-mark" aria-hidden="true" />
            <h1 className="form-title">Welcome Back</h1>
            <p className="form-subtitle">Sign in to access your admin workspace.</p>

            {loginError && (
              <div className="login-alert" role="alert">
                <AlertCircle size={18} aria-hidden="true" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="field">
                <label htmlFor="login-email">Email address</label>
                <div className="control">
                  <Mail size={18} className="lead-icon" aria-hidden="true" />
                  <input
                    ref={emailRef}
                    id="login-email"
                    name="email"
                    type="text"
                    inputMode="email"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="you@example.com"
                    maxLength={EMAIL_MAX}
                    value={email}
                    disabled={isSubmitting}
                    aria-invalid={emailError ? "true" : "false"}
                    aria-describedby={emailError ? "login-email-error" : undefined}
                    onChange={(event) => setEmail(event.target.value)}
                    onBlur={() => setTouched((current) => ({ ...current, email: true }))}
                  />
                </div>
                {emailError && (
                  <p id="login-email-error" className="field-error">
                    {emailError}
                  </p>
                )}
              </div>

              <div className="field">
                <label htmlFor="login-password">Password</label>
                <div className="control">
                  <Lock size={18} className="lead-icon" aria-hidden="true" />
                  <input
                    ref={passwordRef}
                    id="login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    disabled={isSubmitting}
                    aria-invalid={passwordError ? "true" : "false"}
                    aria-describedby={passwordError ? "login-password-error" : undefined}
                    onChange={(event) => setPassword(event.target.value)}
                    onBlur={() => setTouched((current) => ({ ...current, password: true }))}
                  />
                  <button type="button" className="toggle" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>
                    {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                </div>
                {passwordError && (
                  <p id="login-password-error" className="field-error">
                    {passwordError}
                  </p>
                )}
              </div>

              <button type="submit" className="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
                {isSubmitting && <span className="spinner" aria-hidden="true" />}
                {isSubmitting ? "Signing in…" : "Sign In"}
              </button>
            </form>
          </div>
        </main>

        <footer className="panel-footer">Quran Study Centre Kerala</footer>
      </section>
    </Page>
  );
};

export default withLayout(Login);

const rise = keyframes`
  from {
    opacity: 0;
    transform: translateY(10px);
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

// Eight-pointed star lattice (two overlapping squares per tile) — a quiet Islamic geometric texture.
const STAR_TILE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='1'%3E%3Crect x='24' y='24' width='48' height='48'/%3E%3Crect x='24' y='24' width='48' height='48' transform='rotate(45 48 48)'/%3E%3Cpath d='M48 0v14M48 82v14M0 48h14M82 48h14'/%3E%3C/g%3E%3C/svg%3E")`;

const Page = styled.div`
  --navy-950: #061733;
  --navy-800: #0b2f66;
  --teal-600: #0b6e7f;
  --teal-300: #7fd6cd;
  --blue: #1745a8;
  --blue-dark: #12378a;
  --ink: #0f2743;
  --muted: #5b6b82;
  --line: #d6dfee;
  --danger: #b42318;

  display: grid;
  grid-template-columns: 58fr 42fr;
  min-height: 100vh;
  min-height: 100dvh;
  /* clip sideways bleed of the decorative layers without turning the page into its own scroll area
     (so the browser can still scroll the form into view when the on-screen keyboard opens) */
  overflow-x: hidden;
  overflow-x: clip;
  font-family: "Manrope", "Inter", system-ui, sans-serif;
  color: var(--ink);
  background: #ffffff;

  /* ===================== brand side ===================== */
  .login-brand {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    color: #ffffff;
    background:
      radial-gradient(70% 55% at 8% 0%, rgba(59, 130, 246, 0.28) 0%, rgba(59, 130, 246, 0) 70%),
      radial-gradient(65% 55% at 92% 100%, rgba(20, 184, 166, 0.32) 0%, rgba(20, 184, 166, 0) 70%),
      linear-gradient(145deg, var(--navy-950) 0%, var(--navy-800) 48%, var(--teal-600) 120%);
  }

  .brand-layer {
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
  }

  /* the home-page Quran scene, tinted into the palette and faded toward the text side */
  .brand-scene {
    background: url(${(props) => props.$scene}) 80% 62% / cover no-repeat;
    mix-blend-mode: luminosity;
    opacity: 0.42;
    -webkit-mask-image: linear-gradient(to left, #000 8%, rgba(0, 0, 0, 0.55) 45%, transparent 92%);
    mask-image: linear-gradient(to left, #000 8%, rgba(0, 0, 0, 0.55) 45%, transparent 92%);
  }

  .brand-pattern {
    background-image: ${STAR_TILE};
    background-size: 96px 96px;
    opacity: 0.09;
    -webkit-mask-image: radial-gradient(120% 90% at 0% 100%, #000 0%, transparent 72%);
    mask-image: radial-gradient(120% 90% at 0% 100%, #000 0%, transparent 72%);
  }

  .brand-calligraphy {
    position: absolute;
    z-index: -1;
    right: -3%;
    top: 10%;
    width: min(70%, 520px);
    aspect-ratio: 466 / 101;
    background: url(${(props) => props.$calligraphy}) center / contain no-repeat;
    filter: brightness(0) invert(1);
    opacity: 0.07;
    pointer-events: none;
  }

  .brand-head {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  /* only shown on phones, where the long brand copy is left out */
  .brand-tag {
    display: none;
    font-size: 11.5px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--teal-300);
  }

  .brand-inner {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 40px;
    min-height: 100%;
    padding: 48px clamp(40px, 6vw, 88px) 44px;
  }

  .brand-logo {
    height: 46px;
    width: auto;
    align-self: flex-start;
  }

  .brand-copy {
    max-width: 520px;
    animation: ${rise} 0.6s ease both;
  }

  .brand-eyebrow {
    display: inline-block;
    margin-bottom: 18px;
    padding-left: 34px;
    position: relative;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--teal-300);
  }

  .brand-eyebrow::before {
    content: "";
    position: absolute;
    left: 0;
    top: 50%;
    width: 22px;
    height: 1px;
    background: var(--teal-300);
  }

  .brand-title {
    margin: 0 0 20px;
    font-family: "Fraunces", Georgia, serif;
    font-size: clamp(2.3rem, 3.6vw, 3.6rem);
    line-height: 1.08;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: #ffffff;
  }

  .brand-title span {
    display: block;
    color: #bfeee9;
  }

  .brand-text {
    margin: 0;
    max-width: 440px;
    font-size: 16.5px;
    line-height: 1.7;
    color: rgba(255, 255, 255, 0.78);
  }

  .brand-quote {
    margin: 0;
    max-width: 380px;
    padding-top: 18px;
    border-top: 1px solid rgba(255, 255, 255, 0.16);
    font-family: "Fraunces", Georgia, serif;
    font-style: italic;
    font-size: 14.5px;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.66);
  }

  .brand-quote cite {
    display: block;
    margin-top: 6px;
    font-family: "Manrope", sans-serif;
    font-style: normal;
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.48);
  }

  /* ===================== sign-in side ===================== */
  .login-panel {
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    min-height: 100dvh;
    /* soft tinted ground so the white login card reads as a card */
    background: radial-gradient(520px 320px at 100% 0%, #e6eefc 0%, rgba(230, 238, 252, 0) 100%), #f3f6fb;
  }

  .panel-top {
    padding: 22px 28px 0;
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    margin-left: -12px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .back-link:hover {
    background: #eef3fc;
    color: var(--blue);
  }

  .panel-main {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px clamp(24px, 5vw, 64px);
  }

  /* the login card */
  .form-wrap {
    width: 100%;
    max-width: 440px;
    padding: 36px 36px 34px;
    border: 1px solid #e1e8f3;
    border-radius: 20px;
    background: #ffffff;
    box-shadow: 0 1px 2px rgba(15, 39, 67, 0.05), 0 18px 40px -18px rgba(15, 39, 67, 0.2);
    animation: ${rise} 0.45s ease both;
  }

  .form-mark {
    display: block;
    width: 46px;
    height: auto;
    margin-bottom: 22px;
  }

  .form-title {
    margin: 0;
    font-family: "Fraunces", Georgia, serif;
    font-size: 2rem;
    line-height: 1.15;
    font-weight: 600;
    letter-spacing: -0.015em;
    color: var(--ink);
  }

  .form-subtitle {
    margin: 8px 0 28px;
    font-size: 15px;
    line-height: 1.5;
    color: var(--muted);
  }

  .login-alert {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 22px;
    padding: 12px 14px;
    border: 1px solid #f4c7c3;
    border-radius: 10px;
    background: #fef3f2;
    color: var(--danger);
    font-size: 14px;
    line-height: 1.45;
  }

  .login-alert svg {
    flex: none;
    margin-top: 1px;
  }

  .login-alert span,
  .field-error {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .field {
    margin-bottom: 20px;
  }

  .field label {
    display: block;
    margin-bottom: 7px;
    font-size: 13.5px;
    font-weight: 600;
    color: #1f3047;
  }

  .control {
    position: relative;
  }

  .control input {
    width: 100%;
    height: 48px;
    /* when the keyboard opens, scroll the field into view with room left for the button below it */
    scroll-margin: 80px 0 140px;
    padding: 0 14px 0 44px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: #ffffff;
    color: var(--ink);
    font: inherit;
    font-size: 15px;
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .control input::placeholder {
    color: #8a97ab;
  }

  .control input:hover:not(:disabled) {
    border-color: #b4c2dc;
  }

  .control input:focus {
    border-color: var(--blue);
    box-shadow: 0 0 0 3px rgba(23, 69, 168, 0.16);
  }

  .control input[aria-invalid="true"] {
    border-color: #e5645a;
  }

  .control input[aria-invalid="true"]:focus {
    box-shadow: 0 0 0 3px rgba(229, 100, 90, 0.18);
  }

  .control input:disabled {
    background: #f6f8fc;
    color: #6b7a90;
    cursor: not-allowed;
  }

  .control input[name="password"] {
    padding-right: 48px;
  }

  .lead-icon {
    position: absolute;
    left: 15px;
    top: 50%;
    transform: translateY(-50%);
    color: #8a97ab;
    pointer-events: none;
    transition: color 0.15s ease;
  }

  .control:focus-within .lead-icon {
    color: var(--teal-600);
  }

  .toggle {
    position: absolute;
    right: 7px;
    top: 50%;
    transform: translateY(-50%);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: #6b7a90;
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .toggle:hover {
    background: #eef3fc;
    color: var(--blue);
  }

  .toggle:focus-visible {
    outline: 2px solid var(--blue);
    outline-offset: 1px;
  }

  .field-error {
    margin: 7px 0 0;
    font-size: 13px;
    line-height: 1.4;
    color: var(--danger);
  }

  .submit {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    white-space: nowrap;
    scroll-margin-bottom: 24px;
    width: 100%;
    height: 50px;
    margin-top: 8px;
    border: 0;
    border-radius: 10px;
    background: linear-gradient(180deg, #1c4fb8 0%, var(--blue) 100%);
    color: #ffffff;
    font: inherit;
    font-size: 15.5px;
    font-weight: 700;
    letter-spacing: 0.01em;
    cursor: pointer;
    box-shadow: 0 8px 18px -8px rgba(23, 69, 168, 0.65);
    transition: background-color 0.15s ease, box-shadow 0.2s ease, transform 0.15s ease;
  }

  .submit:hover:not(:disabled) {
    background: linear-gradient(180deg, #1a47a3 0%, var(--blue-dark) 100%);
    box-shadow: 0 12px 22px -8px rgba(23, 69, 168, 0.7);
    transform: translateY(-1px);
  }

  .submit:active:not(:disabled) {
    transform: none;
  }

  .submit:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(23, 69, 168, 0.32);
  }

  .submit:disabled {
    cursor: progress;
    opacity: 0.88;
  }

  .spinner {
    flex: none;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.4);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: ${spin} 0.8s linear infinite;
  }

  .panel-footer {
    padding: 0 24px 26px;
    text-align: center;
    font-size: 13px;
    letter-spacing: 0.02em;
    color: #7b8aa0;
  }

  /* ===================== tablet (768 - 1023px): both sections stay side by side ===================== */
  @media (max-width: 1023px) {
    grid-template-columns: 44fr 56fr;

    .brand-inner {
      padding: 36px 32px;
      gap: 28px;
    }

    .brand-logo {
      height: 40px;
    }

    .brand-title {
      font-size: clamp(1.85rem, 3.8vw, 2.4rem);
    }

    .brand-text {
      font-size: 15px;
      line-height: 1.65;
    }

    .brand-quote,
    .brand-calligraphy {
      display: none;
    }

    /* narrower login column: a little less card padding so the fields keep their width */
    .form-wrap {
      padding: 30px 28px 28px;
    }
  }

  /* any touch screen (tablets included): 44px tap targets */
  @media (pointer: coarse) {
    .back-link {
      min-height: 44px;
    }

    .toggle {
      width: 44px;
      height: 44px;
      right: 2px;
    }

    .control input[name="password"] {
      padding-right: 50px;
    }
  }

  /* short landscape screens (phones turned sideways): tighten so nothing is cut off */
  @media (min-width: 768px) and (max-height: 520px) {
    .brand-inner {
      padding: 24px 28px;
      gap: 16px;
    }

    .brand-title {
      font-size: 1.7rem;
      margin-bottom: 10px;
    }

    .brand-text,
    .brand-quote {
      display: none;
    }

    .form-mark {
      display: none;
    }

    .form-wrap {
      padding: 22px 30px 24px;
    }

    .form-subtitle {
      margin-bottom: 18px;
    }
  }

  /* ===================== phones (up to 767px): compact brand band + login card ===================== */
  @media (max-width: 767px) {
    display: flex;
    flex-direction: column;
    background: linear-gradient(145deg, var(--navy-950) 0%, var(--navy-800) 55%, var(--teal-600) 130%);

    /* compact on short phones; on taller ones the band takes most of the spare height (capped), so the
       card never floats above a big empty area */
    .login-brand {
      flex: 3 1 auto;
      max-height: 40vh;
      max-height: 40dvh;
    }

    .brand-inner {
      min-height: 0;
      padding: calc(24px + env(safe-area-inset-top, 0px)) 24px 26px;
      gap: 0;
    }

    .brand-logo {
      height: 38px;
    }

    .brand-tag {
      display: block;
    }

    .brand-copy,
    .brand-quote,
    .brand-calligraphy {
      display: none;
    }

    .brand-pattern {
      opacity: 0.12;
      -webkit-mask-image: radial-gradient(120% 140% at 100% 0%, #000 0%, transparent 70%);
      mask-image: radial-gradient(120% 140% at 100% 0%, #000 0%, transparent 70%);
    }

    /* tinted area under the brand band; the white login card sits on it */
    .login-panel {
      flex: 1 0 auto;
      min-height: 0;
    }

    .panel-top {
      padding: 6px 12px 0 20px;
    }

    /* 44px tap target */
    .back-link {
      min-height: 44px;
    }

    /* top-aligned, with a modest lift that scales with screen height; the footer stays at the bottom */
    .panel-main {
      align-items: center;
      padding: 2px 16px 20px;
    }

    .form-wrap {
      max-width: 440px;
      padding: 26px 22px 24px;
      border-radius: 18px;
      animation-duration: 0.25s;
    }

    .form-mark {
      display: none;
    }

    .form-title {
      font-size: 1.75rem;
    }

    .form-subtitle {
      margin: 6px 0 22px;
      font-size: 14.5px;
    }

    .field {
      margin-bottom: 18px;
    }

    /* 16px text stops iOS from zooming in when a field is focused */
    .control input {
      font-size: 16px;
    }

    /* 44px tap target inside the 48px field */
    .toggle {
      width: 44px;
      height: 44px;
      right: 2px;
    }

    .control input[name="password"] {
      padding-right: 50px;
    }

    .panel-footer {
      padding: 0 20px calc(18px + env(safe-area-inset-bottom, 0px));
    }
  }

  /* large phones (481 - 767px): more air, form kept to a comfortable width */
  @media (min-width: 481px) and (max-width: 767px) {
    .brand-inner {
      padding: calc(30px + env(safe-area-inset-top, 0px)) 40px 32px;
    }

    .brand-logo {
      height: 44px;
    }

    .panel-top {
      padding-left: 36px;
    }

    .panel-main {
      padding: 4px 36px 28px;
    }

    .form-wrap {
      padding: 32px 30px 30px;
    }

    .form-title {
      font-size: 2rem;
    }
  }

  /* standard phones (375 - 480px) */
  @media (min-width: 375px) and (max-width: 480px) {
    .form-title {
      font-size: 1.75rem;
    }
  }

  /* small phones (320 - 374px): slimmer padding, slightly smaller type */
  @media (max-width: 374px) {
    .brand-inner {
      padding: calc(20px + env(safe-area-inset-top, 0px)) 16px 22px;
    }

    .brand-logo {
      height: 34px;
    }

    .panel-top {
      padding: 4px 8px 0 14px;
    }

    .panel-main {
      padding: 0 12px 16px;
    }

    .form-wrap {
      padding: 22px 18px 20px;
      border-radius: 16px;
    }

    .form-title {
      font-size: 1.5rem;
    }

    .form-subtitle {
      font-size: 14px;
      margin-bottom: 18px;
    }

    .field {
      margin-bottom: 16px;
    }

    .field label {
      font-size: 13px;
    }

    .login-alert {
      padding: 10px 12px;
      font-size: 13.5px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .brand-copy,
    .form-wrap,
    .spinner {
      animation: none;
    }

    .back-link,
    .control input,
    .lead-icon,
    .toggle,
    .submit {
      transition: none;
    }

    .submit:hover:not(:disabled) {
      transform: none;
    }
  }
`;
