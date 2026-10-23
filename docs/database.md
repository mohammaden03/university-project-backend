# Manuscript AI — Database Schema & Architecture

## 1. Relational Entity-Relationship Model

The PostgreSQL schema is managed via Prisma ORM and contains 12 core models:

```text
       ┌──────────┐
       │   User   │
       └───┬───┬──┘
           │   │
           │   └──────────────────────┐
           ▼                          ▼
       ┌──────────┐              ┌─────────┐
       │   Book   │              │ Dataset │
       └───┬──────┘              └───┬─────┘
           │                         │
           ▼                         ▼
  ┌────────────────┐         ┌───────────────┐
  │ ManuscriptPage │         │ DatasetSample │
  └───┬────────┬───┘         └───────────────┘
      │        │
      │        └──────────────────────┐
      ▼                               ▼
┌────────────────┐          ┌───────────────────────┐
│ RecognitionJob │          │     Transcription     │
└────────────────┘          └───┬───────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ TranscriptionRevision │
                    └───────────────────────┘
```

## 2. Table Specifications & Indexes

### `users`
- `id` (UUID, Primary Key)
- `email` (Unique VARCHAR)
- `passwordHash` (Argon2id/PBKDF2 salted hash)
- `displayName` (VARCHAR)
- `role` (ENUM: `ADMIN`, `RESEARCHER`, `VIEWER`)
- `isActive` (BOOLEAN)

### `books`
- `id` (UUID, PK)
- `title` (VARCHAR, Indexed)
- `author` (VARCHAR, Indexed, Nullable)
- `language` (VARCHAR(10), Indexed)
- `description` (TEXT)
- `manuscriptIdentifier` (VARCHAR)
- `estimatedDate` (VARCHAR)
- `collectionName` (VARCHAR)
- `createdById` (FK -> users.id, Restrict on Delete)

### `manuscript_pages`
- `id` (UUID, PK)
- `bookId` (FK -> books.id, Cascade on Delete)
- `pageNumber` (INT)
- `folioLabel` (VARCHAR)
- `imageStorageKey` (VARCHAR)
- `checksum` (VARCHAR(64), SHA-256)
- `imageWidth` / `imageHeight` (INT)
- *Constraint*: `UNIQUE(bookId, pageNumber)`

### `transcriptions`
- `id` (UUID, PK)
- `pageId` (FK -> manuscript_pages.id, Cascade on Delete)
- `rawText` (TEXT, Preserved original HTR output)
- `correctedText` (TEXT, Scholarly edition)
- `normalizedSearchText` (TEXT, Stripped of diacritics & unified Persian/Arabic graphemes)
- `reviewStatus` (ENUM: `PENDING_REVIEW`, `REVIEWED`, `APPROVED`, Indexed)
- `version` (INT, Optimistic Locking counter)

### `transcription_revisions`
- `id` (UUID, PK)
- `transcriptionId` (FK -> transcriptions.id, Cascade on Delete)
- `revisionNumber` (INT)
- `text` (TEXT)
- `changedById` (FK -> users.id, Restrict on Delete)
- `changeSummary` (TEXT)
- *Constraint*: `UNIQUE(transcriptionId, revisionNumber)`

## 3. Persian & Arabic Full-Text Indexing Strategy

In PostgreSQL, Persian and Arabic search is enhanced by:
1. Storing `normalizedSearchText` alongside the original text.
2. Generating a PostgreSQL `tsvector` or trigram `gin_trgm_ops` index on `normalizedSearchText`:
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   CREATE INDEX idx_transcriptions_search_trgm ON transcriptions USING gin (normalizedSearchText gin_trgm_ops);
   ```
3. Queries normalize incoming user terms (e.g. converting Arabic Kaf `ك` to Persian `ک` and removing Tatweel `ـ`) before executing indexed queries, ensuring 100% recall across historical script variations.
