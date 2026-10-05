const axios = require("axios");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Aayath Darse Quran — https://www.youtube.com/@aayathdarsequran
const DEFAULT_CHANNEL_ID = "UCsmJTENBMdUB8ISTkmfZa9A";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
// After a failed refresh, keep serving the last good list and retry this soon.
const RETRY_AFTER_FAILURE_MS = 60 * 1000;
// Last good list is also kept on disk so a restart during a YouTube hiccup
// still has videos to serve.
const DISK_CACHE_FILE = path.join(os.tmpdir(), "qsc-youtube-videos-cache.json");

let cache = { channelId: null, videos: null, fetchedAt: 0 };

const readDiskCache = (channelId) => {
  try {
    const saved = JSON.parse(fs.readFileSync(DISK_CACHE_FILE, "utf8"));
    if (saved.channelId === channelId && Array.isArray(saved.videos) && saved.videos.length) {
      return saved;
    }
  } catch (_) {
    // no saved copy yet
  }
  return null;
};

const writeDiskCache = (entry) => {
  try {
    fs.writeFileSync(DISK_CACHE_FILE, JSON.stringify(entry));
  } catch (err) {
    console.log("youtube-videos: could not save cache", err.message);
  }
};

const decodeEntities = (value = "") =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const parseFeed = (xml) => {
  const entries = xml.split("<entry>").slice(1);

  return entries
    .map((entry) => {
      const videoId = entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1] || "";
      const title = decodeEntities(entry.match(/<title>(.*?)<\/title>/)?.[1] || "")
        .replace(/\s+/g, " ")
        .trim();
      const thumbnail = entry.match(/<media:thumbnail url="(.*?)"/)?.[1] || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      const description = decodeEntities(entry.match(/<media:description>([\s\S]*?)<\/media:description>/)?.[1] || "");
      const publishedAt = entry.match(/<published>(.*?)<\/published>/)?.[1] || "";

      return {
        videoId,
        title,
        thumbnail,
        description,
        publishedAt,
        url: `https://www.youtube.com/watch?v=${videoId}`,
      };
    })
    .filter((video) => video.videoId);
};

const episodeNumber = (title = "") => {
  const match = title.match(/Episode:\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
};

// YouTube's feed occasionally answers with an error, an HTML page or an empty
// feed. Retry once, and treat "no videos" as a failure so it is never cached.
const fetchChannelVideos = async (channelId) => {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { data: xml } = await axios.get("https://www.youtube.com/feeds/videos.xml", {
        params: { channel_id: channelId },
        timeout: 8000,
        responseType: "text",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; QSC-Kerala/1.0)",
          Accept: "application/atom+xml, application/xml;q=0.9, */*;q=0.8",
        },
      });

      const videos = parseFeed(String(xml || ""));
      if (!videos.length) throw new Error("YouTube feed returned no videos");

      return videos.sort((a, b) => {
        const epA = episodeNumber(a.title);
        const epB = episodeNumber(b.title);
        if (epA !== null && epB !== null && epA !== epB) return epB - epA;
        return new Date(b.publishedAt) - new Date(a.publishedAt);
      });
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
};

// @desc      GET latest videos for a YouTube channel (no API key — public RSS feed)
// @route     GET /api/v1/youtube-videos
// @access    public
exports.getLatestVideos = async (req, res) => {
  const channelId = req.query.channelId || process.env.YOUTUBE_CHANNEL_ID || DEFAULT_CHANNEL_ID;
  const limit = parseInt(req.query.limit) || 3;

  if (cache.channelId !== channelId) {
    cache = readDiskCache(channelId) || { channelId, videos: null, fetchedAt: 0 };
  }

  const isCacheFresh = cache.videos && Date.now() - cache.fetchedAt < CACHE_TTL_MS;

  if (!isCacheFresh) {
    try {
      const videos = await fetchChannelVideos(channelId);
      cache = { channelId, videos, fetchedAt: Date.now() };
      writeDiskCache(cache);
    } catch (err) {
      console.log("youtube-videos: feed refresh failed —", err.message);
      if (!cache.videos) {
        return res.status(502).json({ success: false, message: "Could not load videos from YouTube" });
      }
      // Serve the last good list; try YouTube again in a minute.
      cache.fetchedAt = Date.now() - CACHE_TTL_MS + RETRY_AFTER_FAILURE_MS;
    }
  }

  res.status(200).json({ success: true, response: cache.videos.slice(0, limit) });
};
