const DEV_JWT_SECRET = 'dev-only-nexa-secret';
const WEAK_SECRET_PATTERN = /change[_-]?me|dev[_-]?only|default|example|secret[_-]?key|super[_-]?secret/i;

const isStrongJwtSecret = (secret?: string) => {
  const value = secret?.trim() || '';
  return value.length >= 32 && !WEAK_SECRET_PATTERN.test(value);
};

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (isStrongJwtSecret(secret)) {
    return secret!.trim();
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set to a strong value in production');
  }

  return secret || DEV_JWT_SECRET;
}
