import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  Building2,
  MapPinned,
  School,
  Users,
} from "lucide-react";
import "./style.css";
import { getData } from "../../../backend/api";
import { normalizeLandingSettings } from "./defaults";

const defaultContent = {
  landingTitle: "Quran Study Centre Kerala",
  landingDescription:
    "Registrations, hall tickets, question papers, results and public information in one clean portal.",
  footerText:
    "A simpler public front door for students, study centres and administrators.",
  image: "",
  landingMainbanner: "",
};

const resolveAssetUrl = (value) => {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `${import.meta.env.VITE_APP_CDN}${value}`;
};

const SUMMARY_ICONS = [MapPinned, Building2, School, Users];

function Hero() {
  const [content, setContent] = useState(defaultContent);
  const [landingSettings, setLandingSettings] = useState(
    normalizeLandingSettings()
  );
  const [loading, setLoading] = useState(true);

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

  const triggerLandingAction = (action) => {
    window.dispatchEvent(
      new CustomEvent("qsc:landing-action", { detail: action })
    );
  };

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

  const heroStats = landingSettings.heroStats.filter(
    (item) => item?.label || item?.value
  );

  const summaryCards = landingSettings.snapshotCards.filter(
    (item) => item?.label || item?.value || item?.description
  );

  const bannerImage = resolveAssetUrl(content.landingMainbanner);
  const profileImage = resolveAssetUrl(content.image);

  return (
    <main className="landing-home">
      <section className="landing-page-shell landing-hero-shell">
        <div className="landing-hero-grid">
          <div className="landing-hero-copy">
            <span className="landing-eyebrow">
              {landingSettings.copy.heroEyebrow}
            </span>
            <h1 className="landing-hero-title">{content.landingTitle}</h1>
            <p className="landing-hero-description">{content.landingDescription}</p>

            <div className="landing-hero-actions">
              {landingSettings.examRegistration && (
                <button
                  type="button"
                  className="landing-chip-button primary"
                  onClick={() => triggerLandingAction("examRegistration")}
                >
                  Open registration
                </button>
              )}
              {landingSettings.verifyRegistration && (
                <button
                  type="button"
                  className="landing-chip-button secondary"
                  onClick={() => triggerLandingAction("verifyRegistration")}
                >
                  Verify Your Registration
                </button>
              )}
              <a href="/admin" className="landing-chip-button secondary">
                Admin panel
              </a>
              {landingSettings.downloads && (
                <a href="/question-papers" className="landing-chip-button subtle">
                  Downloads <ArrowRight size={16} />
                </a>
              )}
            </div>

            <div className="landing-stat-grid">
              {heroStats.map((item, index) => (
                <article key={`${item.label}-${index}`} className="landing-stat-card">
                  <span className="landing-stat-label">{item.label}</span>
                  <strong className="landing-stat-value">{item.value}</strong>
                </article>
              ))}
            </div>
          </div>

          <div className="landing-banner-card">
            {bannerImage ? (
              <img src={bannerImage} alt="QSC public portal banner" />
            ) : (
              <div className="landing-banner-placeholder">
                Public services, district coordination and admin workflows in
                one simple page.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="landing-page-shell landing-section">
        {/* <aside className="landing-admin-note">
          <span>Admin note</span>
          <p>{landingSettings.copy.adminNote}</p>
        </aside> */}

        <div className="landing-visual-stack landing-qr-section">
          <div className="landing-story-card">
            {profileImage && <img src={profileImage} alt="QSC overview" />}
            <div className="landing-story-copy">
              {/* <span>{landingSettings.copy.heroStoryBadge}</span> */}
              <h3>{landingSettings.copy.heroStoryTitle}</h3>
            </div>
          </div>
        </div>
      </section>

      {landingSettings.showPublicSnapshot && summaryCards.length > 0 && (
        <section className="landing-page-shell landing-section landing-section-tight">
          <div className="landing-section-head compact">
            <span className="landing-section-kicker">
              {landingSettings.copy.snapshotKicker}
            </span>
            <h2 className="landing-section-title">
              {landingSettings.copy.snapshotTitle}
            </h2>
            <p className="landing-section-text">
              {loading
                ? "Loading public snapshot..."
                : landingSettings.copy.snapshotDescription}
            </p>
          </div>

          <div className="landing-summary-grid">
            {summaryCards.map((card, index) => {
              const Icon = SUMMARY_ICONS[index % SUMMARY_ICONS.length];
              return (
                <article key={`${card.label}-${index}`} className="landing-summary-card">
                  <span className="landing-action-icon small">
                    <Icon size={18} />
                  </span>
                  <strong>{card.value}</strong>
                  <h3>{card.label}</h3>
                  <p>{card.description}</p>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}

export default Hero;
