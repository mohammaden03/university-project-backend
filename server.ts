/**
 * Manuscript AI - Core Full-Stack Application Server
 *
 * Implements:
 * - Express REST API under /api/v1/*
 * - OpenAPI 3.0 JSON specification at /api/docs-json
 * - Interactive Swagger UI documentation at /api/docs
 * - Strict CORS policy for independent React frontend consumption
 * - Vite middleware integration for live browser preview
 * - Structured request logging & error handling
 */

import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
import { apiRouter } from './src/api/router.js';
import { openApiSpecification, renderSwaggerHtml } from './src/docs/openapi.js';
import { errorResponse } from './src/common/response.js';

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

// Request logger for development & debugging
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

// Initialize server with Vite middleware in development
async function bootstrap() {
  // Ensure storage directories exist
  const uploadDir = process.env.UPLOAD_DIR || './storage/uploads';
  const modelDir = process.env.MODEL_DIR || './storage/models';
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.mkdirSync(modelDir, { recursive: true });

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(` Manuscript AI Backend is running on port ${PORT}`);
    console.log(` REST API Base: http://localhost:${PORT}/api/v1`);
    console.log(` Swagger Docs:  http://localhost:${PORT}/api/docs`);
    console.log(` OpenAPI Spec:  http://localhost:${PORT}/api/docs-json`);
    console.log(` Health Check:  http://localhost:${PORT}/api/v1/health`);
    console.log(` Allowed CORS:  ${allowedOrigins.join(', ')}`);
    console.log(`====================================================`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start Manuscript AI server:', err);
  process.exit(1);
});
