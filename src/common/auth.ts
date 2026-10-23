/**
 * Manuscript AI - Authentication & Authorization Engine
 *
 * Implements:
 * - Secure PBKDF2/scrypt password hashing with unique per-user salts
 * - JWT-compatible token generation & verification
 * - Role-Based Access Control (RBAC): ADMIN, RESEARCHER, VIEWER
 */

import crypto from 'node:crypto';

export type UserRole = 'ADMIN' | 'RESEARCHER' | 'VIEWER';

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  displayName: string;
  iat: number;
  exp: number;
}

const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'manuscript_ai_secure_jwt_token_secret_key_2026';
const JWT_EXPIRES_IN_SECONDS = 15 * 60; // 15 minutes

/**
 * Hash password using crypto PBKDF2 with SHA-512
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `pbkdf2$10000$${salt}$${hash}`;
}

/**
 * Verify password against stored hash format
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.startsWith('pbkdf2$')) {
    return false;
  }
  const parts = storedHash.split('$');
  if (parts.length !== 4) return false;
  const iterations = parseInt(parts[1], 10);
  const salt = parts[2];
  const hash = parts[3];

  const verifyHash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verifyHash, 'hex'));
}

/**
 * Base64URL encoding/decoding helper
 */
function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Sign JWT token
 */
export function signJwtToken(
  user: { id: string; email: string; role: UserRole; displayName: string },
  expiresInSeconds: number = JWT_EXPIRES_IN_SECONDS,
): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    displayName: user.displayName,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verify JWT token
 */
export function verifyJwtToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    if (signature !== expectedSig) {
      return null;
    }

    const payload: TokenPayload = JSON.parse(base64UrlDecode(payloadB64));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Role hierarchy checker
 */
export function hasRolePermission(userRole: UserRole, requiredRole: UserRole): boolean {
  const ranks: Record<UserRole, number> = {
    ADMIN: 3,
    RESEARCHER: 2,
    VIEWER: 1,
  };
  return ranks[userRole] >= ranks[requiredRole];
}
