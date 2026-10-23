# Manuscript AI — Backend Platform

An academic platform for handwritten text recognition (HTR), optical character recognition (OCR), historical Persian and Arabic manuscript cataloging, transcription correction with revision history, dataset management, and CER/WER evaluation.

---

## 1. Quick Links

- **REST API Base**: `http://localhost:3000/api/v1`
- **Interactive Swagger Documentation**: `http://localhost:3000/api/docs`
- **OpenAPI 3.0 Specification**: `http://localhost:3000/api/docs-json`
- **Health Check & Readiness**: `http://localhost:3000/api/v1/health`
- **Interactive Academic Workbench**: `http://localhost:3000/`

---

## 2. Default Seed Credentials

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@manuscript.ai` | `AdminPass2026!` | Full system administration, models, training jobs, audit logs |
| **Researcher** | `researcher@manuscript.ai` | `ResearchPass2026!` | Book CRUD, folio uploads, HTR jobs, transcription editing & approval |
| **Viewer** | `viewer@manuscript.ai` | `ViewerPass2026!` | Read-only access to published manuscripts, folios, and approved text |

---

## 3. Starting the Backend

### Local Development (Host-based)
```bash
# 1. Install dependencies
npm install

# 2. Run unit tests
npm test

# 3. Start full-stack server
npm run dev
```

### Docker-based Orchestration (Full Stack: PostgreSQL + Backend + AI Service)
```bash
docker-compose up -d --build
```

---

## 4. Frontend Integration & TypeScript Type Generation

The React frontend is developed independently. You can automatically generate end-to-end typed API definitions directly from this backend's OpenAPI specification:

```bash
# Inside your separate React frontend repository:
npx openapi-typescript http://localhost:3000/api/docs-json -o src/types/api.d.ts
```

### Standard API Response Envelope
Every endpoint returns a consistent JSON envelope:
```json
{
  "success": true,
  "data": { ... },
  "meta": null
}
```

For paginated resources:
```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

For errors:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title is a mandatory field",
    "details": [
      { "field": "title", "message": "Title cannot be empty" }
    ]
  }
}
```

---

## 5. Complete Implemented Endpoint Catalog

### Authentication
- `POST /api/v1/auth/login` — Authenticate and receive JWT access token
- `GET /api/v1/auth/me` — Retrieve current authenticated user profile
- `POST /api/v1/auth/logout` — Invalidate user session

### Books Management
- `GET /api/v1/books` — Paginated list with language filters (`fa`, `ar`, `ota`) and search
- `POST /api/v1/books` — Create new manuscript record
- `GET /api/v1/books/:id` — Retrieve book metadata
- `PATCH /api/v1/books/:id` — Update book metadata
- `DELETE /api/v1/books/:id` — Delete book (ADMIN only)

### Manuscript Pages & Folios
- `GET /api/v1/books/:bookId/pages` — List folios of a book
- `POST /api/v1/books/:bookId/pages` — Upload/register manuscript page
- `GET /api/v1/pages/:id` — Retrieve page metadata and line segmentations
- `PATCH /api/v1/pages/:id` — Update page annotations
- `DELETE /api/v1/pages/:id` — Delete page
- `GET /api/v1/pages/:id/image` — Retrieve high-res folio image or facsimile SVG

### Recognition & HTR Pipeline
- `POST /api/v1/pages/:id/recognition-jobs` — Submit page for HTR (LINE or FULL_PAGE)
- `GET /api/v1/recognition-jobs` — List jobs with status and durations
- `GET /api/v1/recognition-jobs/:id` — Retrieve job status
- `POST /api/v1/recognition-jobs/:id/cancel` — Cancel queued/processing job

### Transcriptions & Revisions
- `GET /api/v1/pages/:id/transcriptions` — Get page transcription
- `GET /api/v1/transcriptions/:id` — Get transcription by ID
- `PATCH /api/v1/transcriptions/:id` — Edit text with optimistic locking version check
- `GET /api/v1/transcriptions/:id/revisions` — Historical revision tree with timestamps and user IDs
- `POST /api/v1/transcriptions/:id/approve` — Mark transcription as APPROVED

### Advanced Search
- `GET /api/v1/search` — Parameterized search with automatic Persian/Arabic Unicode normalization (unifying Yeh, Kaf, Alef, stripping diacritics and tatweel)

### Datasets
- `GET /api/v1/datasets` — List registered datasets
- `POST /api/v1/datasets/validate` — Validate CSV manifests for missing columns, path traversal, and split counts

### Model Registry & Evaluations
- `GET /api/v1/models` — List HTR models and availability status
- `POST /api/v1/evaluations` — Run Levenshtein CER & WER evaluation against ground-truth samples
- `GET /api/v1/evaluations` — Historical benchmark reports

### Training & System Management
- `GET /api/v1/dashboard/stats` — Real calculated counts for books, pages, jobs, and models
- `POST /api/v1/training-jobs` — Dispatch TrOCR fine-tuning job
- `GET /api/v1/training-jobs` — Monitor training runs and logs
- `GET /api/v1/audit/events` — Retrieve security audit trail (ADMIN only)
- `GET /api/v1/health` — System readiness and health check

---

## 6. Persian & Arabic Normalization Rules

Original historical texts are strictly preserved in `rawText` and `correctedText`. For indexing and search, a separate `normalizedSearchText` is generated with:
- Unification of Arabic Yeh (`ي` \u064A) and Alef Maqsura (`ى` \u0649) to Persian Yeh (`ی` \u06CC)
- Unification of Arabic Kaf (`ك` \u0643) to Persian Kaf (`ک` \u06A9)
- Normalization of Alef variants (`آ`, `أ`, `إ`, `ٱ` -> `ا`)
- Stripping of Arabic Harakat / Tashkeel diacritics (Fatha, Damma, Kasra, Sukun, Shadda, Tanween)
- Stripping of Tatweel / Kashida (`ـ`)
- Normalization of Zero-Width Non-Joiner (ZWNJ) and whitespace collapsing
