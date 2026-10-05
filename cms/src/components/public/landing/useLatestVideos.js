import { useEffect, useState } from "react";
import { getData } from "../../../backend/api";

const RETRY_DELAY_MS = 3000;

// Latest Aayath Darse Quran episodes from the API (YouTube channel feed).
// status: "loading" → "ready" (videos.length > 0) or "error" after one retry.
export default function useLatestVideos(limit) {
  const [videos, setVideos] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    let retryTimer;

    const load = async (attempt) => {
      const response = await getData({ limit }, "youtube-videos");
      if (cancelled) return;
      const list = response?.data?.response;
      if (Array.isArray(list) && list.length) {
        setVideos(list);
        setStatus("ready");
      } else if (attempt === 0) {
        retryTimer = setTimeout(() => load(1), RETRY_DELAY_MS);
      } else {
        setStatus("error");
      }
    };

    load(0);
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
    };
  }, [limit]);

  return { videos, status };
}
