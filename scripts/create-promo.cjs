const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e3a5f"/>
      <stop offset="100%" style="stop-color:#0d1b2a"/>
    </linearGradient>
    <linearGradient id="ghostGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#e0f2fe"/>
      <stop offset="50%" style="stop-color:#bae6fd"/>
      <stop offset="100%" style="stop-color:#7dd3fc"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#bgGrad)"/>
  <path d="M64 20 C30 20 20 45 20 65 C20 85 30 100 34 106 C36 102 38 90 44 84 C50 78 54 82 64 82 C74 82 78 78 84 84 C90 90 92 102 94 106 C98 100 108 85 108 65 C108 45 98 20 64 20 Z" fill="url(#ghostGrad)"/>
  <ellipse cx="44" cy="52" rx="8" ry="10" fill="#0d1b2a"/>
  <ellipse cx="84" cy="52" rx="8" ry="10" fill="#0d1b2a"/>
  <circle cx="47" cy="48" r="3" fill="white"/>
  <circle cx="87" cy="48" r="3" fill="white"/>
  <path d="M52 68 Q64 80 76 68" fill="none" stroke="#0d1b2a" stroke-width="3" stroke-linecap="round"/>
</svg>`;

async function createPromoTiles() {
  const iconBuffer = Buffer.from(iconSvg);
  
  // Small promo tile: 440x280
  await sharp(iconBuffer)
    .resize(440, 280, { fit: 'contain', background: { r: 26, g: 26, b: 46, alpha: 1 } })
    .jpeg({ quality: 90 })
    .toFile(path.join(__dirname, '../store-assets/promo-small.jpg'));
  console.log('Created promo-small.jpg (440x280)');
  
  // Marquee promo tile: 1400x560
  await sharp(iconBuffer)
    .resize(1400, 560, { fit: 'contain', background: { r: 26, g: 26, b: 46, alpha: 1 } })
    .jpeg({ quality: 90 })
    .toFile(path.join(__dirname, '../store-assets/promo-marquee.jpg'));
  console.log('Created promo-marquee.jpg (1400x560)');
}

createPromoTiles().catch(console.error);