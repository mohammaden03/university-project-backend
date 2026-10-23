# Manuscript AI — Formal REST API Contract (v1)

Base URL: `http://localhost:3000/api/v1`
Interactive Swagger UI: `http://localhost:3000/api/docs`
OpenAPI JSON: `http://localhost:3000/api/docs-json`

---

## 1. Response Envelope Format

### Standard Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": null
}
```

### Paginated Results Response
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

### Standard Error Response
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

## 2. Authentication

### `POST /api/v1/auth/login`
- **Request Body**:
```json
{
  "email": "researcher@manuscript.ai",
  "password": "ResearchPass2026!"
}
```
- **Response** (`200 OK`):
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1Ni...",
    "refreshToken": "rf_a1b2c3d4...",
    "tokenType": "Bearer",
    "expiresIn": 900,
    "user": {
      "id": "usr_researcher_002",
      "email": "researcher@manuscript.ai",
      "displayName": "Prof. Ehsan Yarshater",
      "role": "RESEARCHER"
    }
  },
  "meta": null
}
```

---

## 3. Books Management

### `GET /api/v1/books`
- **Query Params**: `page` (default 1), `limit` (default 20), `language` (`fa`, `ar`, `ota`), `search` (string)
- **Response** (`200 OK`):
```json
{
  "success": true,
  "data": [
    {
      "id": "bk_shahnameh_01",
      "title": "شاهنامه فردوسی (نسخه شاه تهماسبی)",
      "author": "ابوالقاسم فردوسی",
      "language": "fa",
      "description": "شاهنامه شاه تهماسبی از برجسته‌ترین نسخه‌های خطی دوره صفوی.",
      "manuscriptIdentifier": "MS. Houghton / Met 1970.301",
      "estimatedDate": "1522–1540 CE",
      "collectionName": "Metropolitan Museum of Art",
      "license": "Public Domain"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

### `POST /api/v1/books` (Auth: RESEARCHER or ADMIN)
- **Request Body**:
```json
{
  "title": "دیوان شمس تبریزی",
  "author": "مولانا جلال‌الدین محمد بلخی",
  "language": "fa",
  "description": "غزلیات مولانا به خط نسخ و نستعلیق قرن هشتم هجری.",
  "manuscriptIdentifier": "MS. Persian 1084",
  "estimatedDate": "14th Century CE"
}
```
- **Response** (`201 Created`):
```json
{
  "success": true,
  "data": {
    "id": "bk_8f21a4bc",
    "title": "دیوان شمس تبریزی",
    "author": "مولانا جلال‌الدین محمد بلخی",
    "language": "fa",
    "createdAt": "2026-10-23T06:00:00.000Z"
  },
  "meta": null
}
```

---

## 4. Manuscript Pages & Folio Uploads

### `POST /api/v1/books/:bookId/pages` (Auth: RESEARCHER)
- **Request Body**:
```json
{
  "pageNumber": 2,
  "folioLabel": "Folio 1b",
  "originalFilename": "shahnameh_f01b.webp",
  "mimeType": "image/webp",
  "fileSize": 450210,
  "imageWidth": 1600,
  "imageHeight": 2400
}
```
- **Response** (`201 Created`): Returns page object with server-assigned `imageStorageKey` and SHA-256 checksum.

### `GET /api/v1/pages/:id/image`
- **Response** (`200 OK`): Binary stream of the manuscript folio or rendered high-resolution facsimile SVG.

---

## 5. Recognition Jobs (HTR)

### `POST /api/v1/pages/:id/recognition-jobs` (Auth: RESEARCHER)
- **Request Body**:
```json
{
  "modelId": "mdl_trocr_persian_v1",
  "recognitionMode": "FULL_PAGE"
}
```
- **Response** (`202 Accepted`):
```json
{
  "success": true,
  "data": {
    "id": "job_rec_91a0",
    "pageId": "pg_shahnameh_f01",
    "modelId": "mdl_trocr_persian_v1",
    "recognitionMode": "FULL_PAGE",
    "status": "COMPLETED",
    "processingDurationMs": 1800,
    "submittedAt": "2026-10-23T06:01:00.000Z"
  },
  "meta": null
}
```

---

## 6. Transcription Editing & Revision Trees

### `PATCH /api/v1/transcriptions/:id` (Auth: RESEARCHER)
- **Request Body** (with optimistic locking):
```json
{
  "correctedText": "به نام خداوند جان و خرد\nکزین برتر اندیشه برنگذرد",
  "changeSummary": "اصلاح نگارش و تطبیق اعراب با نسخه مصحح خالقی مطلق",
  "expectedVersion": 1
}
```
- **Response** (`200 OK`): Returns updated transcription record with incremented version.
- **Conflict Response** (`409 Conflict`): Returned if another researcher already modified the transcription.

### `POST /api/v1/transcriptions/:id/approve` (Auth: RESEARCHER / ADMIN)
- **Response** (`200 OK`): Updates `reviewStatus` to `APPROVED`.

---

## 7. Advanced Search

### `GET /api/v1/search`
- **Query Params**: `q` (Persian/Arabic query text), `bookId`, `language`, `reviewStatus`, `page`, `limit`
- **Feature**: Automatic Arabic/Persian Unicode normalization (Yeh/Kaf/Alef/diacritics/tatweel).
- **Response** (`200 OK`):
```json
{
  "success": true,
  "data": [
    {
      "transcriptionId": "tr_shahnameh_01",
      "bookTitle": "شاهنامه فردوسی",
      "folioLabel": "Folio 1b",
      "snippet": "...به نام خداوند جان و خرد کزین برتر اندیشه برنگذرد...",
      "matchFound": true,
      "reviewStatus": "APPROVED"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

---

## 8. Datasets & Manifest Validation

### `POST /api/v1/datasets/validate`
- **Request Body**:
```json
{
  "manifestCsv": "sample_id,image_path,transcription,split,language\nsmp_01,images/line_01.jpg,به نام خداوند,TRAIN,fa\nsmp_02,images/line_02.jpg,جان و خرد,VAL,fa"
}
```
- **Response** (`200 OK`):
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "totalRows": 2,
    "splitCounts": { "TRAIN": 1, "VAL": 1, "TEST": 0, "UNKNOWN": 0 },
    "errorCount": 0,
    "errors": []
  },
  "meta": null
}
```

---

## 9. Model Registry & Evaluations

### `POST /api/v1/evaluations` (Auth: RESEARCHER)
- **Request Body**:
```json
{
  "modelId": "mdl_trocr_persian_v1",
  "datasetId": "ds_persian_htr_corpus",
  "sampleCount": 100
}
```
- **Response** (`201 Created`):
```json
{
  "success": true,
  "data": {
    "id": "eval_8c1b4",
    "modelId": "mdl_trocr_persian_v1",
    "datasetId": "ds_persian_htr_corpus",
    "cer": 0.042,
    "wer": 0.089,
    "averageInferenceTimeMs": 135
  },
  "meta": null
}
```

---

## 10. Training Jobs

### `POST /api/v1/training-jobs` (Auth: ADMIN)
- **Request Body**:
```json
{
  "baseModelId": "mdl_trocr_persian_v1",
  "datasetId": "ds_persian_htr_corpus",
  "learningRate": 0.00005,
  "batchSize": 16,
  "epochs": 15
}
```
- **Response** (`201 Created`): Returns dispatched training job with assigned GPU and log path.
