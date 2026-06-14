import fs from 'fs';
import path from 'path';

type RuntimeConfig = {
  googleClientId?: string | null;
};

const GOOGLE_CLIENT_ID_PATTERN = /^[0-9a-zA-Z_-]+\.apps\.googleusercontent\.com$/;
const PLACEHOLDER_PATTERNS = [
  /^$/,
  /^CHANGE_ME$/i,
  /^MY_/i,
  /^your-/i,
  /^1234567890-/i,
  /example/i,
];

export const normalizeGoogleClientId = (value?: string | null) => {
  const normalized = String(value || '').trim();
  if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return undefined;
  }
  return GOOGLE_CLIENT_ID_PATTERN.test(normalized) ? normalized : undefined;
};

const readRuntimeConfigFile = (filePath: string) => {
  try {
    if (!fs.existsSync(filePath)) return undefined;
    const config = JSON.parse(fs.readFileSync(filePath, 'utf8')) as RuntimeConfig;
    return normalizeGoogleClientId(config.googleClientId);
  } catch {
    return undefined;
  }
};

export const getGoogleClientId = () => {
  const fromEnv = normalizeGoogleClientId(
    process.env.GOOGLE_CLIENT_ID ||
      process.env.VITE_GOOGLE_CLIENT_ID ||
      process.env.NEXA_GOOGLE_CLIENT_ID,
  );
  if (fromEnv) return fromEnv;

  const candidateConfigPaths = [
    process.env.STATIC_DIST_PATH ? path.join(process.env.STATIC_DIST_PATH, 'runtime-config.json') : '',
    path.join(process.cwd(), 'dist', 'runtime-config.json'),
    path.join(process.cwd(), 'public', 'runtime-config.json'),
  ].filter(Boolean);

  for (const configPath of candidateConfigPaths) {
    const clientId = readRuntimeConfigFile(configPath);
    if (clientId) return clientId;
  }

  return undefined;
};
