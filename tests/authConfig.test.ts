import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getJwtSecret } from '../src/server/config/auth';
import { getGoogleClientId, normalizeGoogleClientId } from '../src/server/config/google';

const withEnv = (env: Record<string, string | undefined>, fn: () => void) => {
  const previous = {
    JWT_SECRET: process.env.JWT_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    VITE_GOOGLE_CLIENT_ID: process.env.VITE_GOOGLE_CLIENT_ID,
    NEXA_GOOGLE_CLIENT_ID: process.env.NEXA_GOOGLE_CLIENT_ID,
    STATIC_DIST_PATH: process.env.STATIC_DIST_PATH,
  };

  try {
    Object.entries(env).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
    fn();
  } finally {
    Object.entries(previous).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  }
};

describe('auth config', () => {
  it('accepts a strong JWT secret in production', () => {
    withEnv({ NODE_ENV: 'production', JWT_SECRET: 'nexa_4b7c9f2a8e6d1c0b5a3f9e7d2c8b6a1f' }, () => {
      assert.equal(getJwtSecret(), 'nexa_4b7c9f2a8e6d1c0b5a3f9e7d2c8b6a1f');
    });
  });

  it('rejects missing, short, and placeholder JWT secrets in production', () => {
    withEnv({ NODE_ENV: 'production', JWT_SECRET: undefined }, () => {
      assert.throws(() => getJwtSecret(), /JWT_SECRET must be set/);
    });
    withEnv({ NODE_ENV: 'production', JWT_SECRET: 'short' }, () => {
      assert.throws(() => getJwtSecret(), /JWT_SECRET must be set/);
    });
    withEnv({ NODE_ENV: 'production', JWT_SECRET: 'super-secret-key-change-me-in-production' }, () => {
      assert.throws(() => getJwtSecret(), /JWT_SECRET must be set/);
    });
  });

  it('keeps a development fallback outside production', () => {
    withEnv({ NODE_ENV: 'development', JWT_SECRET: undefined }, () => {
      assert.equal(getJwtSecret(), 'dev-only-nexa-secret');
    });
  });

  it('validates Google OAuth client IDs and ignores placeholders', () => {
    assert.equal(normalizeGoogleClientId('1234567890-example.apps.googleusercontent.com'), undefined);
    assert.equal(normalizeGoogleClientId('CHANGE_ME'), undefined);
    assert.equal(normalizeGoogleClientId('not-a-client-id'), undefined);
    assert.equal(
      normalizeGoogleClientId('9876543210-abc_DEF.apps.googleusercontent.com'),
      '9876543210-abc_DEF.apps.googleusercontent.com',
    );
  });

  it('reads Google OAuth client ID from runtime config for packaged builds', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexa-runtime-config-'));
    const clientId = '9876543210-releaseclient.apps.googleusercontent.com';
    fs.writeFileSync(path.join(tempDir, 'runtime-config.json'), JSON.stringify({ googleClientId: clientId }));

    withEnv({
      GOOGLE_CLIENT_ID: undefined,
      VITE_GOOGLE_CLIENT_ID: undefined,
      NEXA_GOOGLE_CLIENT_ID: undefined,
      STATIC_DIST_PATH: tempDir,
    }, () => {
      assert.equal(getGoogleClientId(), clientId);
    });

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
