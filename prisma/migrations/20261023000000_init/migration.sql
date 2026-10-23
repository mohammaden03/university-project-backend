-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'RESEARCHER', 'VIEWER');

-- CreateEnum
CREATE TYPE "RecognitionMode" AS ENUM ('LINE', 'FULL_PAGE');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING_REVIEW', 'REVIEWED', 'APPROVED');

-- CreateEnum
CREATE TYPE "DatasetStatus" AS ENUM ('DRAFT', 'VALIDATED', 'READY', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SplitType" AS ENUM ('TRAIN', 'VAL', 'TEST');

-- CreateEnum
CREATE TYPE "ModelStatus" AS ENUM ('ACTIVE', 'EXPERIMENTAL', 'DEPRECATED', 'OFFLINE');

-- CreateEnum
CREATE TYPE "TrainingStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'RESEARCHER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "books" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "language" TEXT NOT NULL DEFAULT 'fa',
    "description" TEXT,
    "manuscriptIdentifier" TEXT,
    "estimatedDate" TEXT,
    "collectionName" TEXT,
    "sourceUrl" TEXT,
    "license" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manuscript_pages" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "folioLabel" TEXT,
    "imageStorageKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "imageWidth" INTEGER NOT NULL,
    "imageHeight" INTEGER NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'fa',
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manuscript_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recognition_jobs" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "recognitionMode" "RecognitionMode" NOT NULL DEFAULT 'FULL_PAGE',
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "processingDurationMs" INTEGER,

    CONSTRAINT "recognition_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcriptions" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "recognitionJobId" TEXT,
    "rawText" TEXT NOT NULL,
    "correctedText" TEXT NOT NULL,
    "normalizedSearchText" TEXT NOT NULL,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "language" TEXT NOT NULL DEFAULT 'fa',
    "modelId" TEXT,
    "modelVersion" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transcriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcription_revisions" (
    "id" TEXT NOT NULL,
    "transcriptionId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "changeSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transcription_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "datasets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "language" TEXT NOT NULL DEFAULT 'fa',
    "source" TEXT,
    "license" TEXT,
    "manifestLocation" TEXT NOT NULL,
    "manifestChecksum" TEXT NOT NULL,
    "status" "DatasetStatus" NOT NULL DEFAULT 'READY',
    "sampleCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "datasets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dataset_samples" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "imageStorageKey" TEXT NOT NULL,
    "transcription" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'fa',
    "bookId" TEXT,
    "manuscriptIdentifier" TEXT,
    "pageNumber" INTEGER,
    "lineIdentifier" TEXT,
    "split" "SplitType" NOT NULL DEFAULT 'TRAIN',
    "source" TEXT,
    "license" TEXT,
    "annotationStatus" TEXT NOT NULL DEFAULT 'VERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dataset_samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_registries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "baseModelId" TEXT,
    "providerType" TEXT NOT NULL,
    "supportedLanguages" TEXT[] DEFAULT ARRAY['fa']::TEXT[],
    "supportedModes" "RecognitionMode"[],
    "artifactLocation" TEXT,
    "license" TEXT NOT NULL DEFAULT 'Apache-2.0',
    "status" "ModelStatus" NOT NULL DEFAULT 'ACTIVE',
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_registries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_experiments" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'fa',
    "sampleCount" INTEGER NOT NULL,
    "cer" DOUBLE PRECISION NOT NULL,
    "wer" DOUBLE PRECISION NOT NULL,
    "averageInferenceTimeMs" INTEGER NOT NULL,
    "configuration" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_experiments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_jobs" (
    "id" TEXT NOT NULL,
    "baseModelId" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "status" "TrainingStatus" NOT NULL DEFAULT 'QUEUED',
    "configuration" JSONB NOT NULL DEFAULT '{}',
    "logLocation" TEXT,
    "outputArtifactLocation" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "books_language_idx" ON "books"("language");
CREATE INDEX "books_author_idx" ON "books"("author");
CREATE INDEX "books_title_idx" ON "books"("title");

-- CreateIndex
CREATE INDEX "manuscript_pages_bookId_idx" ON "manuscript_pages"("bookId");
CREATE INDEX "manuscript_pages_language_idx" ON "manuscript_pages"("language");
CREATE UNIQUE INDEX "manuscript_pages_bookId_pageNumber_key" ON "manuscript_pages"("bookId", "pageNumber");

-- CreateIndex
CREATE INDEX "recognition_jobs_pageId_idx" ON "recognition_jobs"("pageId");
CREATE INDEX "recognition_jobs_status_idx" ON "recognition_jobs"("status");
CREATE INDEX "recognition_jobs_modelId_idx" ON "recognition_jobs"("modelId");

-- CreateIndex
CREATE INDEX "transcriptions_pageId_idx" ON "transcriptions"("pageId");
CREATE INDEX "transcriptions_reviewStatus_idx" ON "transcriptions"("reviewStatus");
CREATE INDEX "transcriptions_language_idx" ON "transcriptions"("language");

-- CreateIndex
CREATE INDEX "transcription_revisions_transcriptionId_idx" ON "transcription_revisions"("transcriptionId");
CREATE UNIQUE INDEX "transcription_revisions_transcriptionId_revisionNumber_key" ON "transcription_revisions"("transcriptionId", "revisionNumber");

-- CreateIndex
CREATE INDEX "datasets_language_idx" ON "datasets"("language");
CREATE INDEX "datasets_status_idx" ON "datasets"("status");

-- CreateIndex
CREATE INDEX "dataset_samples_datasetId_idx" ON "dataset_samples"("datasetId");
CREATE INDEX "dataset_samples_split_idx" ON "dataset_samples"("split");
CREATE INDEX "dataset_samples_language_idx" ON "dataset_samples"("language");

-- CreateIndex
CREATE INDEX "model_registries_status_idx" ON "model_registries"("status");
CREATE UNIQUE INDEX "model_registries_name_version_key" ON "model_registries"("name", "version");

-- CreateIndex
CREATE INDEX "evaluation_experiments_modelId_idx" ON "evaluation_experiments"("modelId");
CREATE INDEX "evaluation_experiments_datasetId_idx" ON "evaluation_experiments"("datasetId");

-- CreateIndex
CREATE INDEX "training_jobs_status_idx" ON "training_jobs"("status");
CREATE INDEX "training_jobs_baseModelId_idx" ON "training_jobs"("baseModelId");

-- CreateIndex
CREATE INDEX "audit_events_userId_idx" ON "audit_events"("userId");
CREATE INDEX "audit_events_action_idx" ON "audit_events"("action");
CREATE INDEX "audit_events_createdAt_idx" ON "audit_events"("createdAt");

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manuscript_pages" ADD CONSTRAINT "manuscript_pages_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "manuscript_pages" ADD CONSTRAINT "manuscript_pages_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recognition_jobs" ADD CONSTRAINT "recognition_jobs_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "manuscript_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recognition_jobs" ADD CONSTRAINT "recognition_jobs_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcriptions" ADD CONSTRAINT "transcriptions_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "manuscript_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transcriptions" ADD CONSTRAINT "transcriptions_recognitionJobId_fkey" FOREIGN KEY ("recognitionJobId") REFERENCES "recognition_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcription_revisions" ADD CONSTRAINT "transcription_revisions_transcriptionId_fkey" FOREIGN KEY ("transcriptionId") REFERENCES "transcriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transcription_revisions" ADD CONSTRAINT "transcription_revisions_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dataset_samples" ADD CONSTRAINT "dataset_samples_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dataset_samples" ADD CONSTRAINT "dataset_samples_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_experiments" ADD CONSTRAINT "evaluation_experiments_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "model_registries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evaluation_experiments" ADD CONSTRAINT "evaluation_experiments_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_jobs" ADD CONSTRAINT "training_jobs_baseModelId_fkey" FOREIGN KEY ("baseModelId") REFERENCES "model_registries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "training_jobs" ADD CONSTRAINT "training_jobs_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "datasets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
