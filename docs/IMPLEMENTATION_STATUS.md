# Manuscript AI — Implementation Status & Acceptance Matrix

| # | Product Requirement | Status | Verification & Endpoints |
| :--- | :--- | :--- | :--- |
| 1 | Authenticate & manage sessions | COMPLETED | `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, `POST /api/v1/auth/logout`. RBAC: ADMIN, RESEARCHER, VIEWER |
| 2 | Create, edit, list, and retrieve books | COMPLETED | `GET /api/v1/books`, `POST /api/v1/books`, `GET /api/v1/books/:id`, `PATCH /api/v1/books/:id`, `DELETE /api/v1/books/:id` |
| 3 | Upload and manage historical manuscript page images | COMPLETED | `GET /api/v1/books/:bookId/pages`, `POST /api/v1/books/:bookId/pages`, `GET /api/v1/pages/:id`, `GET /api/v1/pages/:id/image` (SHA-256 validated) |
| 4 | Submit pages for OCR/HTR recognition | COMPLETED | `POST /api/v1/pages/:id/recognition-jobs` (LINE & FULL_PAGE modes supported) |
| 5 | Track recognition job progress | COMPLETED | `GET /api/v1/recognition-jobs`, `GET /api/v1/recognition-jobs/:id` |
| 6 | Retrieve recognition results | COMPLETED | `GET /api/v1/pages/:id/transcriptions` |
| 7 | Edit and save corrected transcriptions | COMPLETED | `PATCH /api/v1/transcriptions/:id` with optimistic concurrency locking |
| 8 | Preserve transcription revision history | COMPLETED | `GET /api/v1/transcriptions/:id/revisions`, `POST /api/v1/transcriptions/:id/approve` |
| 9 | Search manuscript text and metadata | COMPLETED | `GET /api/v1/search` with Persian/Arabic Unicode normalization (Yeh/Kaf/Alef/diacritics/tatweel) |
| 10 | Manage dataset metadata & validate manifests | COMPLETED | `GET /api/v1/datasets`, `POST /api/v1/datasets/validate` (CSV manifest, split checks, path security) |
| 11 | Inspect available recognition models | COMPLETED | `GET /api/v1/models` (TrOCR-Base Persian, HTR-Naskh Arabic, Mock Dev Provider) |
| 12 | Launch and monitor model evaluation | COMPLETED | `POST /api/v1/evaluations`, `GET /api/v1/evaluations` (Exact CER & WER Levenshtein calculation) |
| 13 | Configure and monitor fine-tuning jobs | COMPLETED | `POST /api/v1/training-jobs`, `GET /api/v1/training-jobs` |
| 14 | Retrieve dashboard statistics | COMPLETED | `GET /api/v1/dashboard/stats` (Real database aggregations) |
| 15 | Manage users and roles | COMPLETED | `GET /api/v1/users`, `POST /api/v1/users` (ADMIN only) |
| 16 | Access API documentation | COMPLETED | `GET /api/docs` (Interactive Swagger UI), `GET /api/docs-json` (OpenAPI 3.0) |
| 17 | Check system health and readiness | COMPLETED | `GET /api/v1/health` |
