#!/usr/bin/env node
// Google Play feature graphic — 1024 × 500 PNG, shown above store listing
// search results. Brand: Quiet Atelier (limewash beige + charcoal serif
// 'archelier' wordmark + terracotta dot accent), matching the app icon.

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const W = 1024;
const H = 500;
const OUT = path.join(__dirname, '..', 'resources', 'app-store', 'play-feature-graphic.png');

(async () => {
  const svg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#E1D9C8"/>
      <stop offset="1" stop-color="#C9C0AF"/>
    </linearGradient>
  </defs>

  <!-- limewash beige background -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- tiny uppercase eyebrow label (Atelier · AI) -->
  <text x="80" y="155"
        font-family="Helvetica Neue, Avenir Next, -apple-system, sans-serif"
        font-size="20" font-weight="500" letter-spacing="6"
        fill="#1F1B16" opacity="0.55">ATELIER · AI</text>

  <!-- wordmark: large serif 'archelier' with terracotta period -->
  <text x="80" y="285"
        font-family="Hoefler Text, Cochin, Garamond, 'Times New Roman', serif"
        font-size="148" font-weight="500" letter-spacing="-3"
        fill="#1F1B16">archelier<tspan fill="#B5654A" dx="-6">.</tspan></text>

  <!-- tagline -->
  <text x="80" y="360"
        font-family="Helvetica Neue, Avenir Next, -apple-system, sans-serif"
        font-size="34" font-weight="400"
        fill="#1F1B16" opacity="0.7">AI design studio for interiors,</text>
  <text x="80" y="400"
        font-family="Helvetica Neue, Avenir Next, -apple-system, sans-serif"
        font-size="34" font-weight="400"
        fill="#1F1B16" opacity="0.7">exteriors, and gardens.</text>

  <!-- soft architectural line motif on the right side -->
  <g stroke="#1F1B16" stroke-width="1.5" stroke-linecap="round" opacity="0.18" fill="none">
    <!-- abstract roofline / atelier window outline -->
    <path d="M 720 350 L 850 220 L 980 350"/>
    <path d="M 720 350 L 720 410 L 980 410 L 980 350"/>
    <!-- vertical mullion + sill -->
    <line x1="850" y1="220" x2="850" y2="410"/>
    <line x1="720" y1="375" x2="980" y2="375"/>
  </g>

  <!-- bottom-left footer dot (terracotta accent echoes the icon's '.') -->
  <circle cx="80" cy="460" r="5" fill="#B5654A"/>
</svg>`;

  await sharp(Buffer.from(svg)).png({ quality: 95 }).toFile(OUT);
  console.log('wrote', OUT);
})();
