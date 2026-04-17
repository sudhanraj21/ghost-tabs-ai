const sharp = require('sharp');
const path = require('path');

const screenshots = ['screenshot-settings', 'screenshot-sidepanel', 'screenshot-dock'];

async function checkAndFix() {
  for (const name of screenshots) {
    const jpgPath = path.join(__dirname, `../store-assets/${name}.jpg`);
    const pngPath = path.join(__dirname, `../store-assets/${name}.png`);
    
    const metadata = await sharp(pngPath).metadata();
    console.log(`${name}: ${metadata.width}x${metadata.height}`);
  }
}

checkAndFix().catch(console.error);