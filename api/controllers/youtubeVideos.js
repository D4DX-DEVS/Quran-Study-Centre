const axios = require("axios");

// Aayath Darse Quran — https://www.youtube.com/@aayathdarsequran
const DEFAULT_CHANNEL_ID = "UCsmJTENBMdUB8ISTkmfZa9A";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

let cache = { channelId: null, videos: null, fetchedAt: 0 };

const decodeEntities = (value = "") =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const parseFeed = (xml) => {
  const entries = xml.split("<entry>").slice(1);

  return entries.map((entry) => {
    const videoId = entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1] || "";
    const title = decodeEntities(entry.match(/<title>(.*?)<\/title>/)?.[1] || "");
    const thumbnail = entry.match(/<media:thumbnail url="(.*?)"/)?.[1] || "";
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
  });
};

// @desc      GET latest videos for a YouTube channel (no API key — public RSS feed)
// @route     GET /api/v1/youtube-videos
// @access    public
exports.getLatestVideos = async (req, res) => {
  try {
    const channelId = req.query.channelId || process.env.YOUTUBE_CHANNEL_ID || DEFAULT_CHANNEL_ID;
    const limit = parseInt(req.query.limit) || 3;

    const isCacheFresh = cache.channelId === channelId && Date.now() - cache.fetchedAt < CACHE_TTL_MS;

    if (!isCacheFresh) {
      const { data: xml } = await axios.get("https://www.youtube.com/feeds/videos.xml", {
        params: { channel_id: channelId },
        timeout: 8000,
      });

      const episodeNumber = (title = "") => {
        const match = title.match(/Episode:\s*(\d+)/i);
        return match ? parseInt(match[1], 10) : null;
      };

      const videos = parseFeed(xml).sort((a, b) => {
        const epA = episodeNumber(a.title);
        const epB = episodeNumber(b.title);
        if (epA !== null && epB !== null && epA !== epB) return epB - epA;
        return new Date(b.publishedAt) - new Date(a.publishedAt);
      });

      cache = { channelId, videos, fetchedAt: Date.now() };
    }

    res.status(200).json({ success: true, response: cache.videos.slice(0, limit) });
  } catch (err) {
    console.log(err);
    res.status(400).json({ success: false, message: err.toString() });
  }
};
