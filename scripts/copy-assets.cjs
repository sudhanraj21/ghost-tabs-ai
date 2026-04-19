const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDir('assets', 'dist/assets');
copyDir('src/content', 'dist/content');
if (fs.existsSync('icons')) {
  copyDir('icons', 'dist/icons');
}
fs.copyFileSync('manifest.json', 'dist/manifest.json');

const manifest = JSON.parse(fs.readFileSync('dist/manifest.json', 'utf8'));

const contentCss = fs.readdirSync('dist/assets').find(f => f.startsWith('content-script') && f.endsWith('.css'));
if (contentCss) {
  manifest.content_scripts[0].css = ['assets/' + contentCss];
}

fs.writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2));

console.log('Assets copied successfully');