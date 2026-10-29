/**
 * Manuscript AI - Core Backend Application Server
 *
 * Implements a standalone Express REST API with PostgreSQL/Prisma persistence:
 * - Completely decoupled from frontend: zero Vite middleware or React serving
 * - Redirects root (/) directly to Swagger API Documentation (/api/docs)
 * - Exposes OpenAPI 3.0 specification at /api/docs-json
 * - Background queue processor integration for asynchronous HTR recognition jobs
 * - Comprehensive CORS configuration for independent React frontends
 * - Automatic seed initialization if database is unpopulated on startup
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { apiRouter } from './src/api/router.js';
import { openApiSpecification, renderSwaggerHtml } from './src/docs/openapi.js';
import { errorResponse } from './src/common/response.js';
import { prisma } from './src/database/prisma.service.js';
import { jobQueue } from './src/jobs/queue.service.js';
import { aiClient } from './src/recognition/ai-client.service.js';
import { normalizePersianArabicText } from './src/common/normalization.js';
import { runPrismaSeed } from './prisma/seed.js';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Body parsing with 25MB limit for high-resolution historical manuscript uploads
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// CORS configuration supporting independent React frontend
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (origin && (allowedOrigins.includes(origin) || allowedOrigins.includes('*'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control'
  );
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// Request logger
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.path.startsWith('/api/')) {
      const duration = Date.now() - start;
      console.log(`[API] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Redirect root to Swagger API Documentation
app.get('/', (req: Request, res: Response) => {
  res.redirect('/api/docs');
});

// Swagger & OpenAPI endpoints
app.get('/api/docs-json', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(openApiSpecification, null, 2));
});

app.get('/api/docs', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(renderSwaggerHtml());
});

// Mount Core REST API v1
app.use('/api/v1', apiRouter);

// Centralized API Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[SERVER_ERROR]', err);
  const status = err.statusCode || err.status || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'An unexpected error occurred processing your request';
  const details = err.details || [];

  if (res.headersSent) {
    return next(err);
  }

  res.status(status).json(errorResponse(code, message, details));
});

// Register background HTR recognition worker
jobQueue.registerProcessor('RECOGNITION', async (job) => {
  const { pageId, requestedById, modelId, recognitionMode, imagePath } = job.data as {
    pageId: string;
    requestedById: string;
    modelId: string;
    recognitionMode: string;
    imagePath: string;
  };

  const page = await prisma.manuscriptPage.findUnique({ where: { id: pageId } });
  const language = page?.language || 'fa';

  console.log(`[JobQueue] Processing HTR job ${job.id} for page ${pageId} (Mode: ${recognitionMode}, Model: ${modelId})`);

  // Invoke AI service client
  const result = await aiClient.recognizePage(imagePath, language, modelId);

  // Update recognition job in database
  await prisma.recognitionJob.update({
    where: { id: job.id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date().toISOString(),
      processingDurationMs: result.durationMs,
    },
  });

  // Create or update transcription
  let transcription = await prisma.transcription.findFirst({ where: { pageId } });

  if (!transcription) {
    transcription = await prisma.transcription.create({
      data: {
        id: `tr_${pageId.replace('pg_', '')}`,
        pageId,
        recognitionJobId: job.id,
        rawText: result.text,
        correctedText: result.text,
        normalizedSearchText: normalizePersianArabicText(result.text),
        reviewStatus: 'PENDING_REVIEW',
        language,
        modelId: result.modelId,
        modelVersion: result.modelVersion,
        version: 1,
      },
    });
  } else {
    transcription = await prisma.transcription.update({
      where: { id: transcription.id },
      data: {
        rawText: result.text,
        correctedText: result.text,
        normalizedSearchText: normalizePersianArabicText(result.text),
        modelId: result.modelId,
        modelVersion: result.modelVersion,
      },
    });
  }

  // Record initial revision
  const revCount = await prisma.transcriptionRevision.count({ where: { transcriptionId: transcription.id } });
  const nextRevNum = revCount + 1;

  await prisma.transcriptionRevision.create({
    data: {
      id: `rev_${nextRevNum}_${transcription.id}`,
      transcriptionId: transcription.id,
      revisionNumber: nextRevNum,
      text: result.text,
      changedById: requestedById,
      changeSummary: `Automatic HTR recognition (${result.isMock ? 'Mock Provider' : result.modelId})`,
    },
  });

  return result;
});

// Initialize server
async function bootstrap() {
  // Ensure storage directories exist
  const uploadDir = path.resolve(process.env.UPLOAD_DIR || './storage/uploads');
  const modelDir = path.resolve(process.env.MODEL_DIR || './storage/models');
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.mkdirSync(modelDir, { recursive: true });

  // Connect Prisma persistence layer
  await prisma.onModuleInit();

  // If database is completely empty, initialize seed data
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    console.log('[Server] Database is empty. Seeding historical manuscripts and accounts...');
    await runPrismaSeed(prisma);
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('===========================================================');
    console.log(`  Manuscript AI Backend API running at http://0.0.0.0:${PORT}`);
    console.log(`  Swagger UI Documentation: http://0.0.0.0:${PORT}/api/docs`);
    console.log(`  OpenAPI Specification:    http://0.0.0.0:${PORT}/api/docs-json`);
    console.log(`  Health & Readiness Check: http://0.0.0.0:${PORT}/api/v1/health`);
    console.log('===========================================================');
  });

  return { app, server };
}

export { app, bootstrap };

// Direct execution entrypoint
if (process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js')) {
  bootstrap().catch((err) => {
    console.error('[FATAL_STARTUP_ERROR]', err);
    process.exit(1);
  });
}
