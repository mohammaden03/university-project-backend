# Manuscript AI — Troubleshooting & Incident Response

## 1. Common Issues & Solutions

### A. CORS Rejection from Independent React Frontend
- **Symptom**: Browser reports `Cross-Origin Request Blocked: The Same Origin Policy disallows reading the remote resource`.
- **Cause**: The frontend origin (e.g. `http://localhost:5173`) is not listed in `CORS_ORIGINS`.
- **Fix**: In `.env`, update:
  ```dotenv
  FRONTEND_ORIGIN=http://localhost:5173
  CORS_ORIGINS=http://localhost:5173,http://localhost:3000
  ```
  Restart the backend server.

### B. Python AI Microservice Unavailable
- **Symptom**: `POST /api/v1/pages/:id/recognition-jobs` returns `503 Service Unavailable`.
- **Cause**: The Python FastAPI service is not running on port 8000, or `AI_PROVIDER` is set to `pretrained` without PyTorch model weights.
- **Fix**: Set `AI_PROVIDER=mock` in `.env` for local testing, or start the Python service via `cd ai-service && uvicorn app.main:app --port 8000`.

### C. Transcription Concurrency Conflict (HTTP 409)
- **Symptom**: `PATCH /api/v1/transcriptions/:id` fails with `409 Conflict: Conflict detected`.
- **Cause**: Another researcher submitted an edit before your request completed.
- **Fix**: Fetch the latest transcription revision via `GET /api/v1/transcriptions/:id`, merge your changes with the updated `version`, and resubmit.
