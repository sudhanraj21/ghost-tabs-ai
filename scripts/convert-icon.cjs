const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function convertSvgToPng() {
  const svgPath = path.join(__dirname, '../store-assets/icon-128.svg');
  const pngPath = path.join(__dirname, '../store-assets/icon-128.png');
  
  const svgBuffer = fs.readFileSync(svgPath);
  
  await sharp(svgBuffer)
    .resize(128, 128)
    .png()
    .toFile(pngPath);
  
  console.log('Created icon-128.png');
}

convertSvgToPng().catch(console.error);