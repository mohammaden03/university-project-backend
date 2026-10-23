# Manuscript AI — Architecture & Systems Design

## 1. System Overview

**Manuscript AI** is an academic platform for handwritten text recognition (HTR), optical character recognition (OCR), Persian and Arabic manuscript cataloging, transcription correction, and research text discovery.

The platform is designed around four decoupled layers:

1. **Independent React SPA Frontend** (developed in a separate repository, communicating solely over HTTP REST and JSON).
2. **Main Application Backend (NestJS / Express + TypeScript)** serving the API contract at `/api/v1/*` with RBAC authorization, revision history, and search indexing.
3. **Relational Database Engine (PostgreSQL + Prisma ORM)** holding metadata, transcription revisions, and dataset manifests.
4. **Python FastAPI AI Microservice** providing deep learning model inference (TrOCR, HTR-Naskh), PyTorch batch inference, and CER/WER Levenshtein evaluation.

```
┌────────────────────────────────┐
│   Independent React Frontend   │  (Runs on localhost:5173 or CDN)
└───────────────┬────────────────┘
                │  REST API Calls / JWT Bearer
                ▼
┌────────────────────────────────┐
│     Manuscript AI Backend      │  (Node.js / Express / NestJS :3000)
│    - Auth & Role Guards        │
│    - Persian/Arabic Normalizer │
│    - Optimistic Concurrency    │
│    - Swagger OpenAPI (/docs)   │
└───────┬────────────────┬───────┘
        │                │
        │ Prisma         │ HTTP / JSON
        ▼                ▼
┌───────────────┐ ┌───────────────────────────┐
│  PostgreSQL   │ │  Python AI Microservice   │ (FastAPI :8000)
│   Database    │ │  - TrOCR / HTR Naskh      │
│  (12 Tables)  │ │  - Deterministic Mock     │
└───────────────┘ │  - CER / WER Evaluator    │
                  └───────────────────────────┘
```

## 2. Service Separation & Network Boundaries

- **Public Traffic**: Only the main backend (port 3000) is accessible from the frontend client.
- **Internal Microservice**: The Python AI service (port 8000) and PostgreSQL (port 5432) run in internal Docker networks or localhost interfaces and are never exposed publicly.
- **Filesystem Decoupling**: Original manuscript images are stored in `./storage/uploads` using server-generated SHA-256 keys. The frontend accesses images solely through the authenticated streaming endpoint `/api/v1/pages/:id/image`.

## 3. High-Resolution Manuscript Workflow

1. **Upload & Cataloging**: A researcher creates a `Book` and uploads historical folios (`POST /api/v1/books/:id/pages`). File contents are validated for magic byte signatures (JPEG, PNG, WebP) and dimensions are recorded.
2. **Recognition Pipeline**: The researcher triggers an HTR job (`POST /api/v1/pages/:id/recognition-jobs`). The job enters the `QUEUED` state, executes inference via the AI service, and records duration and line boxes.
3. **Academic Transcription Review**: A `Transcription` record is created. Researchers correct errors, with the system creating immutable `TranscriptionRevision` rows while preserving the raw model output.
4. **Normalized Indexing**: Text changes are processed through the Persian/Arabic Unicode normalization pipeline (unifying Yeh, Kaf, Alef, stripping diacritics and tatweel) to populate `normalizedSearchText`.
5. **Approval**: An authorized researcher or admin approves the transcription, updating `reviewStatus` to `APPROVED`.
