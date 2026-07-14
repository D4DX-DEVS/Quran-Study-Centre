import React, { useEffect, useState } from "react";
import { Play } from "lucide-react";
import withLayout from "../../layout";
import Header from "../Header";
import Footer from "../footer/footer";
import { getData } from "../../../../backend/api";
import "../style.css";
import "./style.css";

const VideosPage = (props) => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playingVideoId, setPlayingVideoId] = useState(null);

  useEffect(() => {
    document.title = "Aayath Darse Quran — All Videos";

    let cancelled = false;

    getData({ limit: 15 }, "youtube-videos").then((res) => {
      if (cancelled) return;
      setVideos(res?.data?.response || []);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <Header {...props} />
      <main className="landing-home">
        <div className="landing-page-shell videos-page-shell">
          <div className="videos-page-head">
            <a
              href="https://www.youtube.com/@aayathdarsequran/streams"
              target="_blank"
              rel="noopener noreferrer"
              className="landing-chip-button primary videos-page-all-link"
            >
              All videos
            </a>
            <h1>Aayath Darse Quran</h1>
            <p>Latest episodes from our YouTube channel</p>
          </div>

          {loading ? (
            <div className="videos-page-loading">Loading…</div>
          ) : videos.length ? (
            <div className="videos-page-grid">
              {videos.map((video) => (
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
                  <p className="videos-page-card-title">{video.title}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="videos-page-empty">No videos found.</div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
};

export default withLayout(VideosPage);
