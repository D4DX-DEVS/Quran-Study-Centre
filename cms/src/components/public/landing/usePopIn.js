import { useEffect, useState } from "react";

// Drives the `.landing-pop-grid` pop-in animation (see style.css): the grid
// renders with data-pop="pending" (children hidden) and flips to "in" the
// first time it scrolls into view, which starts the staggered fade/scale.
// Returns a callback ref — so it still works when the grid mounts later
// (e.g. after a loading state) — and the data-pop value to put on the grid.
export default function usePopIn() {
  const [node, setNode] = useState(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!node || shown) return undefined;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, shown]);

  return [setNode, shown ? "in" : "pending"];
}
