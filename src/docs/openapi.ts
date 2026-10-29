/**
 * Manuscript AI - OpenAPI 3.0 Specification Generator
 *
 * Full API specification generator exposing:
 * - /api/docs (Interactive Swagger UI via Swagger CDN)
 * - /api/docs-json (Machine-readable OpenAPI 3.0 specification)
 */

export const openApiSpecification = {
  openapi: '3.0.3',
  info: {
    title: 'Manuscript AI — Academic HTR & OCR REST API',
    version: '1.0.0',
    description: `Complete production API specification for Manuscript AI, an academic platform for historical handwritten text recognition (HTR), optical character recognition (OCR), Persian and Arabic manuscript cataloging, transcription correction with revision history, and CER/WER evaluation.

### Authentication
Protected endpoints require a Bearer JWT token in the \`Authorization\` header:
\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`
Default demo credentials:
- **Admin**: \`admin@manuscript.ai\` / \`AdminPass2026!\`
- **Researcher**: \`researcher@manuscript.ai\` / \`ResearchPass2026!\`
- **Viewer**: \`viewer@manuscript.ai\` / \`ViewerPass2026!\`
`,
    contact: {
      name: 'Manuscript AI Research Engineering',
      email: 'mohammad.entezari03@gmail.com',
    },
    license: {
      name: 'Apache 2.0',
      url: 'https://www.apache.org/licenses/LICENSE-2.0.html',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local Development Server',
    },
  ],
  tags: [
    { name: 'Authentication', description: 'User login, session management, and profile inspection' },
    { name: 'Books', description: 'Cataloging of historical Persian and Arabic manuscript books' },
    { name: 'Manuscript Pages', description: 'Folios, image storage, dimensions, and line segmentations' },
    { name: 'Recognition & HTR', description: 'OCR/HTR jobs, queues, TrOCR / Mock inference' },
    { name: 'Transcriptions', description: 'Transcription correction, revision tracking, conflict handling, and approval' },
    { name: 'Search', description: 'Normalized Persian/Arabic full-text and metadata search' },
    { name: 'Dashboard', description: 'Real database-calculated metrics and statistics' },
    { name: 'Datasets', description: 'Corpus management, CSV manifest validation, and samples' },
    { name: 'Model Registry', description: 'HTR model metadata, licenses, and availability checks' },
    { name: 'Evaluations', description: 'Benchmarking CER (Character Error Rate) & WER (Word Error Rate)' },
    { name: 'Training Jobs', description: 'Model fine-tuning job dispatch and tracking' },
    { name: 'Audit & Health', description: 'System health, readiness probes, and audit logs' },
  ],
  paths: {
    '/api/v1/health': {
      get: {
        tags: ['Audit & Health'],
        summary: 'System health and readiness probe',
        responses: {
          200: { description: 'System is healthy and operational' },
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Authenticate user and obtain JWT tokens',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'researcher@manuscript.ai' },
                  password: { type: 'string', example: 'ResearchPass2026!' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Authenticated successfully' },
          401: { description: 'Invalid credentials' },
          429: { description: 'Too many failed login attempts' },
        },
      },
    },
    '/api/v1/auth/refresh': {
      post: {
        tags: ['Authentication'],
        summary: 'Rotate and exchange a valid refresh token for a new access token and rotated refresh token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: {
                  refreshToken: { type: 'string', example: 'rf_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d.secret' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Token refreshed successfully with rotated refresh token' },
          401: { description: 'Invalid, expired, or reused refresh token' },
          403: { description: 'Account disabled' },
        },
      },
    },
    '/api/v1/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Get current authenticated user profile',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'User profile retrieved' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/api/v1/books': {
      get: {
        tags: ['Books'],
        summary: 'List books with pagination, language filtering, and search',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'language', in: 'query', schema: { type: 'string', enum: ['all', 'fa', 'ar', 'ota'] } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Paginated list of books' },
        },
      },
      post: {
        tags: ['Books'],
        summary: 'Create a new historical manuscript book record',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'language'],
                properties: {
                  title: { type: 'string', example: 'گلستان سعدی' },
                  author: { type: 'string', example: 'سعدی شیرازی' },
                  language: { type: 'string', example: 'fa' },
                  description: { type: 'string' },
                  manuscriptIdentifier: { type: 'string', example: 'MS. Or. 5319' },
                  estimatedDate: { type: 'string', example: '1568 CE' },
                  collectionName: { type: 'string', example: 'British Library' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Book created successfully' },
          403: { description: 'Forbidden (Requires RESEARCHER or ADMIN role)' },
        },
      },
    },
    '/api/v1/books/{id}': {
      get: {
        tags: ['Books'],
        summary: 'Get book details by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Book details' },
          404: { description: 'Book not found' },
        },
      },
      patch: {
        tags: ['Books'],
        summary: 'Update book details',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Book updated' },
        },
      },
      delete: {
        tags: ['Books'],
        summary: 'Delete book',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Book deleted' },
          403: { description: 'Only ADMIN can delete books' },
        },
      },
    },
    '/api/v1/books/{bookId}/pages': {
      get: {
        tags: ['Manuscript Pages'],
        summary: 'List pages/folios for a specific book',
        parameters: [{ name: 'bookId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'List of pages with folio labels and dimensions' },
        },
      },
      post: {
        tags: ['Manuscript Pages'],
        summary: 'Upload or register a manuscript page image',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'bookId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          201: { description: 'Page created and stored' },
        },
      },
    },
    '/api/v1/pages/{id}': {
      get: {
        tags: ['Manuscript Pages'],
        summary: 'Get page metadata and line segmentations',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Page details with bounding boxes' },
        },
      },
    },
    '/api/v1/pages/{id}/image': {
      get: {
        tags: ['Manuscript Pages'],
        summary: 'Retrieve manuscript page image binary or SVG visualization',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Image content stream' },
        },
      },
    },
    '/api/v1/pages/{id}/recognition-jobs': {
      post: {
        tags: ['Recognition & HTR'],
        summary: 'Submit a manuscript page for HTR/OCR recognition',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  modelId: { type: 'string', example: 'mdl_trocr_persian_v1' },
                  recognitionMode: { type: 'string', enum: ['LINE', 'FULL_PAGE'], default: 'FULL_PAGE' },
                },
              },
            },
          },
        },
        responses: {
          202: { description: 'Recognition job queued' },
        },
      },
    },
    '/api/v1/recognition-jobs': {
      get: {
        tags: ['Recognition & HTR'],
        summary: 'List recent recognition jobs',
        responses: {
          200: { description: 'Jobs list with progress and durations' },
        },
      },
    },
    '/api/v1/recognition-jobs/{id}': {
      get: {
        tags: ['Recognition & HTR'],
        summary: 'Get status and details of a recognition job',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Job status' },
        },
      },
    },
    '/api/v1/recognition-jobs/{id}/cancel': {
      post: {
        tags: ['Recognition & HTR'],
        summary: 'Cancel a pending or queued recognition job',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Job cancelled' },
        },
      },
    },
    '/api/v1/pages/{id}/transcriptions': {
      get: {
        tags: ['Transcriptions'],
        summary: 'Get transcriptions and revisions for a page',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Transcription object with raw text, corrected text, and reviewStatus' },
        },
      },
    },
    '/api/v1/transcriptions/{id}': {
      get: {
        tags: ['Transcriptions'],
        summary: 'Get transcription by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Transcription record' },
        },
      },
      patch: {
        tags: ['Transcriptions'],
        summary: 'Update transcription text with optimistic concurrency and revision creation',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['correctedText'],
                properties: {
                  correctedText: { type: 'string' },
                  changeSummary: { type: 'string', example: 'Corrected 2 words in line 3' },
                  expectedVersion: { type: 'integer', description: 'Optimistic locking version' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Transcription updated with new revision' },
          409: { description: 'Conflict: transcription modified by another user' },
        },
      },
    },
    '/api/v1/transcriptions/{id}/revisions': {
      get: {
        tags: ['Transcriptions'],
        summary: 'Get revision history of a transcription',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'List of historical revisions with diff timestamps and editor IDs' },
        },
      },
    },
    '/api/v1/transcriptions/{id}/approve': {
      post: {
        tags: ['Transcriptions'],
        summary: 'Approve transcription (RESEARCHER / ADMIN only)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Transcription marked as APPROVED' },
        },
      },
    },
    '/api/v1/search': {
      get: {
        tags: ['Search'],
        summary: 'Advanced manuscript full-text and metadata search with Persian/Arabic normalization',
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Query text with automatic Yeh/Kaf/Alef/diacritic normalization' },
          { name: 'bookId', in: 'query', schema: { type: 'string' } },
          { name: 'author', in: 'query', schema: { type: 'string' } },
          { name: 'language', in: 'query', schema: { type: 'string', enum: ['fa', 'ar', 'ota'] } },
          { name: 'reviewStatus', in: 'query', schema: { type: 'string', enum: ['PENDING_REVIEW', 'REVIEWED', 'APPROVED'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          200: { description: 'Search results with highlights and folio metadata' },
        },
      },
    },
    '/api/v1/dashboard/stats': {
      get: {
        tags: ['Dashboard'],
        summary: 'Retrieve real aggregated statistics and activity metrics',
        responses: {
          200: { description: 'Real database-calculated metrics' },
        },
      },
    },
    '/api/v1/datasets': {
      get: {
        tags: ['Datasets'],
        summary: 'List available manuscript datasets',
        responses: {
          200: { description: 'Dataset corpus list' },
        },
      },
      post: {
        tags: ['Datasets'],
        summary: 'Register a new dataset corpus',
        security: [{ BearerAuth: [] }],
        responses: {
          201: { description: 'Dataset created' },
        },
      },
    },
    '/api/v1/datasets/validate': {
      post: {
        tags: ['Datasets'],
        summary: 'Validate CSV manifest columns, split hygiene, and UTF-8 encoding',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['manifestCsv'],
                properties: {
                  manifestCsv: { type: 'string', description: 'Raw CSV text with sample_id, image_path, transcription, split, language' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Validation report with row count, split distributions, and errors' },
        },
      },
    },
    '/api/v1/models': {
      get: {
        tags: ['Model Registry'],
        summary: 'List registered HTR/OCR models and availability status',
        responses: {
          200: { description: 'Model registry list' },
        },
      },
    },
    '/api/v1/evaluations': {
      get: {
        tags: ['Evaluations'],
        summary: 'List previous CER/WER benchmark evaluations',
        responses: {
          200: { description: 'Evaluation experiments list' },
        },
      },
      post: {
        tags: ['Evaluations'],
        summary: 'Execute CER/WER evaluation experiment on ground-truth samples',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['modelId', 'datasetId'],
                properties: {
                  modelId: { type: 'string' },
                  datasetId: { type: 'string' },
                  sampleCount: { type: 'integer', default: 50 },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Evaluation experiment completed with exact CER & WER numbers' },
        },
      },
    },
    '/api/v1/training-jobs': {
      get: {
        tags: ['Training Jobs'],
        summary: 'List model fine-tuning jobs',
        responses: {
          200: { description: 'Training jobs list' },
        },
      },
      post: {
        tags: ['Training Jobs'],
        summary: 'Dispatch a fine-tuning training job (ADMIN only)',
        security: [{ BearerAuth: [] }],
        responses: {
          201: { description: 'Training job scheduled' },
        },
      },
    },
    '/api/v1/audit/events': {
      get: {
        tags: ['Audit & Health'],
        summary: 'Retrieve security audit events log (ADMIN only)',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Audit log' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
};

export function renderSwaggerHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Manuscript AI — REST API Documentation (Swagger UI)</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
  <link rel="icon" type="image/png" href="https://unpkg.com/swagger-ui-dist@5.11.0/favicon-32x32.png" />
  <style>
    body { margin: 0; background: #0c0a09; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .top-header { background: #1c1917; border-bottom: 1px solid #292524; padding: 14px 24px; display: flex; align-items: center; justify-content: space-between; }
    .top-header h1 { color: #f5f5f4; margin: 0; font-size: 17px; font-weight: 600; }
    .top-header a { color: #f59e0b; text-decoration: none; font-size: 13px; font-weight: 500; }
    .top-header a:hover { text-decoration: underline; }
    .swagger-ui { filter: invert(88%) hue-rotate(180deg); }
    .swagger-ui .topbar { display: none; }
  </style>
</head>
<body>
  <div class="top-header">
    <h1>Manuscript AI — API Contract &amp; OpenAPI Explorer</h1>
    <div>
      <a href="/api/docs-json" target="_blank" style="margin-right: 16px;">Download openapi.json</a>
      <a href="/">Back to Academic Workbench &rarr;</a>
    </div>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: "/api/docs-json",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>`;
}
