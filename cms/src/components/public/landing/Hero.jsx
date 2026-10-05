import React, { useEffect, useState } from "react";
import { Globe, ArrowRight } from "lucide-react";
import "./style.css";
import { getData } from "../../../backend/api";
import { normalizeLandingSettings } from "./defaults";
import { thafheem } from "../../project/brand";
import { AppleLogo, PlayStoreLogo, StoreBadge } from "./storeBadges";
import heroScene from "./assets/hero-scene.webp";
import heroCalligraphy from "./assets/hero-calligraphy.svg";
import usePopIn from "./usePopIn";
import useLatestVideos from "./useLatestVideos";
import { VideoCard, VideoCardSkeleton } from "./VideoCard";
import qscLogo from "./assets/qsc-icon-mark.png";
import aayathLogo from "./assets/aayath-logo.png";

// Turn **text** into bold. Used for admin-editable copy (hero, story modal, story card).
const renderBold = (text) =>
  (text || "")
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : (
        part
      )
    );

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

// Welcome hero copy — the hadith that used to be baked into the banner image.
// The Arabic is the original calligraphy traced to SVG (hero-calligraphy.svg);
// `arabic` is its alt text. The Malayalam is live text so it reflows on phones.
const HERO_HADITH = {
  arabic: "خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ",
  malayalam: [
    "നിങ്ങളിൽ ഉത്തമർ ഖുർആൻ പഠിക്കുകയും",
    "പഠിപ്പിക്കുകയും ചെയ്യുന്നവരാണ്",
  ],
  source: "(നബിവചനം)",
};

function WelcomeHero() {
  return (
    <section className="landing-hero-shell landing-hero-full">
      <img
        src={heroScene}
        alt="Open Holy Quran on a wooden rehal with prayer beads"
        className="landing-hero-full-img"
        loading="eager"
        fetchpriority="high"
        decoding="async"
      />
      <figure className="landing-hero-hadith">
        <blockquote>
          <img
            src={heroCalligraphy}
            alt={HERO_HADITH.arabic}
            lang="ar"
            className="landing-hero-hadith-ar"
            loading="eager"
          />
          <p className="landing-hero-hadith-ml" lang="ml">
            {HERO_HADITH.malayalam.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </p>
        </blockquote>
        <figcaption className="landing-hero-hadith-source" lang="ml">
          {HERO_HADITH.source}
        </figcaption>
      </figure>
    </section>
  );
}

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
  const { videos, status: videoStatus } = useLatestVideos(3);
  const [playingVideoId, setPlayingVideoId] = useState(null);
  const [videoGridRef, videoGridPop] = usePopIn();

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

  // The welcome hero is static, so it shows immediately. The DB-driven sections
  // below wait for the real content (Malayalam) — otherwise the English
  // defaults flash on screen before setContent/setLandingSettings swap them out.
  if (loading) {
    return (
      <main className="landing-home" aria-busy="true">
        <WelcomeHero />
      </main>
    );
  }

  const storyImageUrl = resolveAssetUrl(content.landingStoryImage);

  const hasIntroSection = Boolean(
    content.landingTitle?.trim() || content.landingDescription?.trim()
  );

  const introBannerUrl = resolveAssetUrl(content.landingMainbanner);
  const showIntroBanner = Boolean(introBannerUrl) && !introImageFailed;
  const introMarkSrc = showIntroBanner ? introBannerUrl : qscLogo;

  return (
    <main className="landing-home">
      {/* ── Welcome hero: full-width scene + hadith ── */}
      <WelcomeHero />

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
                        {renderBold(landingSettings.copy.heroStoryDescription)}
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
                      {renderBold(para)}
                    </p>
                  ))}
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
              പരീക്ഷ പൂർണമായും തഫ്ഹീമുൽ ഖുർആനെ അടിസ്ഥാനമാക്കിയുള്ളതാണ്. പഠനത്തിനായി
              Thafheemul Quran വെബ്സൈറ്റും Android &amp; iOS മൊബൈൽ ആപ്പുകളും
              ഉപയോഗിക്കാം.
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
        <div
          className="landing-video-grid landing-pop-grid"
          ref={videoGridRef}
          data-pop={videoGridPop}
        >
          {videoStatus === "ready" &&
            videos.map((video, index) => (
              <VideoCard
                key={video.videoId}
                video={video}
                index={index}
                playing={playingVideoId === video.videoId}
                onPlay={() => setPlayingVideoId(video.videoId)}
              />
            ))}
          {videoStatus === "loading" &&
            [0, 1, 2].map((index) => <VideoCardSkeleton key={index} />)}
        </div>
        {videoStatus === "error" && (
          <p className="landing-video-error">
            Videos couldn't load right now.{" "}
            <a href="https://www.youtube.com/@aayathdarsequran/streams" target="_blank" rel="noopener noreferrer">
              Watch on YouTube
            </a>
          </p>
        )}
      </section>
    </main>
  );
}

export default Hero;
