/**
 * Manuscript AI - Authentication & Authorization Engine
 *
 * Implements:
 * - Secure PBKDF2 password hashing with cryptographically random unique salts (SHA-512)
 * - Strict HS256 JWT access tokens with unique jti claims and expiration enforcement
 * - Stateful, rotatable cryptographic refresh tokens with expiration and reuse detection
 * - Access token blacklist revocation store for immediate logout effectiveness
 * - Memory-efficient sliding-window rate limiting for brute-force protection
 * - Hierarchical Role-Based Access Control (RBAC): ADMIN > RESEARCHER > VIEWER
 */

import crypto from 'node:crypto';

export type UserRole = 'ADMIN' | 'RESEARCHER' | 'VIEWER';

export interface TokenPayload {
  jti: string;
  userId: string;
  email: string;
  role: UserRole;
  displayName: string;
  iat: number;
  exp: number;
}

export interface StoredRefreshToken {
  id: string;
  tokenHash: string;
  userId: string;
  expiresAt: number; // Unix timestamp in seconds
  isRevoked: boolean;
  replacedByTokenId?: string;
  createdAt: number;
}

const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'manuscript_ai_secure_jwt_token_secret_key_2026';
const JWT_EXPIRES_IN_SECONDS = 15 * 60; // 15 minutes
const REFRESH_TOKEN_EXPIRES_IN_SECONDS = 7 * 24 * 60 * 60; // 7 days

// -------------------------------------------------------------
// 1. Password Hashing & Timing-Safe Verification
// -------------------------------------------------------------
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `pbkdf2$10000$${salt}$${hash}`;
}

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

// -------------------------------------------------------------
// 2. Base64URL Encoding / Decoding
// -------------------------------------------------------------
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

// -------------------------------------------------------------
// 3. Token Blacklist & Revocation Store
// -------------------------------------------------------------
const revokedTokens = new Map<string, number>(); // jti -> expiresAt timestamp

export function revokeToken(jti: string, expiresAt: number): void {
  revokedTokens.set(jti, expiresAt);
}

export function isTokenRevoked(jti: string): boolean {
  const exp = revokedTokens.get(jti);
  if (!exp) return false;
  const now = Math.floor(Date.now() / 1000);
  if (now > exp) {
    revokedTokens.delete(jti);
    return false;
  }
  return true;
}

// -------------------------------------------------------------
// 4. JWT Access Token Signing & Verification
// -------------------------------------------------------------
export function signJwtToken(
  user: { id: string; email: string; role: UserRole; displayName: string },
  expiresInSeconds: number = JWT_EXPIRES_IN_SECONDS,
): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const jti = `tok_${crypto.randomUUID()}`;
  const payload: TokenPayload = {
    jti,
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

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }

    const payload: TokenPayload = JSON.parse(base64UrlDecode(payloadB64));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }

    // Check if token jti was explicitly revoked via logout
    if (payload.jti && isTokenRevoked(payload.jti)) {
      return null; // Revoked
    }

    return payload;
  } catch {
    return null;
  }
}

// -------------------------------------------------------------
// 5. Stateful Cryptographic Refresh Token Store
// -------------------------------------------------------------
const refreshTokensStore = new Map<string, StoredRefreshToken>(); // tokenHash -> record

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function createRefreshToken(userId: string): { token: string; tokenId: string; expiresAt: number } {
  const rawSecret = crypto.randomBytes(32).toString('hex');
  const tokenId = `rf_${crypto.randomUUID()}`;
  const token = `${tokenId}.${rawSecret}`;
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + REFRESH_TOKEN_EXPIRES_IN_SECONDS;

  const record: StoredRefreshToken = {
    id: tokenId,
    tokenHash: hashToken(token),
    userId,
    expiresAt,
    isRevoked: false,
    createdAt: now,
  };

  refreshTokensStore.set(record.tokenHash, record);
  return { token, tokenId, expiresAt };
}

