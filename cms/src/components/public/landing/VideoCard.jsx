import React, { useState } from "react";
import { Play } from "lucide-react";

const formatDate = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

// One YouTube episode: thumbnail + play overlay until clicked, then the
// embedded player in place. Shared by the home page and /videos.
export function VideoCard({ video, playing, onPlay, index = 0 }) {
  // feed thumbnails are 4:3 hqdefault; fall back to the always-present
  // 16:9 mqdefault if one ever fails to load
  const [thumb, setThumb] = useState(video.thumbnail || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`);
  const date = formatDate(video.publishedAt);

  return (
    <article className="landing-video-item" style={{ "--pop-i": index }}>
      {playing ? (
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
          onClick={onPlay}
          className="landing-video-card"
          aria-label={`Play: ${video.title}`}
        >
          <img
            src={thumb}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setThumb(`https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`)}
          />
          <span className="landing-video-play" aria-hidden="true">
            <Play size={20} fill="currentColor" />
          </span>
        </button>
      )}
      <h3 className="landing-video-title" title={video.title}>
        {video.title}
      </h3>
      {date && (
        <time className="landing-video-date" dateTime={video.publishedAt}>
          {date}
        </time>
      )}
    </article>
  );
}

// Shimmer placeholder shown only while the list is loading.
export function VideoCardSkeleton() {
  return (
    <div className="landing-video-item landing-video-skeleton" aria-hidden="true">
      <div className="landing-video-card" />
      <span className="landing-video-skeleton-line" />
      <span className="landing-video-skeleton-line short" />
    </div>
  );
}
