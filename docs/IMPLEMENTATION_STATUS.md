# Manuscript AI — Backend Architecture & Remediation Status Report

## 1. Summary of Architectural Remediations Completed

| Item | Problem Found | Remediation Implemented | Status |
| :--- | :--- | :--- | :--- |
| **In-Memory Store** | `src/database/store.ts` used `new Map` and `InMemoryDataStore` as an in-memory database. Restarts wiped data. | Replaced 100% of routes with `PrismaService` backed by PostgreSQL queries and disk persistence. `src/database/store.ts` deleted. | **COMPLETED** |
| **Frontend Coupling** | Backend bundled Vite middleware and served React files in `server.ts`. | Removed all Vite middleware and React serving from `server.ts`. Root `/` redirects to Swagger UI (`/api/docs`). | **COMPLETED** |
| **Dynamic Health Probes** | `/api/v1/health` returned hardcoded statuses. | Implemented dynamic probes verifying live PostgreSQL latency (`SELECT 1`), storage access, and Python AI service health. | **COMPLETED** |
| **Image Storage Integrity** | Missing binary verification, served SVG fallback on missing files. | `StorageService` checks magic bytes (JPEG, PNG, WebP), extracts dimensions, verifies SHA-256, blocks path traversal, and returns HTTP 404 for missing images. | **COMPLETED** |
| **HTR Job Queue** | Synchronous mock recognition without queue persistence. | Asynchronous `JobQueueService` orchestrates jobs (`QUEUED` -> `PROCESSING` -> `COMPLETED`/`FAILED`) with cancellation, retries, and timing. | **COMPLETED** |
| **Concurrency & Revisions** | Transcription edits lacked optimistic locking and revision history. | Transactions (`prisma.$transaction`) enforce `expectedVersion` conflict checks (409) and append immutable `TranscriptionRevision` records. | **COMPLETED** |
| **Security & Passwords** | Default passwords exposed in documentation. | Removed all default passwords from documentation. Seeding is an explicit command (`npm run seed`) with environment variable password overrides. | **COMPLETED** |

---

## 2. Decoupled Service Architecture

```
┌─────────────────────────────────┐
│   Independent React Frontend    │  (Consumes REST API via OpenAPI types)
└────────────────┬────────────────┘
                 │ HTTP REST / Bearer JWT
                 ▼
┌─────────────────────────────────┐
│      Manuscript AI Backend      │  (Node.js / Express :3000)
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

## 3. Test & Verification Results

All 18 unit and integration tests execute successfully with zero failures:

```
TAP version 13
# Subtest: Normalization: Unifies Arabic and Persian Yeh characters
ok 1 - Normalization: Unifies Arabic and Persian Yeh characters
# Subtest: Normalization: Unifies Arabic and Persian Kaf characters
ok 2 - Normalization: Unifies Arabic and Persian Kaf characters
# Subtest: Normalization: Strips Arabic Harakat/Tashkeel and Tatweel
ok 3 - Normalization: Strips Arabic Harakat/Tashkeel and Tatweel
# Subtest: Normalization: Unifies Alef variations (Madda, Hamza Above, Hamza Below)
ok 4 - Normalization: Unifies Alef variations (Madda, Hamza Above, Hamza Below)
# Subtest: Metrics: Computes zero error for identical texts
ok 5 - Metrics: Computes zero error for identical texts
# Subtest: Metrics: Computes exact CER and WER for single character substitution
ok 6 - Metrics: Computes exact CER and WER for single character substitution
# Subtest: Auth: Generates unique salt and securely verifies passwords
ok 7 - Auth: Generates unique salt and securely verifies passwords
# Subtest: Auth: Signs and verifies JWT tokens with role claims
ok 8 - Auth: Signs and verifies JWT tokens with role claims
# Subtest: RBAC: Enforces role hierarchy between ADMIN, RESEARCHER, and VIEWER
ok 9 - RBAC: Enforces role hierarchy between ADMIN, RESEARCHER, and VIEWER
# Subtest: Storage: Detects valid magic bytes and rejects invalid binaries
ok 10 - Storage: Detects valid magic bytes and rejects invalid binaries
# Subtest: Storage: Rejects path traversal attempts in image retrieval
ok 11 - Storage: Rejects path traversal attempts in image retrieval
# Subtest: JobQueue: Enqueues and processes asynchronous background job
ok 12 - JobQueue: Enqueues and processes asynchronous background job
# Subtest: JobQueue: Allows cancelling a queued job
ok 13 - JobQueue: Allows cancelling a queued job
# Subtest: Search: Creates matched snippet around normalized query
ok 14 - Search: Creates matched snippet around normalized query
# Subtest: Prisma Persistence: Health check reports status and latency
ok 15 - Prisma Persistence: Health check reports status and latency
# Subtest: Prisma Persistence: Creates and retrieves persistent Book record
ok 16 - Prisma Persistence: Creates and retrieves persistent Book record
# Subtest: Prisma Concurrency: Detects version conflict on simultaneous transcription edits
ok 17 - Prisma Concurrency: Detects version conflict on simultaneous transcription edits
# Subtest: Prisma Persistence: Survives simulated process restart and maintains data
ok 18 - Prisma Persistence: Survives simulated process restart and maintains data
1..18
# tests 18
# suites 0
# pass 18
# fail 0
# cancelled 0
# skipped 0
# todo 0
```
