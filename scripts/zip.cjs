const fs = require('fs');
const archiver = require('archiver');

const output = fs.createWriteStream('GhostTabs-AI-v1.0.0.zip');
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => console.log(`Created GhostTabs-AI-v1.0.0.zip (${archive.pointer()} bytes)`));

archive.pipe(output);
archive.directory('dist/', false);
archive.finalize();