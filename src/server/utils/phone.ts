export const RUSSIAN_PHONE_PATTERN = /^(?:\+7|8)\d{10}$/;

export const INVALID_RUSSIAN_PHONE_MESSAGE = 'Введите номер в формате +7XXXXXXXXXX или 8XXXXXXXXXX';

export const normalizeRussianPhone = (phone?: string | null) => {
  const trimmed = phone?.trim();
  if (!trimmed) return null;
  if (!RUSSIAN_PHONE_PATTERN.test(trimmed)) {
    throw new Error(INVALID_RUSSIAN_PHONE_MESSAGE);
  }

  return trimmed.startsWith('+7') ? `7${trimmed.slice(2)}` : `7${trimmed.slice(1)}`;
};
