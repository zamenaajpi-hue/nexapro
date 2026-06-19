import fs from 'fs';

export const allowedUploadMimes = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/webm',
  'video/mp4',
  'video/quicktime',
  'video/x-matroska',
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
    'video/x-matroska': '.webm',
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

const normalizeMime = (mimeType?: string) => (mimeType || '').split(';')[0].toLowerCase();

export function detectFileSignature(filePath: string) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.length < 4) return null;

  const hasMp4Signature = () => {
    if (buffer.length < 12) return false;
    const firstBoxSize = buffer.readUInt32BE(0);
    const firstBoxType = buffer.subarray(4, 8).toString('ascii');
    return firstBoxSize >= 8 && ['ftyp', 'styp', 'moov', 'moof'].includes(firstBoxType);
  };

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.subarray(0, 3).toString('ascii') === 'GIF') return 'image/gif';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return 'video/webm';
  if (hasMp4Signature()) return 'video/mp4';
  if (buffer.subarray(0, 4).toString('ascii') === 'OggS') return 'audio/ogg';
  if (buffer.subarray(0, 3).toString('ascii') === 'ID3' || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)) return 'audio/mpeg';
  if (buffer.subarray(0, 4).toString('ascii') === '%PDF') return 'application/pdf';
  return null;
}

export function hasExpectedFileSignature(filePath: string, mimeType: string) {
  const mime = normalizeMime(mimeType);
  const detected = detectFileSignature(filePath);
  if (!detected) return false;
  if (mime === detected) return true;
  if (mime === 'video/x-matroska' && detected === 'video/webm') return true;
  if (mime === 'audio/webm' && detected === 'video/webm') return true;
  if ((mime === 'video/quicktime' || mime === 'audio/mp4' || mime === 'audio/x-m4a') && detected === 'video/mp4') return true;
  return false;
}

export function isAllowedUploadMime(mime?: string) {
  const normalized = normalizeMime(mime);
  return allowedUploadMimes.has(normalized) && Boolean(extensionFromMime(normalized));
}
