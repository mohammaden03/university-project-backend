# Manuscript AI — Installation & Setup Guide

## 1. Prerequisites

- **Node.js**: v20.x or v22.x LTS
- **Package Manager**: `npm` or `bun`
- **PostgreSQL**: 15+ (optional for in-memory dev mode, required for production)
- **Python**: 3.10+ (for Python AI microservice)
- **Docker & Docker Compose**: (optional for containerized deployment)

---

## 2. Quickstart (Local Development)

### Step 1: Install Backend Dependencies
```bash
npm install
```

### Step 2: Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure required variables are populated:
```dotenv
PORT=3000
FRONTEND_ORIGIN=http://localhost:5173
JWT_ACCESS_SECRET=your_secure_random_key_here
```

### Step 3: Run Database Migrations & Seeds (Prisma)
```bash
npx prisma db push
npx tsx prisma/seed.ts
```

### Step 4: Start the Server
```bash
npm run dev
```
The server will boot on `http://localhost:3000`:
- REST API Base: `http://localhost:3000/api/v1`
- Swagger Documentation: `http://localhost:3000/api/docs`
- OpenAPI JSON: `http://localhost:3000/api/docs-json`
- Academic Workbench UI: `http://localhost:3000`

---

## 3. Starting the Python AI Microservice (Optional)

```bash
cd ai-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

When running in mock mode (`AI_PROVIDER=mock`), the backend does not require the Python service to be running.
