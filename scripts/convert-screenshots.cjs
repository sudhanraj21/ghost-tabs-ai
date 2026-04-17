const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const screenshots = ['screenshot-settings', 'screenshot-sidepanel', 'screenshot-dock'];

async function convertToJpeg() {
  for (const name of screenshots) {
    const pngPath = path.join(__dirname, `../store-assets/${name}.png`);
    const jpgPath = path.join(__dirname, `../store-assets/${name}.jpg`);
    
    await sharp(pngPath)
      .resize(1280, 800, { fit: 'cover' })
      .jpeg({ quality: 90 })
      .toFile(jpgPath);
    
    console.log(`Created ${name}.jpg`);
  }
}

convertToJpeg().catch(console.error);