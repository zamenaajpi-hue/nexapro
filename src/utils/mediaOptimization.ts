const MAX_IMAGE_SIDE = 1600;
const MIN_COMPRESS_SIZE = 1_200_000;

export async function compressImageForUpload(file: File | Blob, fallbackName = 'image.jpg'): Promise<File | Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.size < MIN_COMPRESS_SIZE) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) return file;

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.82);
    });

    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file instanceof File ? file.name : fallbackName, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
