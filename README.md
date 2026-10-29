# Manuscript AI — Backend Platform

An academic research platform for handwritten text recognition (HTR), optical character recognition (OCR), historical Persian and Arabic manuscript cataloging, transcription correction with revision history, dataset management, and CER/WER evaluation.

---

## 1. Quick Links

- **REST API Base**: `http://localhost:3000/api/v1`
- **Interactive Swagger Documentation**: `http://localhost:3000/api/docs`
- **OpenAPI 3.0 Specification**: `http://localhost:3000/api/docs-json`
- **Health Check & Readiness**: `http://localhost:3000/api/v1/health`

---

## 2. Architecture & Data Flow

```
[Separate React Frontend] (Port 5173)
           │
           ▼ (REST API / Bearer JWT)
[Manuscript AI Backend] (Express + TypeScript, Port 3000)
    ├── Auth & RBAC (ADMIN, RESEARCHER, VIEWER)
    ├── Persian/Arabic Unicode Normalization
    ├── Asynchronous JobQueue (BullMQ/Redis abstraction)
    ├── StorageService (Magic bytes, SHA-256, path traversal guard)
    └── Prisma PostgreSQL Persistence Layer
           │
           ├──► [PostgreSQL 16] (Relational Persistence & Transactions)
           ├──► [Redis 7] (Queue & State Store)
           └──► [Python FastAPI AI Service] (Port 8000: TrOCR / CRNN Inference)
```

---

## 3. Local Development & Commands

### Prerequisites
- Node.js >= 18
- Docker & Docker Compose (or local PostgreSQL 16 & Redis 7)

### Local Setup
```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env

# 3. Seed initial historical manuscripts & accounts explicitly (dev/testing)
# Configure custom passwords via environment variables:
ADMIN_INITIAL_PASSWORD="your-strong-admin-password" \
RESEARCHER_INITIAL_PASSWORD="your-strong-researcher-password" \
VIEWER_INITIAL_PASSWORD="your-strong-viewer-password" \
npm run seed

# 4. Run test suite (unit + PostgreSQL/Prisma integration tests)
npm test

# 5. Start development server
npm run dev

# 6. Production build & start
npm run build
npm start
```

### Full-Stack Docker Deployment
```bash
docker-compose up -d --build
```
This provisions:
- `manuscript-ai-postgres`: PostgreSQL 16 on port 5432 with health checks
- `manuscript-ai-redis`: Redis 7 on port 6379 with health checks
- `manuscript-ai-backend`: Express REST API on port 3000
- `manuscript-ai-inference`: Python FastAPI microservice on port 8000

---

## 4. Environment Variables Configuration

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | HTTP port for the backend server | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://app_user:...@localhost:5432/manuscript_ai` |
| `REDIS_URL` | Redis connection string for asynchronous queue | `redis://localhost:6379` |
| `AI_SERVICE_URL` | URL to Python FastAPI inference microservice | `http://localhost:8000` |
| `AI_PROVIDER` | AI provider mode (`mock`, `pretrained`, `finetuned`) | `mock` |
| `JWT_ACCESS_SECRET` | Secret key for signing HMAC-SHA256 JWT tokens | *(Required, 32+ chars)* |
| `UPLOAD_DIR` | Filesystem path for manuscript folio images | `./storage/uploads` |
| `MODEL_DIR` | Filesystem path for AI model checkpoints | `./storage/models` |
| `ADMIN_INITIAL_PASSWORD` | Explicit password used only during `npm run seed` | *(Custom)* |

---

## 5. Standard API Response Envelope

Every endpoint returns a consistent JSON envelope:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": null
}
```

### Paginated Response
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

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Conflict detected: This transcription was modified by another researcher",
    "details": [
      { "field": "expectedVersion", "message": "Current version is 2" }
    ]
  }
}
```

---

## 6. Complete Endpoint Catalog

| Method | Endpoint | Access Role | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Public | Dynamic readiness check (DB, Storage, AI service) |
| `POST` | `/api/v1/auth/login` | Public | Authenticate and obtain JWT access & refresh tokens |
| `GET` | `/api/v1/auth/me` | Authenticated | Retrieve current user profile and role |
| `POST` | `/api/v1/auth/logout` | Authenticated | Invalidate session and audit event log |
| `GET` | `/api/v1/books` | Public | List books with search, language filter, pagination |
| `POST` | `/api/v1/books` | RESEARCHER | Register historical manuscript book |
| `GET` | `/api/v1/books/:id` | Public | Get book metadata and associated page folios |
| `PATCH` | `/api/v1/books/:id` | RESEARCHER | Update book catalog details |
| `DELETE` | `/api/v1/books/:id` | ADMIN | Delete book and associated pages |
| `GET` | `/api/v1/books/:bookId/pages` | Public | List pages/folios belonging to a book |
| `POST` | `/api/v1/books/:bookId/pages` | RESEARCHER | Upload/register manuscript page |
| `GET` | `/api/v1/pages/:id` | Public | Get single manuscript page metadata |
| `PATCH` | `/api/v1/pages/:id` | RESEARCHER | Update page folio label, language, or lines |
| `DELETE` | `/api/v1/pages/:id` | ADMIN | Delete manuscript page |
| `GET` | `/api/v1/pages/:id/image` | Public | Stream binary folio image (returns 404 if missing) |
| `POST` | `/api/v1/pages/:id/recognition-jobs` | RESEARCHER | Submit asynchronous HTR recognition job |
| `GET` | `/api/v1/recognition-jobs` | Public | List HTR jobs with status |
| `GET` | `/api/v1/recognition-jobs/:id` | Public | Get status and duration of recognition job |
| `POST` | `/api/v1/recognition-jobs/:id/cancel`| RESEARCHER | Cancel queued or running recognition job |
| `GET` | `/api/v1/pages/:id/transcriptions` | Public | Get page transcription and revision history |
| `GET` | `/api/v1/transcriptions/:id` | Public | Get specific transcription |
| `PATCH` | `/api/v1/transcriptions/:id` | RESEARCHER | Update transcription with optimistic concurrency |
| `GET` | `/api/v1/transcriptions/:id/revisions`| Public | List historical revisions for transcription |
| `POST` | `/api/v1/transcriptions/:id/approve` | RESEARCHER | Approve scholarly transcription |
| `GET` | `/api/v1/search` | Public | Full-text search with Persian/Arabic normalization |
| `GET` | `/api/v1/dashboard/stats` | Public | Real-time aggregate platform statistics |
| `GET` | `/api/v1/datasets` | Public | List registered benchmark datasets |
| `POST` | `/api/v1/datasets/validate` | Public | Validate manifest CSV columns and path traversal |
| `GET` | `/api/v1/models` | Public | List available neural HTR models |
| `GET` | `/api/v1/evaluations` | Public | List CER/WER benchmark experiments |
| `POST` | `/api/v1/evaluations` | RESEARCHER | Run evaluation experiment calculating CER & WER |
| `GET` | `/api/v1/training-jobs` | Public | List fine-tuning jobs |
| `POST` | `/api/v1/training-jobs` | ADMIN | Launch model fine-tuning job |
| `GET` | `/api/v1/audit/events` | ADMIN | Retrieve security audit events |

---

## 7. Frontend Integration & TypeScript Type Generation

The separate React frontend can generate typed API definitions directly from this backend:

```bash
# Inside the separate React frontend repository:
npx openapi-typescript http://localhost:3000/api/docs-json -o src/types/api.d.ts
```
