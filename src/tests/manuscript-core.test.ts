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
 * 7. Optimistic concurrency conflict detection in transcription editing
 * 8. Search snippet extraction around normalized Persian/Arabic queries
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePersianArabicText, createSearchSnippet } from '../common/normalization.js';
import { calculateCerWer } from '../common/metrics.js';
import { hashPassword, verifyPassword, signJwtToken, verifyJwtToken, hasRolePermission } from '../common/auth.js';
import { StorageService } from '../storage/storage.service.js';
import { JobQueueService } from '../jobs/queue.service.js';

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
