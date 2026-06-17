const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'assets', 'public');
const removable = ['server.cjs', 'server.cjs.map', 'sw.js'];

for (const fileName of removable) {
  const target = path.join(publicDir, fileName);
  if (fs.existsSync(target)) {
    fs.rmSync(target, { force: true });
    console.log(`Removed Android-only asset: ${fileName}`);
  }
}
