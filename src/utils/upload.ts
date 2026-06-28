import { resolveApiUrl } from './api';
import { withAuthHeader } from './session';

type UploadJsonOptions = {
  timeoutMs?: number;
  headers?: HeadersInit;
};

const parseJson = (text: string) => {
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
};

const getFirstFilePart = (formData: FormData) => {
  const file = formData.get('file');
  return file instanceof Blob ? file : null;
};

const blobToBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const result = typeof reader.result === 'string' ? reader.result : '';
    resolve(result.includes(',') ? result.slice(result.indexOf(',') + 1) : result);
  };
  reader.onerror = () => reject(reader.error || new Error('Failed to read upload file'));
  reader.readAsDataURL(blob);
});

const uploadBase64Json = async <T>(
  path: string,
  file: Blob,
  options: UploadJsonOptions,
): Promise<T> => {
  const uploadPath = path.endsWith('/base64') ? path : `${path.replace(/\/$/, '')}/base64`;
  const url = resolveApiUrl(uploadPath);
  const headers = withAuthHeader(options.headers);
  headers.set('Content-Type', 'application/json');
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), options.timeoutMs ?? 120000);
  const fileLike = file as File;

  try {
    const response = await window.fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        data: await blobToBase64(file),
        name: fileLike.name || 'upload',
        type: file.type || 'application/octet-stream',
      }),
      signal: controller.signal,
    });
    const data = parseJson(await response.text());
    if (!response.ok) throw new Error(data.error || `Upload failed (${response.status})`);
    return data as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Upload timed out');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

export async function uploadFormDataJson<T = any>(
  path: string,
  formData: FormData,
  options: UploadJsonOptions = {},
): Promise<T> {
  const url = resolveApiUrl(path);
  const headers = withAuthHeader(options.headers);
  headers.delete('Content-Type');
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), options.timeoutMs ?? 120000);

  try {
    const response = await window.fetch(url, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
    });
    const data = parseJson(await response.text());
    if (!response.ok) {
      if (data.error === 'No file uploaded') {
        const file = getFirstFilePart(formData);
        if (file) return uploadBase64Json<T>(path, file, options);
      }
      throw new Error(data.error || `Upload failed (${response.status})`);
    }
    return data as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Upload timed out');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
