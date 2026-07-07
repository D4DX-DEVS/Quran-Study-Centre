import React from "react";

export const AppleLogo = ({ size = 26 }) => (
  <svg width={size} height={size} viewBox="0 0 384 512" fill="currentColor" aria-hidden="true">
    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
  </svg>
);

export const PlayStoreLogo = ({ size = 26 }) => {
  const T = [20, 15];
  const B = [20, 85];
  const R = [85, 50];
  const C = [20, 50];
  const M1 = [52.5, 32.5];
  const M2 = [52.5, 67.5];
  const pts = (a, b, c) => `${a[0]},${a[1]} ${b[0]},${b[1]} ${c[0]},${c[1]}`;

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <polygon points={pts(T, M1, C)} fill="#12B7F5" />
      <polygon points={pts(M1, R, C)} fill="#FF4059" />
      <polygon points={pts(R, M2, C)} fill="#FFD500" />
      <polygon points={pts(M2, B, C)} fill="#22C55E" />
    </svg>
  );
};

export const StoreBadge = ({ href, icon, eyebrow, title, className = "" }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className={`landing-store-badge ${className}`}
  >
    <span className="landing-store-badge-icon">{icon}</span>
    <span className="landing-store-badge-text">
      <span className="landing-store-badge-eyebrow">{eyebrow}</span>
      <span className="landing-store-badge-title">{title}</span>
    </span>
  </a>
);
