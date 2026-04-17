const sharp = require('sharp');
const path = require('path');

const screenshots = [
  { name: 'screenshot-settings', bg: '#1a1a2e' },
  { name: 'screenshot-sidepanel', bg: '#1a1a2e' },
  { name: 'screenshot-dock', bg: '#ffffff' }
];

async function resizeScreenshots() {
  for (const s of screenshots) {
    const pngPath = path.join(__dirname, `../store-assets/${s.name}.png`);
    const jpgPath = path.join(__dirname, `../store-assets/${s.name}.jpg`);
    
    await sharp(pngPath)
      .resize(1280, 800, { 
        fit: 'contain', 
        background: { r: 26, g: 26, b: 46, alpha: 1 } 
      })
      .jpeg({ quality: 90 })
      .toFile(jpgPath);
    
    console.log(`Created ${s.name}.jpg (1280x800)`);
  }
}

resizeScreenshots().catch(console.error);