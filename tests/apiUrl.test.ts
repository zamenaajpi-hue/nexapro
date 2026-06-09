import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveApiUrl } from '../src/utils/api';
import { DEFAULT_SERVER_URL } from '../src/utils/serverUrl';

const withWindow = (value: any, fn: () => void) => {
  const previous = (globalThis as any).window;
  try {
    (globalThis as any).window = value;
    fn();
  } finally {
    if (previous === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = previous;
    }
  }
};

describe('api url resolver', () => {
  it('keeps absolute and browser-local URLs intact', () => {
    assert.equal(resolveApiUrl('https://example.test/file.png'), 'https://example.test/file.png');
    assert.equal(resolveApiUrl('blob:https://example.test/id'), 'blob:https://example.test/id');
    assert.equal(resolveApiUrl('data:image/png;base64,abc'), 'data:image/png;base64,abc');
  });

  it('uses relative URLs in normal browser mode', () => {
    withWindow({ location: { protocol: 'http:' } }, () => {
      assert.equal(resolveApiUrl('/api/health'), '/api/health');
      assert.equal(resolveApiUrl('api/health'), '/api/health');
    });
  });

  it('uses the default server URL in Capacitor mode without stored config', () => {
    withWindow({ Capacitor: {}, location: { protocol: 'http:' } }, () => {
      assert.equal(resolveApiUrl('/api/health'), `${DEFAULT_SERVER_URL}/api/health`);
    });
  });
});
