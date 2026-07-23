import React, { useEffect, useState } from "react";
import { Globe, Play, ArrowRight } from "lucide-react";
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
  const [videos, setVideos] = useState([]);
  const [playingVideoId, setPlayingVideoId] = useState(null);
  const [showWelcomeStory, setShowWelcomeStory] = useState(false);

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

    const loadVideos = async () => {
      const videoResponse = await getData({ limit: 3 }, "youtube-videos");
      if (cancelled) return;
      setVideos(videoResponse?.data?.response || []);
    };

    loadLandingData();
    loadVideos();

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
  const storyImageUrl = resolveAssetUrl(content.landingStoryImage);

  const hasIntroSection = Boolean(
    content.landingTitle?.trim() || content.landingDescription?.trim()
  );

  const introBannerUrl = resolveAssetUrl(content.landingMainbanner);
  const showIntroBanner = Boolean(introBannerUrl) && !introImageFailed;
  const introMarkSrc = showIntroBanner ? introBannerUrl : qscLogo;

  const welcomeParagraphs = (content.welcomeDescription || "")
    .split("\n\n")
    .map((para) => para.trim())
    .filter(Boolean);
  const welcomeFirstParagraph = welcomeParagraphs[0] || "";
  const hasMoreWelcomeStory = welcomeParagraphs.length > 1;

  return (
    <main className="landing-home">
      {/* ── Welcome hero: copy + Quran photo right ── */}
      <section className="landing-page-shell landing-hero-shell">
        <div className="landing-hero-grid">
          <div className="landing-hero-copy">
            <h1 className="landing-welcome-title">
              {content.welcomeTitleLine1}{" "}
              <span>{content.welcomeTitleHighlight}</span>
            </h1>
            <p className="landing-hero-description">
              {welcomeFirstParagraph}
            </p>
            {hasMoreWelcomeStory && (
              <button
                type="button"
                className="landing-hero-readmore"
                onClick={() => setShowWelcomeStory(true)}
              >
                Read more
              </button>
            )}
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

      {showWelcomeStory && (
        <div
          className="landing-modal-backdrop"
          onClick={() => setShowWelcomeStory(false)}
        >
          <div
            className="landing-modal-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="help-content">
              <h3 className="landing-welcome-story-title">
                {content.welcomeTitleLine1}
                <span>{content.welcomeTitleHighlight}</span>
              </h3>
              {welcomeParagraphs.map((para, index) => (
                <p key={index}>{para}</p>
              ))}
              <button
                type="button"
                className="landing-help-close"
                onClick={() => setShowWelcomeStory(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Hero highlights: eyebrow + story card + stat numbers, admin-controlled ── */}
      {(landingSettings.copy.heroEyebrow ||
        landingSettings.copy.heroStoryTitle ||
        landingSettings.copy.heroStoryDescription ||
        landingSettings.heroStats.some((stat) => stat.value)) && (
        <section className="landing-page-shell landing-section landing-highlights-shell">
          {landingSettings.copy.heroEyebrow && (
            <span className="landing-eyebrow">{landingSettings.copy.heroEyebrow}</span>
          )}
          <div className="landing-highlights-grid">
            {(landingSettings.copy.heroStoryBadge ||
              landingSettings.copy.heroStoryTitle ||
              landingSettings.copy.heroStoryDescription) && (
              <div className="landing-story-card">
                {landingSettings.copy.heroStoryBadge && (
                  <span className="landing-story-badge">
                    {landingSettings.copy.heroStoryBadge}
                  </span>
                )}
                <div
                  className={`landing-story-card-grid${
                    storyImageUrl ? "" : " landing-story-card-grid-full"
                  }`}
                >
                  <div className="landing-story-card-copy">
                    {landingSettings.copy.heroStoryTitle && (
                      <h2 className="landing-section-title">
                        {landingSettings.copy.heroStoryTitle}
                      </h2>
                    )}
                    {landingSettings.copy.heroStoryDescription && (
                      <p className="landing-hero-description">
                        {landingSettings.copy.heroStoryDescription}
                      </p>
                    )}
                  </div>
                  {storyImageUrl && (
                    <div className="landing-story-card-visual">
                      <img src={storyImageUrl} alt="" />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="landing-stats-grid">
              {landingSettings.heroStats
                .filter((stat) => stat.value || stat.label)
                .map((stat, index) => (
                  <div className="landing-stat-card" key={`hero-stat-${index}`}>
                    <span className="landing-stat-value">{stat.value}</span>
                    <span className="landing-stat-label">{stat.label}</span>
                  </div>
                ))}
            </div>
          </div>
        </section>
      )}

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
            <p className="landing-thafheem-malayalam">
              ഈ പരീക്ഷ പൂർണമായും തഫ്ഹീമുൽ ഖുർആനെ അടിസ്ഥാനമാക്കിയുള്ളതാണ്. പഠനത്തിനായി
              Thafheemul Quran വെബ്സൈറ്റും Android &amp; iOS മൊബൈൽ ആപ്പുകളും
              ഉപയോഗിക്കാവുന്നതാണ്. ഈ ഡിജിറ്റൽ പ്ലാറ്റ്ഫോമുകളിൽ ഖുർആൻ, വിവർത്തനം,
              തഫ്സീർ, പഠനസഹായികൾ എന്നിവ ലഭ്യമാണ്.
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
          <a
            href="/videos"
            className="landing-chip-button secondary landing-more-videos"
            aria-label="More Videos"
          >
            <span className="landing-more-videos-text">More Videos</span>
            <ArrowRight size={18} className="landing-more-videos-arrow" />
          </a>
        </div>
        <div className="landing-video-grid">
          {(videos.length ? videos : [0, 1, 2]).map((video, index) =>
            video?.videoId ? (
              <div key={video.videoId}>
                {playingVideoId === video.videoId ? (
                  <div className="landing-video-card landing-video-card-playing">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${video.videoId}?autoplay=1`}
                      title={video.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      frameBorder="0"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPlayingVideoId(video.videoId)}
                    className="landing-video-card"
                    title={video.title}
                  >
                    <img src={video.thumbnail} alt={video.title} loading="lazy" />
                    <span className="landing-video-play">
                      <Play size={22} fill="currentColor" />
                    </span>
                  </button>
                )}
                <p className="landing-video-title">{video.title}</p>
              </div>
            ) : (
              <div key={index} className="landing-video-card">
                <span className="landing-video-play">
                  <Play size={22} fill="currentColor" />
                </span>
              </div>
            )
          )}
        </div>
      </section>
    </main>
  );
}

export default Hero;
