// Scroll reveal for the public site. Put `ref={reveal}` on any element and it
// fades/slides in the first time it scrolls into view (see "Scroll reveal" in
// style.css). Add `data-reveal="video"` for the slower, staggered video-card
// entrance.
//
// - The hidden state is applied from here (data-reveal-state="pending"), so
//   with no JS, no IntersectionObserver or reduced motion the content is
//   simply visible.
// - Each element animates once, then is unobserved.
// - Elements that become visible in the same observer batch are staggered in
//   document order, so a row of cards appears one after another.
// - Being a plain function it keeps one identity across renders, and a ref
//   callback fires on mount, so it works for content that renders late.

const STAGGER_MS = { default: 70, video: 130 };
const MAX_STAGGER_STEPS = 6;

let observer = null;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const show = (el, delayMs = 0) => {
  el.style.setProperty("--reveal-delay", `${delayMs}ms`);
  el.setAttribute("data-reveal-state", "in");
};

const handleIntersections = (entries) => {
  const visible = entries
    .filter((entry) => entry.isIntersecting)
    .map((entry) => entry.target)
    .sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    );

  visible.forEach((el, order) => {
    const step = STAGGER_MS[el.getAttribute("data-reveal")] ?? STAGGER_MS.default;
    show(el, Math.min(order, MAX_STAGGER_STEPS) * step);
    observer.unobserve(el);
  });
};

const getObserver = () => {
  if (!observer) {
    // threshold 0 + a shrunk bottom edge: fires once the top of an element
    // is a little way into the viewport, even for very tall elements.
    observer = new IntersectionObserver(handleIntersections, {
      rootMargin: "0px 0px -8% 0px",
      threshold: 0,
    });
  }
  return observer;
};

export function reveal(el) {
  if (!el || el.hasAttribute("data-reveal-state")) return;
  if (typeof IntersectionObserver === "undefined" || prefersReducedMotion()) return;
  el.setAttribute("data-reveal-state", "pending");
  getObserver().observe(el);
}
