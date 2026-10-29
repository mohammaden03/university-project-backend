/**
 * Manuscript AI - Core Backend Application Server
 *
 * Standalone Express REST API with PostgreSQL/Prisma persistence:
 * - Completely decoupled from frontend: zero Vite middleware or React serving
 * - Redirects root (/) directly to Swagger API Documentation (/api/docs)
 * - Exposes OpenAPI 3.0 specification at /api/docs-json
 * - Background queue processor integration for asynchronous HTR recognition jobs
 * - Strict W3C compliant CORS origin allowlist with Vary: Origin header
 * - Controlled database seeding with explicit environment flag or command
 * - Dynamic health checks, payload limits, and graceful shutdown lifecycle
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
import { createCorsMiddleware, parseAllowedOrigins } from './src/common/cors.js';
import { runPrismaSeed } from './prisma/seed.js';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Validate essential environment configuration
function validateEnvironment(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    if (!process.env.JWT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET.includes('replace_with')) {
      console.warn('[SECURITY_WARNING] Production mode is running with an insecure or default JWT_ACCESS_SECRET.');
    }
    if (!process.env.DATABASE_URL) {
      console.warn('[DATABASE_WARNING] No DATABASE_URL specified in production mode; using disk persistence engine.');
    }
  }
}

// Body parsing with 25MB limit for high-resolution historical manuscript uploads
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Strict configurable CORS Origin Allowlists
const allowedOrigins = parseAllowedOrigins(process.env.CORS_ORIGINS);
app.use(createCorsMiddleware(allowedOrigins));

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

// Register background HTR recognition worker with transactional safety and resilient failure recording
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

  // 1. Update database job state to PROCESSING immediately
  await prisma.recognitionJob.update({
    where: { id: job.id },
    data: {
      status: 'PROCESSING',
      startedAt: new Date().toISOString(),
    },
  });

  try {
    // 2. Invoke AI service client
    const result = await aiClient.recognizePage(imagePath, language, modelId);

    // 3. Atomically commit job completion, transcription creation/update, and revision log
    await prisma.$transaction(async (tx) => {
      // Mark job completed with real duration
      await tx.recognitionJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date().toISOString(),
          processingDurationMs: result.durationMs,
        },
      });

      // Find or create transcription
      let transcription = await tx.transcription.findFirst({ where: { pageId } });
      const now = new Date().toISOString();

      if (!transcription) {
        transcription = await tx.transcription.create({
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
        transcription = await tx.transcription.update({
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

      // Record revision
      const revCount = await tx.transcriptionRevision.count({ where: { transcriptionId: transcription.id } });
      const nextRevNum = revCount + 1;

      await tx.transcriptionRevision.create({
        data: {
          id: `rev_${nextRevNum}_${transcription.id}`,
          transcriptionId: transcription.id,
          revisionNumber: nextRevNum,
          text: result.text,
          changedById: requestedById,
          changeSummary: `Automatic HTR recognition (${result.isMock ? 'Mock Academic Provider' : result.modelId})`,
        },
      });
    });

    return result;
  } catch (err: any) {
    // 4. Safely record failure status and sanitized error in database
    console.error(`[JobQueue] HTR Job ${job.id} failed:`, err.message || err);
    try {
      await prisma.recognitionJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          errorCode: err.code || 'RECOGNITION_ERROR',
          errorMessage: err.message || 'Recognition execution failed unexpectedly',
          completedAt: new Date().toISOString(),
        },
      });
    } catch (dbErr: any) {
      console.error(`[JobQueue] Failed to record FAILED status for job ${job.id}:`, dbErr.message);
    }
    throw err;
  }
});

// Initialize server
async function bootstrap() {
  validateEnvironment();

  // Ensure storage directories exist
  const uploadDir = path.resolve(process.env.UPLOAD_DIR || './storage/uploads');
  const modelDir = path.resolve(process.env.MODEL_DIR || './storage/models');
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.mkdirSync(path.join(uploadDir, 'folios'), { recursive: true });
  fs.mkdirSync(modelDir, { recursive: true });

  // Connect Prisma persistence layer
  await prisma.onModuleInit();

  // Explicit seeding control: only auto-seed if AUTO_SEED=true or non-production with empty DB
  const isProduction = process.env.NODE_ENV === 'production';
  const shouldAutoSeed = process.env.AUTO_SEED === 'true' || (!isProduction);

  if (shouldAutoSeed) {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      console.log('[Server] Initializing development seed dataset...');
      await runPrismaSeed(prisma);
    }
  } else {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      console.log('[Server] Database has 0 users. Run `npm run seed` or set AUTO_SEED=true to seed initial accounts.');
    }
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('===========================================================');
    console.log(`  Manuscript AI Backend API running at http://0.0.0.0:${PORT}`);
    console.log(`  Swagger UI Documentation: http://0.0.0.0:${PORT}/api/docs`);
    console.log(`  OpenAPI Specification:    http://0.0.0.0:${PORT}/api/docs-json`);
    console.log(`  Health & Readiness Check: http://0.0.0.0:${PORT}/api/v1/health`);
    console.log('===========================================================');
  });

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    console.log(`[Server] Received ${signal}. Initiating graceful shutdown...`);
    server.close(async () => {
      console.log('[Server] Closed HTTP listener.');
      await prisma.onModuleDestroy();
      console.log('[Server] Disconnected database connections.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

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
