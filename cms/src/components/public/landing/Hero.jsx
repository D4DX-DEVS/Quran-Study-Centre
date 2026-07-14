import React, { useEffect, useState } from "react";
import { Globe, Play } from "lucide-react";
import "./style.css";
import { getData } from "../../../backend/api";
import { normalizeLandingSettings } from "./defaults";
import { thafheem } from "../../project/brand";
import { AppleLogo, PlayStoreLogo, StoreBadge } from "./storeBadges";
import quranHeroPhoto from "./assets/home.png.avif";
import qscLogo from "./assets/qsc-icon-mark.png";
import aayathLogo from "./assets/aayath-logo.png";

const THAFHEEM_LINKS = {
  banner: "https://app.thafheem.net/",
  web: "https://thafheem.net/?lang=mal",
  appStore: "https://apps.apple.com/in/app/thafheemul-quran/id1292572556",
  playStore: "https://play.google.com/store/apps/details?id=com.d4media.thafheem",
};

const defaultContent = {
  landingTitle: "ഖുർആൻ സ്റ്റഡി സെന്റർ കേരള",
  landingDescription:
    "വിശുദ്ധ ഖുർആനെ ആഴത്തിൽ പഠിക്കാം... ജീവിതത്തെ ഖുർആനിന്റെ പ്രകാശത്തിൽ രൂപപ്പെടുത്താം...\n\nകേരളത്തിൽ ഖുർആൻ പഠനരംഗത്ത് കാൽനൂറ്റാണ്ടിലേറെയായി സജീവമായി പ്രവർത്തിച്ചുവരുന്ന പഠനവേദിയാണ് ഖുർആൻ സ്റ്റഡി സെന്റർ കേരള (QSC Kerala).",
  footerText:
    "A simpler public front door for students, study centres and administrators.",
  image: "",
  landingMainbanner: "",
  landingStoryImage: "",
  welcomeEyebrow: "Welcome to",
  welcomeTitleLine1: "Quran Study",
  welcomeTitleHighlight: "Centre Kerala",
  welcomeDescription:
    "A dedicated platform for learning, understanding and living by the Quran. Join our mission to spread Quranic knowledge and build a community of learners.",
  welcomeImage: "",
};

const resolveAssetUrl = (value) => {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `${import.meta.env.VITE_APP_CDN}${value}`;
};

