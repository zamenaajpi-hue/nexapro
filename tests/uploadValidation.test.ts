import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { detectFileSignature, extensionFromMime, hasExpectedFileSignature, isAllowedUploadMime } from '../src/server/utils/fileValidation';

function withTempFile(bytes: Buffer, fn: (filePath: string) => void) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexa-upload-'));
  const filePath = path.join(dir, 'file.bin');
  try {
    fs.writeFileSync(filePath, bytes);
    fn(filePath);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('upload validation', () => {
  it('allows only configured upload mimes with known extensions', () => {
    assert.equal(isAllowedUploadMime('image/png'), true);
    assert.equal(isAllowedUploadMime('image/png; charset=binary'), true);
    assert.equal(isAllowedUploadMime('IMAGE/JPEG'), true);
    assert.equal(isAllowedUploadMime('video/mp4'), true);
    assert.equal(isAllowedUploadMime('video/x-matroska'), true);
    assert.equal(isAllowedUploadMime('audio/ogg'), true);
    assert.equal(extensionFromMime('application/pdf'), '.pdf');
    assert.equal(isAllowedUploadMime('text/html'), false);
    assert.equal(isAllowedUploadMime('application/octet-stream'), false);
    assert.equal(isAllowedUploadMime(''), false);
    assert.equal(isAllowedUploadMime(undefined), false);
    assert.equal(extensionFromMime('text/html'), '');
  });

  it('accepts matching file signatures', () => {
    withTempFile(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]), (filePath) => {
      assert.equal(hasExpectedFileSignature(filePath, 'image/png'), true);
    });

    withTempFile(Buffer.from('%PDF-1.7\n'), (filePath) => {
      assert.equal(hasExpectedFileSignature(filePath, 'application/pdf'), true);
    });

    withTempFile(Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]), (filePath) => {
      assert.equal(detectFileSignature(filePath), 'video/mp4');
      assert.equal(hasExpectedFileSignature(filePath, 'video/mp4'), true);
    });

    withTempFile(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x93, 0x42, 0x82, 0x88]), (filePath) => {
      assert.equal(detectFileSignature(filePath), 'video/webm');
      assert.equal(hasExpectedFileSignature(filePath, 'video/webm;codecs=vp8,opus'), true);
      assert.equal(hasExpectedFileSignature(filePath, 'audio/webm;codecs=opus'), true);
      assert.equal(hasExpectedFileSignature(filePath, 'video/x-matroska'), true);
    });
  });

  it('rejects fake files with mismatched MIME declarations', () => {
    withTempFile(Buffer.from('<script>alert(1)</script>'), (filePath) => {
      assert.equal(hasExpectedFileSignature(filePath, 'image/png'), false);
      assert.equal(hasExpectedFileSignature(filePath, 'application/pdf'), false);
    });

    withTempFile(Buffer.from('%PDF-1.7\n'), (filePath) => {
      assert.equal(hasExpectedFileSignature(filePath, 'image/png'), false);
    });
  });

  it('rejects unknown or too-short signatures', () => {
    withTempFile(Buffer.from([0x89, 0x50]), (filePath) => {
      assert.equal(hasExpectedFileSignature(filePath, 'image/png'), false);
      assert.equal(hasExpectedFileSignature(filePath, 'application/octet-stream'), false);
    });

    withTempFile(Buffer.from([0x52, 0x49, 0x46, 0x46]), (filePath) => {
      assert.equal(hasExpectedFileSignature(filePath, 'image/webp'), false);
    });
  });
});
