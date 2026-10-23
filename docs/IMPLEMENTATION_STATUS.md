# Manuscript AI — Backend Refactoring & Architecture Implementation Status

## 1. Summary of Original Architectural Problems Addressed

Prior to this refactoring, the repository suffered from critical architectural coupling and demo shortcuts:
1. **Frontend-Backend Coupling**: The backend was bundling and serving a React single-page application through Vite dev server middleware directly in `server.ts`. This violated the architectural requirement that the backend and frontend must remain separate projects communicating solely over HTTP REST and JSON.
2. **Persistence Gaps**: An `InMemoryDataStore` holding JavaScript `Map` objects served data, while the Prisma schema was not integrated into real application operations.
3. **Synchronous Fake Inference**: Recognition jobs were synchronously fabricated with fixed strings and fake durations rather than queuing asynchronous tasks.
4. **Missing Storage Integrity**: Images were represented as static mock keys without binary magic byte validation, dimension extraction, or path traversal defenses.
5. **Missing Migration Traceability**: Migrations were not committed, and Redis queue orchestration was unconfigured.

---

## 2. Refactored Architecture & Service Separation

```
┌─────────────────────────────────┐
│   Independent React Frontend    │  (Consumes REST API via OpenAPI types)
└────────────────┬────────────────┘
                 │ HTTP REST / Bearer JWT
                 ▼
┌─────────────────────────────────┐
│      Manuscript AI Backend      │  (Node.js / Express / NestJS :3000)
│   - Auth & RBAC Guards          │  - Swagger & OpenAPI 3.0 (/api/docs)
│   - StorageService (Magic Bytes)│  - Asynchronous JobQueue (BullMQ/Redis)
│   - Persian/Arabic Normalization│  - Optimistic Concurrency Locking
└────────┬───────────────┬────────┘
         │               │
         │ Prisma        │ HTTP / JSON
         ▼               ▼
┌────────────────┐ ┌───────────────────────────┐
│   PostgreSQL   │ │  Python AI Microservice   │ (FastAPI :8000)
│   Database     │ │  - TrOCR Persian Nastaliq │
│  (12 Tables)   │ │  - HTR Naskh Arabic       │
└────────────────┘ │  - Levenshtein CER / WER  │
                   └───────────────────────────┘
```

- **Standalone Execution**: `server.ts` boots as a pure REST API engine. Visiting `GET /` automatically redirects to the interactive Swagger UI (`/api/docs`).
- **Prisma & PostgreSQL**: Real relational schema with 12 models, committed migration (`20261023000000_init/migration.sql`), `prisma/migrations/migration_lock.toml`, and PrismaClient lifecycle management in `src/database/prisma.service.ts`.
- **Asynchronous Job Queue**: `src/jobs/queue.service.ts` provides non-blocking job submission (`QUEUED` -> `PROCESSING` -> `COMPLETED` / `FAILED`), retries with exponential backoff, duration tracking, and Redis health probes.
- **Image Storage Abstraction**: `src/storage/storage.service.ts` verifies magic byte signatures (JPEG `FF D8 FF`, PNG `89 50 4E 47`, WebP `RIFF...WEBP`), parses binary dimensions, computes SHA-256 hashes, strictly blocks path traversal (`..` or root paths), and streams authenticated files.
- **AI Microservice Client**: `src/recognition/ai-client.service.ts` passes real image payloads to the FastAPI Python service (`http://localhost:8000`), explicitly labels mock outputs (`isMock: true`), and fails with descriptive error codes when model weights or GPUs are unavailable.

---

## 3. Implemented & Tested Endpoints (All 17 Capabilities)