function Hero() {
  const [content, setContent] = useState(defaultContent);
  const [landingSettings, setLandingSettings] = useState(
    normalizeLandingSettings()
  );
  const [loading, setLoading] = useState(true);
  const [introImageFailed, setIntroImageFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadLandingData = async () => {
      try {
        const [aboutResponse, menuResponse] = await Promise.all([
          getData({}, "about-us"),
          getData({}, "floating-menu-settings"),
        ]);

        if (cancelled) return;

        const aboutRow = aboutResponse?.data?.response?.[0] || {};
        const menuRow = menuResponse?.data?.response?.[0] || {};

        setContent((current) => ({ ...current, ...aboutRow }));
        setLandingSettings(normalizeLandingSettings(menuRow));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadLandingData();

    return () => {
      cancelled = true;
    };
  }, []);

  // Don't render the hero copy (English placeholders) until the real content
  // (Malayalam, from the DB) has arrived — otherwise the English defaults
  // flash on screen for a moment before this effect's setContent/setLandingSettings
  // swap them out.
  if (loading) {
    return (
      <main className="landing-home">
        <section className="landing-page-shell landing-hero-shell landing-hero-loading" aria-busy="true" />
      </main>
    );
  }

  const welcomeImage =
    resolveAssetUrl(content.welcomeImage) || quranHeroPhoto;

  const hasIntroSection = Boolean(
    content.landingTitle?.trim() || content.landingDescription?.trim()
  );

  const introBannerUrl = resolveAssetUrl(content.landingMainbanner);
  const showIntroBanner = Boolean(introBannerUrl) && !introImageFailed;
  const introMarkSrc = showIntroBanner ? introBannerUrl : qscLogo;

  return (
    <main className="landing-home">
      {/* ── Welcome hero: copy + Quran photo right ── */}
      <section className="landing-page-shell landing-hero-shell">
        <div className="landing-hero-grid">
          <div className="landing-hero-copy">
            <span className="landing-eyebrow">{content.welcomeEyebrow}</span>
            <h1 className="landing-welcome-title">
              {content.welcomeTitleLine1}{" "}
              <span>{content.welcomeTitleHighlight}</span>
            </h1>
            <p className="landing-hero-description">
              {content.welcomeDescription}
            </p>
          </div>

          <div className="landing-hero-visual">
            <img
              src={welcomeImage}
              alt="Illuminated Holy Quran"
              className="landing-quran-banner"
            />
          </div>
        </div>
      </section>

      {/* ── QSC intro: heading + copy + Read More, logo mark right ── */}
      {hasIntroSection && (
        <section className="landing-page-shell landing-section landing-intro-shell">
          <div className="landing-intro-card">
            <div className="landing-intro-grid">
              <div className="landing-intro-copy">
                {content.landingTitle && (
                  <h2 className="landing-hero-title">{content.landingTitle}</h2>
                )}
                {content.landingDescription &&
                  content.landingDescription.split("\n\n").map((para, index) => (
                    <p className="landing-hero-description" key={index}>
                      {para}
                    </p>
                  ))}
                <div className="landing-hero-actions">
                  <a href="/about-us" className="landing-chip-button primary">
                    Read More
                  </a>
                </div>
              </div>
              <div
                className={`landing-intro-mark${
                  showIntroBanner ? " landing-intro-mark-photo" : ""
                }`}
              >
                <img
                  src={introMarkSrc}
                  alt="Quran Study Centre Kerala"
                  onError={() => setIntroImageFailed(true)}
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── App promo: ready-made Thafheem banner (phone mockups, logo, QR codes) ── */}
      <section className="landing-page-shell landing-section">
        <a
          href={THAFHEEM_LINKS.banner}
          target="_blank"
          rel="noopener noreferrer"
          className="landing-app-banner"
        >
          <img src={thafheem} alt="Thafheem ul Quran — samagramaya Quran app" />
        </a>

        <div className="landing-thafheem-card">
          <div className="landing-thafheem-copy">
            <h3>This exam is entirely based on Thafheemul Quran</h3>
            <p>
              Prepare using the official Thafheem ul Quran app — refer to it for every topic covered in this exam.
            </p>
            <div className="landing-thafheem-actions">
              <StoreBadge
                href={THAFHEEM_LINKS.web}
                icon={<Globe size={22} color="#3BA7FF" />}
                eyebrow="Visit our"
                title="Website"
              />
              <StoreBadge
                href={THAFHEEM_LINKS.appStore}
                icon={<AppleLogo size={22} />}
                eyebrow="Download on the"
                title="App Store"
              />
              <StoreBadge
                href={THAFHEEM_LINKS.playStore}
                icon={<PlayStoreLogo size={22} />}
                eyebrow="GET IT ON"
                title="Google Play"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Aayath Darse Quran videos ── */}
      <section className="landing-page-shell landing-section landing-section-tight">
        <div className="landing-video-head">
          <div className="landing-video-title-group">
            <img src={aayathLogo} alt="Aayath Darse Quran" className="landing-video-logo" />
            <h2 className="landing-section-title">Aayath Darse Quran</h2>
          </div>
          <a href="#aayath-darse-quran" className="landing-chip-button secondary">
            More Videos
          </a>
        </div>
        <div className="landing-video-grid">
          {[0, 1, 2].map((index) => (
            <div key={index} className="landing-video-card">
              <span className="landing-video-play">
                <Play size={22} fill="currentColor" />
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

export default Hero;
