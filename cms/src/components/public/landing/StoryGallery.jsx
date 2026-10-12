import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { reveal } from "./scrollReveal";

const AUTO_ADVANCE_MS = 3500;
const SWIPE_MIN_PX = 40;

const wrap = (index, count) => (index + count) % count;

// Horizontal swipe for touch screens. A vertical drag is left to the page scroll.
const useSwipe = (onPrev, onNext) => {
  const start = useRef(null);
  return {
    onTouchStart: (event) => {
      const touch = event.touches[0];
      start.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
    },
    onTouchEnd: (event) => {
      const from = start.current;
      const touch = event.changedTouches[0];
      start.current = null;
      if (!from || !touch) return;
      const dx = touch.clientX - from.x;
      const dy = touch.clientY - from.y;
      if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy)) return;
      if (dx > 0) onPrev();
      else onNext();
    },
  };
};

// Full-screen viewer. Shares its index with the gallery, so closing it leaves
// the gallery on the image the visitor was last looking at.
function StoryLightbox({ images, index, label, onIndex, onClose }) {
  const count = images.length;
  const many = count > 1;
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const pressedBackdrop = useRef(false);

  const goPrev = useCallback(() => onIndex(wrap(index - 1, count)), [index, count, onIndex]);
  const goNext = useCallback(() => onIndex(wrap(index + 1, count)), [index, count, onIndex]);
  const swipe = useSwipe(many ? goPrev : () => {}, many ? goNext : () => {});

  // Lock page scroll while open (keeping the layout from jumping when the
  // scrollbar disappears) and give focus back to the thumbnail on close.
  // <html> is locked too: the site sets `overflow-x: hidden` on it, so a lock
  // on <body> alone is not propagated to the viewport and the page still scrolls.
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const root = document.documentElement;
    const rootOverflow = root.style.overflow;
    const { overflow, paddingRight } = document.body.style;
    const scrollbar = window.innerWidth - root.clientWidth;
    root.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    closeRef.current?.focus();
    return () => {
      root.style.overflow = rootOverflow;
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      previouslyFocused?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowLeft" && many) {
        event.preventDefault();
        goPrev();
      } else if (event.key === "ArrowRight" && many) {
        event.preventDefault();
        goNext();
      } else if (event.key === "Tab") {
        // keep keyboard focus inside the dialog
        const focusable = dialogRef.current?.querySelectorAll("button");
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [many, goPrev, goNext, onClose]);

  // Warm the neighbours so stepping through is instant.
  useEffect(() => {
    if (!many) return;
    [wrap(index + 1, count), wrap(index - 1, count)].forEach((i) => {
      new Image().src = images[i];
    });
  }, [index, count, many, images]);

  const handle = (action) => (event) => {
    event.stopPropagation();
    action();
  };

  return createPortal(
    <div
      ref={dialogRef}
      className="landing-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onPointerDown={(event) => {
        pressedBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        // only a press AND release on the dark backdrop closes it
        if (event.target === event.currentTarget && pressedBackdrop.current) onClose();
      }}
      {...swipe}
    >
      <button
        ref={closeRef}
        type="button"
        className="landing-lightbox-close"
        onClick={handle(onClose)}
        aria-label="Close image viewer"
      >
        <X size={22} />
      </button>

      {many && (
        <button
          type="button"
          className="landing-lightbox-nav prev"
          onClick={handle(goPrev)}
          aria-label="Previous image"
        >
          <ChevronLeft size={26} />
        </button>
      )}

      <img
        className="landing-lightbox-img"
        src={images[index]}
        alt={`${label} — image ${index + 1} of ${count}`}
        draggable={false}
      />

      {many && (
        <button
          type="button"
          className="landing-lightbox-nav next"
          onClick={handle(goNext)}
          aria-label="Next image"
        >
          <ChevronRight size={26} />
        </button>
      )}

      {many && (
        <div className="landing-lightbox-count" aria-live="polite">
          {index + 1} / {count}
        </div>
      )}
    </div>,
    document.body
  );
}

