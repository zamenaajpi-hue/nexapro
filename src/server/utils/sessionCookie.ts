import type { Request, Response } from 'express';

export const AUTH_COOKIE_NAME = 'nexa_session';
export const AUTH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const isProduction = () => process.env.NODE_ENV === 'production';

export const readTokenFromCookieHeader = (cookieHeader?: string | string[]) => {
  const header = Array.isArray(cookieHeader) ? cookieHeader.join(';') : cookieHeader;
  if (!header) return null;

  const cookie = header
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${AUTH_COOKIE_NAME}=`));

  if (!cookie) return null;

  try {
    return decodeURIComponent(cookie.slice(AUTH_COOKIE_NAME.length + 1));
  } catch {
    return null;
  }
};

export const readTokenFromRequest = (req: Request | any) => {
  const authHeader = req.headers?.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length);
  }

  return readTokenFromCookieHeader(req.headers?.cookie);
};

export const setAuthCookie = (res: Response, token: string) => {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    path: '/',
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
  });
};

export const clearAuthCookie = (res: Response) => {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    path: '/',
  });
};
