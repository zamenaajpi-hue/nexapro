const DEV_JWT_SECRET = 'dev-only-nexa-secret';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.trim().length >= 32) {
    return secret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set to a strong value in production');
  }

  return secret || DEV_JWT_SECRET;
}
