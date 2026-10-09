import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Search-engine files that depend on the public site address. Set
// VITE_SITE_URL (e.g. https://example.org, no trailing slash) for the build
// that serves the public site: it is used for the sitemap, the robots.txt
// Sitemap line and the Organization / WebSite structured data. robots.txt is
// always emitted — without it the SPA fallback answers /robots.txt with the
// app's HTML page.
const PUBLIC_PAGES = ["/", "/about-us", "/syllabus", "/question-papers", "/leadership", "/videos"];

const seoFiles = () => {
  let siteUrl = "";
  return {
    name: "qsc-seo-files",
    configResolved(config) {
      siteUrl = String(config.env.VITE_SITE_URL || "").replace(/\/+$/, "");
    },
    transformIndexHtml(html) {
      if (!siteUrl) return html;
      const structuredData = {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            "@id": `${siteUrl}/#organization`,
            name: "Quran Study Centre Kerala",
            alternateName: ["QSC Kerala", "ഖുർആൻ സ്റ്റഡി സെന്റർ കേരള"],
            url: `${siteUrl}/`,
            logo: `${siteUrl}/logo.png`,
          },
          {
            "@type": "WebSite",
            "@id": `${siteUrl}/#website`,
            url: `${siteUrl}/`,
            name: "Quran Study Centre Kerala",
            alternateName: ["QSC Kerala"],
            publisher: { "@id": `${siteUrl}/#organization` },
          },
        ],
      };
      return html.replace("</head>", `    <meta property="og:url" content="${siteUrl}/" />
    <script type="application/ld+json">${JSON.stringify(structuredData)}</script>
  </head>`);
    },
    generateBundle() {
      // Individual results and certificates never have a URL on this site (they
      // come from the API with noindex headers), so there is nothing private to
      // disallow here; the login pages are kept out with a noindex meta tag
      // instead, which a Disallow rule would stop crawlers from ever seeing.
      const robots = ["User-agent: *", "Allow: /", ...(siteUrl ? ["", `Sitemap: ${siteUrl}/sitemap.xml`] : []), ""].join("\n");
      this.emitFile({ type: "asset", fileName: "robots.txt", source: robots });

      if (siteUrl) {
        const urls = PUBLIC_PAGES.map((page) => `  <url><loc>${siteUrl}${page === "/" ? "/" : page}</loc></url>`).join("\n");
        const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
        this.emitFile({ type: "asset", fileName: "sitemap.xml", source: sitemap });
      }
    },
  };
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    seoFiles(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.svg",
        "apple-touch-icon.png",
        "apple-touch-icon.svg",
        "logo.png",
      ],
      manifest: {
        name: "QSC Automation",
        short_name: "QSC",
        description:
          "Quran Study Centre — registrations, exam hall tickets, results and question papers.",
        theme_color: "#1a4993",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        lang: "en",
        icons: [
          {
            src: "/pwa-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Cache the app shell + built assets. Runtime caching below covers
        // images and API-backed lookups so returning visitors get an instant
        // paint even on flaky mobile networks.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        // App bundle is large; raise the precache size ceiling so the main
        // chunk is allowed in. Keeps offline support usable.
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/_/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            // CDN-served images (banners, question paper PDFs, etc.)
            urlPattern: ({ url }) =>
              /\.(?:png|jpg|jpeg|webp|gif|svg|pdf)$/i.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "qsc-media",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            // Result lookups, certificate PDFs and registration lookups carry a
            // student's personal data: always go to the network and never keep
            // a copy in the visitor's browser cache (it could be read later on
            // a shared device). Must stay ahead of the generic API rule below.
            urlPattern: ({ url }) => /\/api\/v1\/exam-registration\//.test(url.pathname),
            handler: "NetworkOnly",
          },
          {
            // Public GET endpoints (about-us, question papers, results, etc.)
            // are safe to stale-while-revalidate; mutations use POST/PUT.
            urlPattern: ({ url, request }) =>
              request.method === "GET" && /\/api\//.test(url.pathname),
            handler: "NetworkFirst",
            options: {
              cacheName: "qsc-api-get",
              networkTimeoutSeconds: 6,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24,
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//,
            handler: "CacheFirst",
            options: {
              cacheName: "qsc-fonts",
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    port: process.env.PORT || 3000,
    host: "0.0.0.0",
    cors: true,
    hmr: {
      host: process.env.VITE_HMR_HOST || "localhost",
      port: process.env.PORT || 3000,
    },
    watch: {
      usePolling: true,
    },
    allowedHosts: ["*"],
  },
  preview: {
    port: process.env.PORT || 3000,
    host: "0.0.0.0",
    allowedHosts: ["event-hex-saad-vite-mzmxq.ondigitalocean.app"],
  },
  optimizeDeps: {
    exclude: ["js-big-decimal"],
  },
});