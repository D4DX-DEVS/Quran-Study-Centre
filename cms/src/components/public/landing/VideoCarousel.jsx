import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { VideoCard } from "./VideoCard";

const AUTO_ADVANCE_MS = 6000;

// Cards visible at once — matches the old grid breakpoints (3 / 2 / 1 columns).
const perViewFor = (width) => (width <= 560 ? 1 : width <= 900 ? 2 : 3);

const getPerView = () =>
  typeof window === "undefined" ? 3 : perViewFor(window.innerWidth);

// Auto-rotating strip of channel videos: slides one card every few seconds,
// pauses while the pointer is over it, while a keyboard user is inside it, and
// while a video is playing (sliding away would kill the player).
export default function VideoCarousel({ videos }) {
  const [perView, setPerView] = useState(getPerView);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [playingVideoId, setPlayingVideoId] = useState(null);

  const maxIndex = Math.max(0, videos.length - perView);
  const current = Math.min(index, maxIndex);

  useEffect(() => {
    const handleResize = () => setPerView(getPerView());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Restarts on every index change, so a manual click also resets the wait.
  useEffect(() => {
    if (maxIndex === 0 || paused || playingVideoId) return undefined;
    const timer = setTimeout(
      () => setIndex(current >= maxIndex ? 0 : current + 1),
      AUTO_ADVANCE_MS
    );
    return () => clearTimeout(timer);
  }, [current, maxIndex, paused, playingVideoId]);

  const goTo = (next) => {
    // stop any playing video before it slides out of sight
    setPlayingVideoId(null);
    setIndex(next < 0 ? maxIndex : next > maxIndex ? 0 : next);
  };

  const pauseOnMouse = (event) => event.pointerType === "mouse" && setPaused(true);
  const resumeOnMouse = (event) => event.pointerType === "mouse" && setPaused(false);
  const pauseOnKeyboardFocus = (event) =>
    event.target.matches?.(":focus-visible") && setPaused(true);

  return (
    <div
      className="landing-video-carousel"
      style={{ "--per-view": perView }}
      onPointerEnter={pauseOnMouse}
      onPointerLeave={resumeOnMouse}
      onFocus={pauseOnKeyboardFocus}
      onBlur={() => setPaused(false)}
    >
      <div className="landing-video-carousel-viewport">
        <div
          className="landing-video-carousel-track"
          style={{ "--index": current }}
          aria-live="off"
        >
          {videos.map((video, position) => {
            const visible = position >= current && position < current + perView;
            return (
              <div
                key={video.videoId}
                className="landing-video-carousel-slide"
                aria-hidden={visible ? undefined : true}
                inert={visible ? undefined : ""}
              >
                <VideoCard
                  video={video}
                  reveal={false}
                  playing={playingVideoId === video.videoId}
                  onPlay={() => setPlayingVideoId(video.videoId)}
                />
              </div>
            );
          })}
        </div>
      </div>

      {maxIndex > 0 && (
        <>
          <button
            type="button"
            className="landing-video-carousel-arrow prev"
            onClick={() => goTo(current - 1)}
            aria-label="Previous videos"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            type="button"
            className="landing-video-carousel-arrow next"
            onClick={() => goTo(current + 1)}
            aria-label="Next videos"
          >
            <ChevronRight size={22} />
          </button>
          <div className="landing-video-carousel-dots">
            {Array.from({ length: maxIndex + 1 }, (_, dot) => (
              <button
                key={dot}
                type="button"
                className={`landing-video-carousel-dot${dot === current ? " active" : ""}`}
                onClick={() => goTo(dot)}
                aria-label={`Show videos from ${dot + 1}`}
                aria-current={dot === current ? "true" : undefined}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
