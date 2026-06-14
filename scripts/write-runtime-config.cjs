const fs = require('fs');
const path = require('path');
require('dotenv/config');

const GOOGLE_CLIENT_ID_PATTERN = /^[0-9a-zA-Z_-]+\.apps\.googleusercontent\.com$/;
const PLACEHOLDER_PATTERNS = [
  /^$/,
  /^CHANGE_ME$/i,
  /^MY_/i,
  /^your-/i,
  /^1234567890-/i,
  /example/i,
];

function normalizeGoogleClientId(value) {
  const normalized = String(value || '').trim();
  if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return null;
  }
  return GOOGLE_CLIENT_ID_PATTERN.test(normalized) ? normalized : null;
}

const googleClientId = normalizeGoogleClientId(
  process.env.GOOGLE_CLIENT_ID ||
    process.env.VITE_GOOGLE_CLIENT_ID ||
    process.env.NEXA_GOOGLE_CLIENT_ID,
);

const publicDir = path.join(process.cwd(), 'public');
fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(
  path.join(publicDir, 'runtime-config.json'),
  `${JSON.stringify({ googleClientId }, null, 2)}\n`,
);

if (googleClientId) {
  console.log('Runtime config: Google Sign-In enabled.');
} else {
  console.log('Runtime config: Google Sign-In disabled until GOOGLE_CLIENT_ID or VITE_GOOGLE_CLIENT_ID is set.');
}
