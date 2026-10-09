import { useEffect } from "react";

// Per-page search metadata for the public site. Every route is served by the
// same index.html, so each page sets its own title, description and canonical
// URL here (search engines render the page before reading them).
//
// `noindex` is for pages that should stay out of search results (admin and
// student logins). Unlike a robots.txt Disallow, the page can still be
// crawled, so the engine actually sees the instruction and drops the URL.

const SITE_URL = (import.meta.env.VITE_SITE_URL || "").replace(/\/+$/, "");

export const SITE_NAME = "Quran Study Centre Kerala";

const upsertHead = (selector, tag, attrs) => {
  let el = document.head.querySelector(selector);
  const created = !el;
  if (created) {
    el = document.createElement(tag);
    document.head.appendChild(el);
  }
  const previous = {};
  Object.keys(attrs).forEach((key) => {
    previous[key] = el.getAttribute(key);
    el.setAttribute(key, attrs[key]);
  });
  return () => {
    if (created) el.remove();
    else Object.entries(previous).forEach(([key, value]) => (value === null ? el.removeAttribute(key) : el.setAttribute(key, value)));
  };
};

const canonicalUrl = () => {
  const origin = SITE_URL || window.location.origin;
  const path = window.location.pathname.replace(/\/+$/, "");
  return `${origin}${path || "/"}`;
};

export const usePageSeo = ({ title, description, noindex = false } = {}) => {
  useEffect(() => {
    const undo = [];
    const previousTitle = document.title;
    if (title) document.title = title;
    if (description) undo.push(upsertHead('meta[name="description"]', "meta", { name: "description", content: description }));
    if (!noindex) undo.push(upsertHead('link[rel="canonical"]', "link", { rel: "canonical", href: canonicalUrl() }));
    if (noindex) undo.push(upsertHead('meta[name="robots"][data-page-seo]', "meta", { name: "robots", content: "noindex, nofollow", "data-page-seo": "true" }));

    return () => {
      undo.forEach((fn) => fn());
      if (title) document.title = previousTitle;
    };
  }, [title, description, noindex]);
};