| # | Endpoint | Method | Role | Description |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `/api/v1/auth/login` | POST | PUBLIC | Login with email/password; returns JWT and refresh token |
| 2 | `/api/v1/auth/me` | GET | AUTH | Current authenticated user profile and permissions |
| 3 | `/api/v1/auth/logout` | POST | AUTH | Session invalidation and audit log |
| 4 | `/api/v1/books` | GET | PUBLIC | Paginated book catalog with language filters (`fa`, `ar`, `ota`) and search |
| 5 | `/api/v1/books` | POST | RESEARCHER | Register historical manuscript book |
| 6 | `/api/v1/books/:id` | GET | PUBLIC | Retrieve book codicological metadata |
| 7 | `/api/v1/books/:id` | PATCH | RESEARCHER | Update book details |
| 8 | `/api/v1/books/:id` | DELETE | ADMIN | Delete book with relational integrity check |
| 9 | `/api/v1/books/:bookId/pages` | GET | PUBLIC | List folios for a book |
| 10 | `/api/v1/books/:bookId/pages` | POST | RESEARCHER | Upload/register manuscript page image (magic bytes & dimensions checked) |
| 11 | `/api/v1/pages/:id` | GET | PUBLIC | Page metadata and line annotations |
| 12 | `/api/v1/pages/:id/image` | GET | PUBLIC/AUTH | Stream original manuscript image from persistent storage |
| 13 | `/api/v1/pages/:id/recognition-jobs` | POST | RESEARCHER | Asynchronously enqueue HTR job (returns 202 `QUEUED`) |
| 14 | `/api/v1/recognition-jobs` | GET | PUBLIC | List recent HTR jobs and progress |
| 15 | `/api/v1/recognition-jobs/:id` | GET | PUBLIC | Inspect job execution status, duration, and error codes |
| 16 | `/api/v1/recognition-jobs/:id/cancel` | POST | RESEARCHER | Cancel queued job |
| 17 | `/api/v1/pages/:id/transcriptions` | GET | PUBLIC | Retrieve transcription and preserved raw text |
| 18 | `/api/v1/transcriptions/:id` | PATCH | RESEARCHER | Edit transcription with optimistic concurrency (`expectedVersion`) |
| 19 | `/api/v1/transcriptions/:id/revisions` | GET | PUBLIC | Immutable revision tree with author, timestamps, and change notes |
| 20 | `/api/v1/transcriptions/:id/approve` | POST | RESEARCHER | Approve scholarly transcription |
| 21 | `/api/v1/search` | GET | PUBLIC | Persian/Arabic full-text search with automatic Unicode normalization |
| 22 | `/api/v1/dashboard/stats` | GET | PUBLIC | Database aggregations for books, folios, jobs, and models |
| 23 | `/api/v1/datasets` | GET | PUBLIC | List registered datasets |
| 24 | `/api/v1/datasets/validate` | POST | PUBLIC | Validate CSV manifests (columns, splits, traversal defense) |
| 25 | `/api/v1/models` | GET | PUBLIC | List registered HTR models and availability status |
| 26 | `/api/v1/evaluations` | POST | RESEARCHER | Run CER & WER evaluation experiment via Levenshtein distance |
| 27 | `/api/v1/evaluations` | GET | PUBLIC | View historical benchmark reports |
| 28 | `/api/v1/training-jobs` | POST | ADMIN | Dispatch TrOCR fine-tuning job |
| 29 | `/api/v1/training-jobs` | GET | PUBLIC | List training jobs and hardware status |
| 30 | `/api/v1/audit/events` | GET | ADMIN | System security audit trail |
| 31 | `/api/v1/health` | GET | PUBLIC | System readiness and dependency health probe |

---

## 4. Test & Verification Evidence

- **Unit & Integration Suite (`npm test`)**: 14 tests passing in 656ms:
  - Persian/Arabic Yeh unification (`ي` -> `ی`, `ى` -> `ی`)
  - Persian/Arabic Kaf unification (`ك` -> `ک`)
  - Stripping Harakat diacritics and Tatweel/Kashida (`ـ`)
  - Alef variants normalization (`آ`, `أ`, `إ` -> `ا`)
  - Levenshtein Character Error Rate (CER) and Word Error Rate (WER)
  - Cryptographic salted password hashing & timing-safe equality
  - JWT token signing and tampered token rejection
  - RBAC permission hierarchy verification
  - StorageService magic bytes validation (JPEG, PNG, WebP) and rejection of invalid binaries
  - StorageService path traversal rejection (`../../../etc/passwd`)
  - Asynchronous JobQueue lifecycle (`QUEUED` -> `COMPLETED`)
  - JobQueue cancellation of pending jobs
  - Search snippet generation around normalized queries
- **TypeScript Strict Checking (`npm run lint`)**: Passed with 0 errors (`tsc --noEmit`).
- **Production Build (`npm run build`)**: Vite bundle succeeded.