// Homepage story gallery: auto-rotating, manually navigable, click to enlarge.
// `images` are already-resolved URLs, in the order the admin saved them.
export default function StoryGallery({ images, label = "Homepage story images", onEmpty }) {
  const [failed, setFailed] = useState(() => new Set());
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const usingKeyboard = useRef(false);

  // Focus only holds the rotation for a keyboard user. Any mouse/touch press
  // hands control back, so a focus left behind by the lightbox never stalls it.
  useEffect(() => {
    const onKey = () => {
      usingKeyboard.current = true;
    };
    const onPress = () => {
      usingKeyboard.current = false;
      setFocused(false);
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPress, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPress, true);
    };
  }, []);

  // An image that cannot load is dropped rather than shown as a broken tile.
  const list = useMemo(() => images.filter((src) => !failed.has(src)), [images, failed]);
  const count = list.length;
  const many = count > 1;
  const current = count ? Math.min(index, count - 1) : 0;

  useEffect(() => {
    if (images.length && count === 0) onEmpty?.();
  }, [images.length, count, onEmpty]);

  // Restarts on every index change, so a manual click also resets the wait.
  // Held while the pointer is over the gallery, a keyboard user is inside it,
  // or the lightbox is open.
  useEffect(() => {
    if (!many || hovered || focused || zoomed) return undefined;
    const timer = setTimeout(() => setIndex(wrap(current + 1, count)), AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [many, hovered, focused, zoomed, current, count]);

  const goPrev = () => setIndex(wrap(current - 1, count));
  const goNext = () => setIndex(wrap(current + 1, count));
  const swipe = useSwipe(many ? goPrev : () => {}, many ? goNext : () => {});

  const closeZoom = useCallback(() => setZoomed(false), []);

  if (!count) return null;

  const pauseOnMouse = (event) => event.pointerType === "mouse" && setHovered(true);
  const resumeOnMouse = (event) => event.pointerType === "mouse" && setHovered(false);

  // The lightbox is a sibling, not a child: React events from a portal bubble
  // through the component tree, and the gallery's own key/focus handlers must
  // not see what happens inside the viewer.
  return (
    <>
      <section
        className="landing-story-gallery"
        ref={reveal}
        aria-roledescription="carousel"
        aria-label={label}
        onPointerEnter={pauseOnMouse}
        onPointerLeave={resumeOnMouse}
        onFocus={() => usingKeyboard.current && setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(event) => {
          if (!many) return;
          if (event.key === "ArrowLeft") goPrev();
          else if (event.key === "ArrowRight") goNext();
        }}
      >
        <div className="landing-story-stage" {...swipe}>
          {list.map((src, position) => {
            const active = position === current;
            return (
              <div
                key={src}
                className={`landing-story-slide${active ? " active" : ""}`}
                role="group"
                aria-roledescription="slide"
                aria-label={`${position + 1} of ${count}`}
                aria-hidden={active ? undefined : true}
              >
                <button
                  type="button"
                  className="landing-story-slide-btn"
                  onClick={() => setZoomed(true)}
                  aria-label={`Enlarge image ${position + 1} of ${count}`}
                >
                  <img
                    src={src}
                    alt=""
                    loading={position === 0 ? "eager" : "lazy"}
                    decoding="async"
                    draggable={false}
                    onError={() => setFailed((previous) => new Set(previous).add(src))}
                  />
                </button>
              </div>
            );
          })}

          {many && (
            <>
              <button
                type="button"
                className="landing-story-arrow prev"
                onClick={goPrev}
                aria-label="Previous image"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                type="button"
                className="landing-story-arrow next"
                onClick={goNext}
                aria-label="Next image"
              >
                <ChevronRight size={22} />
              </button>
              <span className="landing-story-counter" aria-hidden="true">
                {current + 1} / {count}
              </span>
            </>
          )}
        </div>

        {many && (
          <div className="landing-story-dots">
            {list.map((src, position) => (
              <button
                key={src}
                type="button"
                className={`landing-story-dot${position === current ? " active" : ""}`}
                onClick={() => setIndex(position)}
                aria-label={`Show image ${position + 1} of ${count}`}
                aria-current={position === current ? "true" : undefined}
              />
            ))}
          </div>
        )}
      </section>
      {zoomed && (
        <StoryLightbox
          images={list}
          index={current}
          label={label}
          onIndex={setIndex}
          onClose={closeZoom}
        />
      )}
    </>
  );
}
