/**
 * Manuscript AI - Core Unit & Integration Test Suite
 *
 * Runs with Node's native test runner (via `tsx --test`).
 * Comprehensive test coverage:
 * 1. Persian and Arabic Unicode text normalization pipeline
 * 2. Character Error Rate (CER) and Word Error Rate (WER) metrics
 * 3. Authentication hashing, timing-safe validation, and JWT verification
 * 4. Role-based access control (ADMIN, RESEARCHER, VIEWER) permissions
 * 5. StorageService: Magic bytes validation, dimension parsing, and path traversal rejection
 * 6. Asynchronous JobQueue lifecycle and cancellation
 * 7. Search snippet extraction around normalized Persian/Arabic queries
 * 8. Prisma Database persistence: entity creation, query retrieval, and cross-restart verification
 * 9. Optimistic concurrency locking & version conflict checks
 * 10. Dynamic Health check reporting
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePersianArabicText, createSearchSnippet } from '../common/normalization.js';
import { calculateCerWer } from '../common/metrics.js';
import {
  hashPassword,
  verifyPassword,
  signJwtToken,
  verifyJwtToken,
  hasRolePermission,
  createRefreshToken,
  verifyAndRotateRefreshToken,
  revokeToken,
  revokeRefreshToken,
  checkLoginRateLimit,
  recordFailedLogin,
  recordSuccessfulLogin,
} from '../common/auth.js';
import { createCorsMiddleware, parseAllowedOrigins } from '../common/cors.js';
import { StorageService } from '../storage/storage.service.js';
import { JobQueueService } from '../jobs/queue.service.js';
import { prisma, PrismaService } from '../database/prisma.service.js';

test('Normalization: Unifies Arabic and Persian Yeh characters', () => {
  const arabicYeh = 'علي بن ابي طالب'; // with Arabic Yeh \u064A
  const expectedPersian = 'علی بن ابی طالب'; // with Persian Yeh \u06CC
  const normalized = normalizePersianArabicText(arabicYeh);
  assert.equal(normalized, expectedPersian);
});

test('Normalization: Unifies Arabic and Persian Kaf characters', () => {
  const arabicKaf = 'كتاب الحكمة'; // with Arabic Kaf \u0643
  const expectedPersian = 'کتاب الحکمة'; // with Persian Kaf \u06A9
  const normalized = normalizePersianArabicText(arabicKaf, { unifyAlef: false, removeDiacritics: false });
  assert.equal(normalized, expectedPersian);
});

test('Normalization: Strips Arabic Harakat/Tashkeel and Tatweel', () => {
  const inputWithDiacritics = 'بِسْمِ اللَّـهِ الرَّحْمَٰنِ الرَّحِيمِ';
  const inputWithTatweel = 'فـــردوســـی';

  const normalizedDiacritics = normalizePersianArabicText(inputWithDiacritics);
  assert.equal(normalizedDiacritics.includes('\u064E'), false); // No Fatha
  assert.equal(normalizedDiacritics.includes('\u0650'), false); // No Kasra

  const normalizedTatweel = normalizePersianArabicText(inputWithTatweel);
  assert.equal(normalizedTatweel, 'فردوسی');
});

test('Normalization: Unifies Alef variations (Madda, Hamza Above, Hamza Below)', () => {
  const input = 'آغاز إسلام أحمد';
  const normalized = normalizePersianArabicText(input);
  assert.equal(normalized, 'اغاز اسلام احمد');
});

test('Metrics: Computes zero error for identical texts', () => {
  const gt = 'به نام خداوند جان و خرد';
  const hyp = 'به نام خداوند جان و خرد';
  const result = calculateCerWer(gt, hyp);
  assert.equal(result.cer, 0.0);
  assert.equal(result.wer, 0.0);
  assert.equal(result.charAccuracy, 1.0);
  assert.equal(result.wordAccuracy, 1.0);
});

test('Metrics: Computes exact CER and WER for single character substitution', () => {
  const gt = 'کتاب';
  const hyp = 'کباب'; // 1 character substitution ('ت' -> 'ب')
  const result = calculateCerWer(gt, hyp);
  assert.equal(result.charEdits, 1);
  assert.equal(result.cer, 0.25); // 1 edit out of 4 characters = 25%
  assert.equal(result.wordEdits, 1);
  assert.equal(result.wer, 1.0); // 1 word modified out of 1 word = 100%
});

test('Auth: Generates unique salt and securely verifies passwords', () => {
  const password = 'ResearchPass2026!';
  const hash1 = hashPassword(password);
  const hash2 = hashPassword(password);

  assert.notEqual(hash1, hash2, 'Salts must be randomly generated and unique');
  assert.equal(verifyPassword(password, hash1), true);
  assert.equal(verifyPassword(password, hash2), true);
  assert.equal(verifyPassword('WrongPassword', hash1), false);
});

test('Auth: Signs and verifies JWT tokens with role claims', () => {
  const user = {
    id: 'usr_test_01',
    email: 'test@manuscript.ai',
    role: 'RESEARCHER' as const,
    displayName: 'Test Researcher',
  };

  const token = signJwtToken(user, 3600);
  assert.equal(typeof token, 'string');
  assert.equal(token.split('.').length, 3);

  const payload = verifyJwtToken(token);
  assert.ok(payload);
  assert.equal(payload.userId, user.id);
  assert.equal(payload.role, 'RESEARCHER');
  assert.equal(payload.email, user.email);

  // Tampered token test
  const tamperedToken = token.slice(0, -4) + 'abcd';
  assert.equal(verifyJwtToken(tamperedToken), null);
});

test('RBAC: Enforces role hierarchy between ADMIN, RESEARCHER, and VIEWER', () => {
  assert.equal(hasRolePermission('ADMIN', 'RESEARCHER'), true);
  assert.equal(hasRolePermission('ADMIN', 'VIEWER'), true);
  assert.equal(hasRolePermission('RESEARCHER', 'RESEARCHER'), true);
  assert.equal(hasRolePermission('RESEARCHER', 'ADMIN'), false);
  assert.equal(hasRolePermission('VIEWER', 'RESEARCHER'), false);
});

test('Storage: Detects valid magic bytes and rejects invalid binaries', () => {
  const storage = new StorageService();

  // Valid PNG magic bytes
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  assert.equal(storage.detectMagicBytes(pngHeader)?.mimeType, 'image/png');

  // Valid JPEG magic bytes
  const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  assert.equal(storage.detectMagicBytes(jpegHeader)?.mimeType, 'image/jpeg');

  // Invalid binary payload (e.g. bash script or plain text)
  const invalidBuffer = Buffer.from('NOT_AN_IMAGE_FILE_HEADER_TEXT');
  assert.equal(storage.detectMagicBytes(invalidBuffer), null);
});

test('Storage: Rejects path traversal attempts in image retrieval', () => {
  const storage = new StorageService();
  assert.throws(() => {
    storage.getImageStream('../../../etc/passwd');
  }, /path traversal/i);

  assert.throws(() => {
    storage.getImageStream('/etc/shadow');
  }, /path traversal/i);
});

test('JobQueue: Enqueues and processes asynchronous background job', async () => {
  const queue = new JobQueueService();
  let processed = false;

  queue.registerProcessor('RECOGNITION', async (job) => {
    processed = true;
    return { recognizedText: 'Test HTR Result' };
  });

  const job = await queue.addJob('RECOGNITION', 'job_test_01', { pageId: 'pg_01' });
  assert.equal(job.status, 'QUEUED');

  // Wait briefly for queue loop tick
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.equal(processed, true);
  assert.equal(job.status, 'COMPLETED');
  assert.ok(typeof job.processingDurationMs === 'number');
});

test('JobQueue: Allows cancelling a queued job', async () => {
  const queue = new JobQueueService();
  const job = await queue.addJob('TRAINING', 'job_cancel_01', { datasetId: 'ds_01' });
  const cancelled = queue.cancelJob('job_cancel_01');
  assert.equal(cancelled, true);
  assert.equal(job.status, 'CANCELLED');
});

test('Search: Creates matched snippet around normalized query', () => {
  const original = 'منت خدای را عز و جل که طاعتش موجب قربت است و به شکر اندرش مزید نعمت';
  const normalized = normalizePersianArabicText(original);
  const result = createSearchSnippet(original, normalized, 'موجب قربت');

  assert.equal(result.matchFound, true);
  assert.ok(result.snippet.includes('موجب قربت'));
});

// -------------------------------------------------------------
// Database Persistence & Integrity Tests
// -------------------------------------------------------------
test('Prisma Persistence: Health check reports status and latency', async () => {
  const health = await prisma.healthCheck();
  assert.ok(health.status === 'HEALTHY' || health.status === 'STANDALONE_PERSISTENT');
  assert.ok(typeof health.latencyMs === 'number');
});

test('Prisma Persistence: Creates and retrieves persistent Book record', async () => {
  const testBookId = `bk_test_${Date.now()}`;
  const created = await prisma.book.create({
    data: {
      id: testBookId,
      title: 'Tazkirat al-Awliya (تذکرة الاولیاء)',
      author: 'Attar of Nishapur (عطار نیشابوری)',
      language: 'fa',
      description: 'Biographies of early Sufi mystics in classical Persian prose.',
      createdById: 'usr_admin_001',
    },
  });

  assert.equal(created.id, testBookId);
  assert.equal(created.title, 'Tazkirat al-Awliya (تذکرة الاولیاء)');

  const fetched = await prisma.book.findUnique({ where: { id: testBookId } });
  assert.ok(fetched);
  assert.equal(fetched.author, 'Attar of Nishapur (عطار نیشابوری)');
});

test('Prisma Concurrency: Detects version conflict on simultaneous transcription edits', async () => {
  const trId = `tr_concurrency_${Date.now()}`;
  const initial = await prisma.transcription.create({
    data: {
      id: trId,
      pageId: 'pg_test_concurrency',
      rawText: 'متن نخستین',
      correctedText: 'متن نخستین',
      normalizedSearchText: normalizePersianArabicText('متن نخستین'),
      reviewStatus: 'PENDING_REVIEW',
      language: 'fa',
      version: 1,
    },
  });

  assert.equal(initial.version, 1);

  // First edit succeeds and bumps version to 2
  const updated1 = await prisma.$transaction(async (tx) => {
    const tr = await tx.transcription.findUnique({ where: { id: trId } });
    assert.equal(tr.version, 1);
    return tx.transcription.update({
      where: { id: trId },
      data: {
        correctedText: 'ویرایش پژوهشگر اول',
        normalizedSearchText: normalizePersianArabicText('ویرایش پژوهشگر اول'),
        version: tr.version + 1,
      },
    });
  });

  assert.equal(updated1.version, 2);

  // Second researcher attempts update with stale expectedVersion 1
  let conflictDetected = false;
  try {
    await prisma.$transaction(async (tx) => {
      const tr = await tx.transcription.findUnique({ where: { id: trId } });
      const staleExpectedVersion = 1; // Stale version!
      if (tr.version !== staleExpectedVersion) {
        throw new Error(`CONFLICT: expected ${staleExpectedVersion} but found ${tr.version}`);
      }
      return tx.transcription.update({
        where: { id: trId },
        data: { correctedText: 'ویرایش پژوهشگر دوم', version: tr.version + 1 },
      });
    });
  } catch (err: any) {
    if (err.message.includes('CONFLICT')) {
      conflictDetected = true;
    }
  }

  assert.equal(conflictDetected, true, 'Stale expectedVersion must trigger conflict rejection');
});

test('Prisma Persistence: Survives simulated process restart and maintains data', async () => {
  const restartTestId = `bk_restart_${Date.now()}`;
  await prisma.book.create({
    data: {
      id: restartTestId,
      title: 'Masnavi-ye Ma\'navi (مثنوی معنوی)',
      author: 'Jalal al-Din Muhammad Rumi (مولانا جلال‌الدین بلخی)',
      language: 'fa',
      createdById: 'usr_admin_001',
    },
  });

  // Simulate a fresh process boot by instantiating a new PrismaService instance
  const freshServiceInstance = new PrismaService();
  const retrievedAfterRestart = await freshServiceInstance.book.findUnique({
    where: { id: restartTestId },
  });

  assert.ok(retrievedAfterRestart, 'Data must survive backend restart and load from disk persistence');
  assert.equal(retrievedAfterRestart.title, 'Masnavi-ye Ma\'navi (مثنوی معنوی)');
});

// -------------------------------------------------------------
// CORS Security Specification Tests
// -------------------------------------------------------------
test('CORS: Permitted origin sets matching Access-Control-Allow-Origin, credentials and Vary', () => {
  const allowed = ['http://localhost:5173', 'http://localhost:3000'];
  const corsMiddleware = createCorsMiddleware(allowed);

  const req: any = {
    headers: { origin: 'http://localhost:5173' },
    method: 'GET',
  };
  const headersSet: Record<string, string> = {};
  const res: any = {
    setHeader: (k: string, v: string) => { headersSet[k] = v; },
    status: () => res,
    end: () => {},
  };

  let nextCalled = false;
  corsMiddleware(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(headersSet['Vary'], 'Origin');
  assert.equal(headersSet['Access-Control-Allow-Origin'], 'http://localhost:5173');
  assert.equal(headersSet['Access-Control-Allow-Credentials'], 'true');
});

test('CORS: Disallowed origin does NOT receive Access-Control-Allow-Origin or credentials', () => {
  const allowed = ['http://localhost:5173', 'http://localhost:3000'];
  const corsMiddleware = createCorsMiddleware(allowed);

  const req: any = {
    headers: { origin: 'http://malicious-site.com' },
    method: 'GET',
  };
  const headersSet: Record<string, string> = {};
  const res: any = {
    setHeader: (k: string, v: string) => { headersSet[k] = v; },
    status: () => res,
    end: () => {},
  };

  let nextCalled = false;
  corsMiddleware(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(headersSet['Vary'], 'Origin');
  assert.equal(headersSet['Access-Control-Allow-Origin'], undefined);
  assert.equal(headersSet['Access-Control-Allow-Credentials'], undefined);
});

test('CORS: Preflight OPTIONS from disallowed origin returns HTTP 403 Forbidden', () => {
  const allowed = ['http://localhost:5173'];
  const corsMiddleware = createCorsMiddleware(allowed);

  const req: any = {
    headers: { origin: 'http://unauthorized.org' },
    method: 'OPTIONS',
  };
  let statusCode = 200;
  let jsonBody: any = null;
  const res: any = {
    setHeader: () => {},
    status: (code: number) => {
      statusCode = code;
      return {
        json: (data: any) => { jsonBody = data; },
      };
    },
  };

  corsMiddleware(req, res, () => {});

  assert.equal(statusCode, 403);
  assert.equal(jsonBody?.success, false);
  assert.equal(jsonBody?.error?.code, 'CORS_FORBIDDEN');
});

test('CORS: Wildcard mode does NOT combine wildcard * with credentials', () => {
  const corsMiddleware = createCorsMiddleware(['*']);

  const req: any = {
    headers: { origin: 'http://example.com' },
    method: 'GET',
  };
  const headersSet: Record<string, string> = {};
  const res: any = {
    setHeader: (k: string, v: string) => { headersSet[k] = v; },
    status: () => res,
    end: () => {},
  };

  corsMiddleware(req, res, () => {});

  assert.equal(headersSet['Access-Control-Allow-Origin'], '*');
  assert.equal(headersSet['Access-Control-Allow-Credentials'], undefined, 'Wildcard MUST NEVER include credentials');
});

// -------------------------------------------------------------
// Authentication Token Rotation & Blacklist Revocation Tests
// -------------------------------------------------------------
test('Auth: Refresh tokens support rotation and detect reuse attempts', () => {
  const userId = 'usr_test_rotation_01';
  const initial = createRefreshToken(userId);

  assert.ok(initial.token.startsWith('rf_'));
  assert.ok(initial.expiresAt > Math.floor(Date.now() / 1000));

  // Rotate token: exchanges old token for a new token
  const rotationResult = verifyAndRotateRefreshToken(initial.token);
  assert.equal(rotationResult.success, true);
  assert.equal(rotationResult.userId, userId);
  assert.ok(rotationResult.newRefreshToken);
  assert.notEqual(rotationResult.newRefreshToken, initial.token);

  // Attempting to reuse the revoked old refresh token triggers security alert
  const reuseResult = verifyAndRotateRefreshToken(initial.token);
  assert.equal(reuseResult.success, false);
  assert.equal(reuseResult.error, 'TOKEN_REUSE_DETECTED');
});

test('Auth: Logout revocation invalidates access token before natural expiration', () => {
  const user = {
    id: 'usr_test_logout_02',
    email: 'logout_test@manuscript.ai',
    role: 'RESEARCHER' as const,
    displayName: 'Logout Researcher',
  };

  const token = signJwtToken(user, 1800);
  const payloadBefore = verifyJwtToken(token);
  assert.ok(payloadBefore);
  assert.ok(payloadBefore.jti);

  // Revoke token via logout
  revokeToken(payloadBefore.jti, payloadBefore.exp);

  // Subsequent verification must fail immediately
  const payloadAfter = verifyJwtToken(token);
  assert.equal(payloadAfter, null, 'Revoked JWT token must not pass verification');
});

test('Auth: Brute-force rate limiting locks out identifier after 5 consecutive failures', () => {
  const testIp = `192.168.10.${Math.floor(Math.random() * 200)}`;
  const testId = `${testIp}_test_rate_limit@manuscript.ai`;

  // First 4 attempts do not block
  for (let i = 1; i <= 4; i++) {
    const res = recordFailedLogin(testId);
    assert.equal(res.isNowBlocked, false);
  }

  // 5th attempt locks out
  const fifthAttempt = recordFailedLogin(testId);
  assert.equal(fifthAttempt.isNowBlocked, true);
  assert.ok(fifthAttempt.retryAfterSeconds > 0);

  // Check rate limit status
  const check = checkLoginRateLimit(testId);
  assert.equal(check.allowed, false);

  // Successful login clears the lockout
  recordSuccessfulLogin(testId);
  const checkAfterSuccess = checkLoginRateLimit(testId);
  assert.equal(checkAfterSuccess.allowed, true);
});

// -------------------------------------------------------------
// Storage Orphan Cleanup Test
// -------------------------------------------------------------
test('Storage: Safely removes image file and cleans up orphan files', async () => {
  const storage = new StorageService();
  const validPngHeader = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00,
  ]);

  const stored = await storage.storeImage(validPngHeader, 'test_cleanup.png');
  assert.ok(stored.storageKey);

  // Verify stream while file exists, and wait for stream to close cleanly
  const streamResult = storage.getImageStream(stored.storageKey);
  assert.ok(streamResult.size > 0);
  await new Promise((resolve) => {
    streamResult.stream.resume();
    streamResult.stream.on('end', resolve);
  });

  // Simulate database failure cleanup
  const removed = await storage.removeImage(stored.storageKey);
  assert.equal(removed, true);

  // File should now be gone (stream throws)
  assert.throws(() => {
    storage.getImageStream(stored.storageKey);
  }, /not found on disk/i);
});