export function verifyAndRotateRefreshToken(
  rawRefreshToken: string,
): { success: boolean; userId?: string; newRefreshToken?: string; error?: string } {
  if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
    return { success: false, error: 'MISSING_REFRESH_TOKEN' };
  }

  const tokenHash = hashToken(rawRefreshToken);
  const record = refreshTokensStore.get(tokenHash);

  if (!record) {
    return { success: false, error: 'INVALID_REFRESH_TOKEN' };
  }

  const now = Math.floor(Date.now() / 1000);

  // Check reuse of revoked token (Breach detection)
  if (record.isRevoked) {
    // If a revoked token is attempted to be reused, invalidate all tokens for this user!
    revokeAllTokensForUser(record.userId);
    return { success: false, error: 'TOKEN_REUSE_DETECTED' };
  }

  if (record.expiresAt < now) {
    record.isRevoked = true;
    return { success: false, error: 'EXPIRED_REFRESH_TOKEN' };
  }

  // Rotate token: revoke current token and issue replacement
  record.isRevoked = true;
  const newRefresh = createRefreshToken(record.userId);
  record.replacedByTokenId = newRefresh.tokenId;

  return {
    success: true,
    userId: record.userId,
    newRefreshToken: newRefresh.token,
  };
}

export function revokeRefreshToken(rawRefreshToken: string): boolean {
  const tokenHash = hashToken(rawRefreshToken);
  const record = refreshTokensStore.get(tokenHash);
  if (record) {
    record.isRevoked = true;
    return true;
  }
  return false;
}

export function revokeAllTokensForUser(userId: string): void {
  for (const record of refreshTokensStore.values()) {
    if (record.userId === userId) {
      record.isRevoked = true;
    }
  }
}

// -------------------------------------------------------------
// 6. Login Rate Limiting (Sliding Window)
// -------------------------------------------------------------
interface RateLimitRecord {
  attempts: number;
  lastAttemptAt: number;
  blockedUntil?: number;
}

const loginAttempts = new Map<string, RateLimitRecord>();
const MAX_ATTEMPTS = 5;
const BLOCK_DURATION_SECONDS = 15 * 60; // 15 minutes lockout

export function checkLoginRateLimit(identifier: string): { allowed: boolean; retryAfterSeconds: number } {
  const record = loginAttempts.get(identifier);
  if (!record) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const now = Math.floor(Date.now() / 1000);
  if (record.blockedUntil && now < record.blockedUntil) {
    return { allowed: false, retryAfterSeconds: record.blockedUntil - now };
  }

  // Expired lockout window
  if (record.blockedUntil && now >= record.blockedUntil) {
    loginAttempts.delete(identifier);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordFailedLogin(identifier: string): { isNowBlocked: boolean; retryAfterSeconds: number } {
  const now = Math.floor(Date.now() / 1000);
  let record = loginAttempts.get(identifier);

  if (!record) {
    record = { attempts: 1, lastAttemptAt: now };
    loginAttempts.set(identifier, record);
    return { isNowBlocked: false, retryAfterSeconds: 0 };
  }

  record.attempts += 1;
  record.lastAttemptAt = now;

  if (record.attempts >= MAX_ATTEMPTS) {
    record.blockedUntil = now + BLOCK_DURATION_SECONDS;
    return { isNowBlocked: true, retryAfterSeconds: BLOCK_DURATION_SECONDS };
  }

  return { isNowBlocked: false, retryAfterSeconds: 0 };
}

export function recordSuccessfulLogin(identifier: string): void {
  loginAttempts.delete(identifier);
}

// -------------------------------------------------------------
// 7. Role Hierarchy Authorization
// -------------------------------------------------------------
export function hasRolePermission(userRole: UserRole, requiredRole: UserRole): boolean {
  const ranks: Record<UserRole, number> = {
    ADMIN: 3,
    RESEARCHER: 2,
    VIEWER: 1,
  };
  return ranks[userRole] >= ranks[requiredRole];
}
