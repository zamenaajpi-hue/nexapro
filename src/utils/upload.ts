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
}
