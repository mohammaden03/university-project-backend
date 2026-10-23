# Manuscript AI — Security & Threat Modeling

## 1. Authentication & Session Security

- **Password Storage**: Passwords are hashed using salted cryptographic PBKDF2/Argon2id implementations (10,000+ iterations with unique 16-byte random salts). Plaintext passwords and hashes are never returned in API payloads.
- **JWT Protection**: Short-lived access tokens (15-minute TTL) with cryptographic HMAC-SHA256 signatures.
- **Timing-Safe Equality**: Password verification uses `crypto.timingSafeEqual` to eliminate timing side-channel attacks.

## 2. Role-Based Access Control (RBAC)

Three discrete roles are enforced on API routes:
- **`ADMIN`**: User management, system configuration, model registration, training jobs, audit event logs.
- **`RESEARCHER`**: Manuscript book creation, folio uploads, OCR recognition requests, transcription edits, revision creation, approval, and evaluation benchmark runs.
- **`VIEWER`**: Read-only access to published books, page folios, approved transcriptions, and normalized search.

## 3. Storage & Upload Defenses

- **MIME & Magic Bytes**: File uploads require valid image MIME types (`image/jpeg`, `image/png`, `image/webp`) and reject unverified executable binary payloads.
- **Path Traversal Prevention**: Filenames are discarded in favor of server-generated UUID/timestamp keys. Manifest imports explicitly reject `../` and root paths.
- **Upload Size Limit**: Hard ceiling of 20MB per folio image; maximum 40,000,000 pixels.
