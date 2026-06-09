import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getJwtSecret } from '../src/server/config/auth';

const withEnv = (env: Record<string, string | undefined>, fn: () => void) => {
  const previous = {
    JWT_SECRET: process.env.JWT_SECRET,
    NODE_ENV: process.env.NODE_ENV,
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
});
