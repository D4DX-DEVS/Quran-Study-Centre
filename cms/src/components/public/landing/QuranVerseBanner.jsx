import React from "react";

/*
 * Recreation of the "Rabbi zidni ilma" poster (Surah Ta-Ha 20:114):
 * dark-blue mosque arch on a light patterned wall, Arabic verse,
 * Malayalam translation, open Quran on a wooden rehal, lanterns, carpet.
 */
function QuranVerseBanner() {
  return (
    <svg
      className="landing-quran-banner"
      viewBox="0 0 900 740"
      role="img"
      aria-label="Quran verse banner — And say: My Lord, increase me in knowledge (Ta-Ha 20:114)"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="qvb-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2f6fd" />
          <stop offset="1" stopColor="#d9e5f6" />
        </linearGradient>
        <linearGradient id="qvb-arch" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f55b8" />
          <stop offset="0.55" stopColor="#1e3a8a" />
          <stop offset="1" stopColor="#122a68" />
        </linearGradient>
        <radialGradient id="qvb-arch-glow" cx="0.5" cy="0.22" r="0.75">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="qvb-page" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fdf8ec" />
          <stop offset="1" stopColor="#ecdfc3" />
        </linearGradient>
        <linearGradient id="qvb-wood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6b4326" />
          <stop offset="1" stopColor="#3e2413" />
        </linearGradient>
        <linearGradient id="qvb-carpet" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#27479c" />
          <stop offset="1" stopColor="#16306e" />
        </linearGradient>
        <radialGradient id="qvb-lamp-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffd98a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffd98a" stopOpacity="0" />
        </radialGradient>
        {/* subtle 8-point-star wall pattern */}
        <pattern id="qvb-geo" width="64" height="64" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="#1e3a8a" strokeOpacity="0.08" strokeWidth="1.4">
            <path d="M32 6 L44 20 L58 32 L44 44 L32 58 L20 44 L6 32 L20 20 Z" />
            <circle cx="32" cy="32" r="6" />
          </g>
        </pattern>
        <filter id="qvb-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="14" floodColor="#0d2050" floodOpacity="0.35" />
        </filter>
      </defs>

      {/* wall */}
      <rect width="900" height="740" fill="url(#qvb-wall)" />
      <rect width="900" height="740" fill="url(#qvb-geo)" />
      {/* side pillars */}
      <rect x="0" y="0" width="64" height="740" fill="#ffffff" opacity="0.55" />
      <rect x="64" y="0" width="8" height="740" fill="#b9cbe8" opacity="0.6" />
      <rect x="836" y="0" width="64" height="740" fill="#ffffff" opacity="0.55" />
      <rect x="828" y="0" width="8" height="740" fill="#b9cbe8" opacity="0.6" />

      {/* arch — white rim then dark-blue fill */}
      <path
        d="M158 740 V296 C158 190 216 156 296 124 C376 92 428 84 450 30 C472 84 524 92 604 124 C684 156 742 190 742 296 V740 Z"
        fill="#f7faff"
        filter="url(#qvb-soft)"
      />
      <path
        d="M172 740 V300 C172 200 226 168 302 138 C378 108 430 98 450 48 C470 98 522 108 598 138 C674 168 728 200 728 300 V740 Z"
        fill="url(#qvb-arch)"
      />
      <path
        d="M172 740 V300 C172 200 226 168 302 138 C378 108 430 98 450 48 C470 98 522 108 598 138 C674 168 728 200 728 300 V740 Z"
        fill="url(#qvb-arch-glow)"
      />

      {/* lanterns */}
      <g>
        <line x1="640" y1="0" x2="640" y2="96" stroke="#8fa7d6" strokeWidth="2" />
        <circle cx="640" cy="150" r="70" fill="url(#qvb-lamp-glow)" />
        <path d="M640 96 l-16 14 v40 c0 14 8 22 16 22 c8 0 16 -8 16 -22 v-40 Z" fill="#35539e" />
        <rect x="628" y="92" width="24" height="8" rx="3" fill="#22396f" />
        <circle cx="640" cy="132" r="9" fill="#ffd98a" opacity="0.9" />
        <path d="M640 172 l-6 10 h12 Z" fill="#22396f" />

        <line x1="778" y1="0" x2="778" y2="60" stroke="#8fa7d6" strokeWidth="2" />
        <circle cx="778" cy="128" r="82" fill="url(#qvb-lamp-glow)" />
        <path d="M778 60 l-20 18 v52 c0 17 10 27 20 27 c10 0 20 -10 20 -27 v-52 Z" fill="#3b5cae" />
        <rect x="763" y="55" width="30" height="9" rx="4" fill="#264178" />
        <circle cx="778" cy="106" r="11" fill="#ffd98a" opacity="0.9" />
        <path d="M778 158 l-7 12 h14 Z" fill="#264178" />
      </g>

      {/* verse — Arabic */}
      <text
        x="450"
        y="212"
        textAnchor="middle"
        direction="rtl"
        fill="#ffffff"
        fontFamily="'Amiri', 'Scheherazade New', 'Traditional Arabic', serif"
        fontSize="58"
        fontWeight="700"
      >
        {"وَقُلْ رَّبِّ زِدْنِي عِلْمًا"}
      </text>

      {/* translation — Malayalam */}
      <text
        x="450"
        y="292"
        textAnchor="middle"
        fill="#ffffff"
        fontFamily="'Noto Sans Malayalam', 'Manjari', 'Nirmala UI', sans-serif"
        fontSize="34"
        fontWeight="600"
      >
        {"ജ്ഞാനത്തിൽ എനിക്ക്"}
      </text>
      <text
        x="450"
        y="338"
        textAnchor="middle"
        fill="#ffffff"
        fontFamily="'Noto Sans Malayalam', 'Manjari', 'Nirmala UI', sans-serif"
        fontSize="34"
        fontWeight="600"
      >
        {"വളർച്ച നൽകണമേ"}
      </text>
      <text
        x="450"
        y="386"
        textAnchor="middle"
        fill="#dbe6ff"
        fontFamily="'Noto Sans Malayalam', 'Manjari', 'Nirmala UI', sans-serif"
        fontSize="22"
      >
        {"(ത്വാഹാ: 20:114)"}
      </text>

      {/* rehal (wooden X stand) */}
      <g filter="url(#qvb-soft)">
        <path d="M340 690 L520 508 L552 522 L372 704 Z" fill="url(#qvb-wood)" />
        <path d="M560 690 L380 508 L348 522 L528 704 Z" fill="#54331c" />
        <rect x="352" y="686" width="196" height="14" rx="6" fill="#3e2413" />
      </g>

      {/* open Quran */}
      <g filter="url(#qvb-soft)">
        {/* cover */}
        <path
          d="M450 522 C392 486 316 492 282 520 L292 566 C330 542 400 540 450 566 C500 540 570 542 608 566 L618 520 C584 492 508 486 450 522 Z"
          fill="#14532d"
        />
        {/* page block thickness */}
        <path
          d="M450 516 C396 484 322 490 292 516 L296 556 C332 534 400 532 450 556 C500 532 568 534 604 556 L608 516 C578 490 504 484 450 516 Z"
          fill="#d9c79f"
        />
        {/* top pages */}
        <path
          d="M450 512 C398 482 328 488 298 512 C332 494 402 494 450 520 Z"
          fill="url(#qvb-page)"
        />
        <path
          d="M450 512 C502 482 572 488 602 512 C568 494 498 494 450 520 Z"
          fill="url(#qvb-page)"
        />
        <path
          d="M300 512 C334 490 404 490 450 518 C496 490 566 490 600 512 L600 540 C566 520 498 520 450 546 C402 520 334 520 300 540 Z"
          fill="url(#qvb-page)"
        />
        {/* page text lines */}
        <g stroke="#8a7a55" strokeWidth="1.6" opacity="0.7" fill="none">
          <path d="M322 514 C352 502 402 502 436 518" />
          <path d="M322 524 C352 512 402 512 436 528" />
          <path d="M578 514 C548 502 498 502 464 518" />
          <path d="M578 524 C548 512 498 512 464 528" />
        </g>
        {/* spine */}
        <path d="M450 518 L450 546" stroke="#b9a678" strokeWidth="3" />
        {/* gold page edges */}
        <path
          d="M300 540 C334 520 402 520 450 546 C498 520 566 520 600 540"
          fill="none"
          stroke="#d4af37"
          strokeWidth="3"
          opacity="0.8"
        />
      </g>

      {/* carpet */}
      <g>
        <rect x="0" y="688" width="900" height="52" fill="url(#qvb-carpet)" />
        <g fill="none" stroke="#93b2ef" strokeOpacity="0.4" strokeWidth="2">
          <path d="M0 700 H900" />
          <path d="M0 728 H900" />
        </g>
        <g fill="#93b2ef" fillOpacity="0.35">
          {Array.from({ length: 15 }, (_, i) => (
            <path key={i} d={`M${30 + i * 60} 706 l10 8 l-10 8 l-10 -8 Z`} />
          ))}
        </g>
      </g>
    </svg>
  );
}

export default QuranVerseBanner;
