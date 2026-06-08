import fs from 'fs';

export const allowedUploadMimes = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/webm',
  'video/mp4',
  'video/quicktime',
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/x-m4a',
  'application/pdf',
]);

export function extensionFromMime(mime?: string) {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/webm': '.webm',
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
    'audio/webm': '.webm',
    'audio/ogg': '.ogg',
    'audio/mpeg': '.mp3',
    'audio/mp4': '.m4a',
    'audio/x-m4a': '.m4a',
    'application/pdf': '.pdf',
  };
  if (!mime) return '';
  return map[mime.split(';')[0].toLowerCase()] || '';
}

export function hasExpectedFileSignature(filePath: string, mimeType: string) {
  const mime = mimeType.split(';')[0].toLowerCase();
  const buffer = fs.readFileSync(filePath);
  if (buffer.length < 4) return false;

  if (mime === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mime === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mime === 'image/gif') return buffer.subarray(0, 3).toString('ascii') === 'GIF';
  if (mime === 'image/webp') return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  if (mime === 'video/webm' || mime === 'audio/webm') return buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (mime === 'video/mp4' || mime === 'video/quicktime' || mime === 'audio/mp4' || mime === 'audio/x-m4a') return buffer.subarray(4, 8).toString('ascii') === 'ftyp';
  if (mime === 'audio/ogg') return buffer.subarray(0, 4).toString('ascii') === 'OggS';
  if (mime === 'audio/mpeg') return buffer.subarray(0, 3).toString('ascii') === 'ID3' || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
  if (mime === 'application/pdf') return buffer.subarray(0, 4).toString('ascii') === '%PDF';
  return false;
}

export function isAllowedUploadMime(mime?: string) {
  const normalized = (mime || '').split(';')[0].toLowerCase();
  return allowedUploadMimes.has(normalized) && Boolean(extensionFromMime(normalized));
}
