/**
 * Manuscript AI - Strict Configurable CORS Security Middleware
 *
 * Implements strict CORS compliance per W3C Fetch specification:
 * - Never reflects arbitrary or unverified origins
 * - Never pairs Access-Control-Allow-Origin: * with Access-Control-Allow-Credentials: true
 * - Enforces explicit origin allowlist from CORS_ORIGINS
 * - Dispatches Vary: Origin for proper cache partitioning
 * - Safely rejects preflight OPTIONS from disallowed origins with 403 Forbidden
 * - Supports separate development and production allowlists
 */

import { Request, Response, NextFunction } from 'express';
import { errorResponse } from './response.js';

export function parseAllowedOrigins(corsOriginsEnv?: string): string[] {
  if (!corsOriginsEnv) {
    return ['http://localhost:5173', 'http://localhost:3000'];
  }
  return corsOriginsEnv
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

export function createCorsMiddleware(allowedOriginsList: string[]) {
  const allowWildcard = allowedOriginsList.includes('*');
  const allowedSet = new Set(allowedOriginsList.map((o) => o.toLowerCase()));

  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;

    // Always set Vary: Origin to prevent cache poisoning across origins
    res.setHeader('Vary', 'Origin');

    if (origin) {
      const lowerOrigin = origin.toLowerCase();
      const isExplicitlyAllowed = allowedSet.has(lowerOrigin);

      if (isExplicitlyAllowed) {
        // Explicitly matched allowed origin: allow with credentials
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control'
        );
        res.setHeader('Access-Control-Max-Age', '86400');

        if (req.method === 'OPTIONS') {
          return res.status(204).end();
        }
      } else if (allowWildcard) {
        // Wildcard mode: ONLY without credentials (never combine * with credentials)
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control'
        );
        res.setHeader('Access-Control-Max-Age', '86400');

        if (req.method === 'OPTIONS') {
          return res.status(204).end();
        }
      } else {
        // Disallowed origin
        if (req.method === 'OPTIONS') {
          return res.status(403).json(
            errorResponse('CORS_FORBIDDEN', `Origin '${origin}' is not permitted by server CORS policy`)
          );
        }
        // For non-OPTIONS requests from disallowed origins, do not set Access-Control-Allow-Origin headers
      }
    }

    next();
  };
}
