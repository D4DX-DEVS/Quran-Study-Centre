import React, { useState } from "react";
import withLayout from "../../layout";
import Header from "../Header";
import Footer from "../footer/footer";
import "../style.css";
import "./style.css";
import { reveal } from "../scrollReveal";
import useLatestVideos from "../useLatestVideos";
import { VideoCard, VideoCardSkeleton } from "../VideoCard";
import { usePageSeo } from "../../../../utils/seo";

const CHANNEL_URL = "https://www.youtube.com/@aayathdarsequran/streams";

const VideosPage = (props) => {
  const { videos, status } = useLatestVideos(15);
  const [playingVideoId, setPlayingVideoId] = useState(null);

  usePageSeo({ title: "Aayath Darse Quran Videos - Quran Study Centre Kerala", description: "Watch all Aayath Darse Quran videos from Quran Study Centre Kerala." });

  return (
    <>
      <Header {...props} />
      <main className="landing-home">
        <div className="landing-page-shell videos-page-shell">
          <div className="videos-page-head" ref={reveal}>
            <a
              href={CHANNEL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="landing-chip-button primary videos-page-all-link"
            >
              All videos
            </a>
            <h1>Aayath Darse Quran</h1>
            <p>Latest episodes from our YouTube channel</p>
          </div>

          {status === "error" ? (
            <div className="videos-page-empty">
              Videos couldn't load right now.{" "}
              <a href={CHANNEL_URL} target="_blank" rel="noopener noreferrer">
                Watch on YouTube
              </a>
            </div>
          ) : (
            <div className="videos-page-grid">
              {status === "loading"
                ? [0, 1, 2, 3, 4, 5].map((index) => <VideoCardSkeleton key={index} />)
                : videos.map((video) => (
                    <VideoCard
                      key={video.videoId}
                      video={video}
                      playing={playingVideoId === video.videoId}
                      onPlay={() => setPlayingVideoId(video.videoId)}
                    />
                  ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
};

export default withLayout(VideosPage);
