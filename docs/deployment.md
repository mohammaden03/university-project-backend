# Manuscript AI — Production Deployment Guide

## 1. Docker Compose Multi-Container Orchestration

The application is deployed as three decoupled containers:
1. `postgres`: PostgreSQL 16 Alpine with persistent volume `pgdata`.
2. `backend`: NestJS / Express API with persistent volume `uploads_data`.
3. `ai-service`: FastAPI Python inference service with persistent volume `models_data`.

### Starting All Services
```bash
docker-compose up -d --build
```

### Checking Container Health
```bash
docker-compose ps
```

---

## 2. Environment Variables for Docker

| Variable | Host Value | Docker Compose Value |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://app_user:pass@localhost:5432/manuscript_ai` | `postgresql://app_user:pass@postgres:5432/manuscript_ai` |
| `AI_SERVICE_URL` | `http://localhost:8000` | `http://ai-service:8000` |
| `UPLOAD_DIR` | `./storage/uploads` | `/app/storage/uploads` |
| `MODEL_DIR` | `./storage/models` | `/app/storage/models` |

*Note*: Inside a Docker container, `localhost` refers to that container's loopback interface, not other services. Use service hostnames (`postgres`, `ai-service`) for inter-container networking.
