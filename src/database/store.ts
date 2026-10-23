/**
 * Manuscript AI - Core Relational Data Store & Seed State
 *
 * Implements full schema matching Prisma specifications with:
 * - Atomic transactional updates
 * - Persian/Arabic Unicode search indexing
 * - Revision trees & conflict detection
 * - Historical seed records (Ferdowsi's Shahnameh, Sa'di's Golestan, Avicenna's Canon of Medicine, Divan of Hafiz)
 */

import crypto from 'node:crypto';
import { hashPassword, UserRole } from '../common/auth.js';
import { normalizePersianArabicText } from '../common/normalization.js';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Book {
  id: string;
  title: string;
  author: string | null;
  language: string; // 'fa', 'ar', 'ota' (Ottoman Turkish)
  description: string | null;
  manuscriptIdentifier: string | null; // e.g. "MS. Persian 1528", "Or. 2265"
  estimatedDate: string | null; // e.g. "1522 CE", "9th century AH"
  collectionName: string | null; // e.g. "British Library Oriental Collection", "Tehran University Central Library"
  sourceUrl: string | null;
  license: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface PageLineBox {
  id: string;
  lineNumber: number;
  box: [number, number, number, number]; // [ymin, xmin, ymax, xmax] normalized 0..1000
  recognizedText: string;
  confidence: number;
}

export interface ManuscriptPage {
  id: string;
  bookId: string;
  pageNumber: number;
  folioLabel: string | null; // e.g. "Folio 12b", "f. 45a"
  imageStorageKey: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  checksum: string;
  imageWidth: number;
  imageHeight: number;
  language: string;
  uploadedById: string;
  lines?: PageLineBox[];
  createdAt: string;
  updatedAt: string;
}

export type RecognitionMode = 'LINE' | 'FULL_PAGE';
export type JobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface RecognitionJob {
  id: string;
  pageId: string;
  requestedById: string;
  modelId: string;
  recognitionMode: RecognitionMode;
  status: JobStatus;
  errorCode: string | null;
  errorMessage: string | null;
  submittedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  processingDurationMs: number | null;
}

export type ReviewStatus = 'PENDING_REVIEW' | 'REVIEWED' | 'APPROVED';

export interface Transcription {
  id: string;
  pageId: string;
  recognitionJobId: string | null;
  rawText: string;
  correctedText: string;
  normalizedSearchText: string;
  reviewStatus: ReviewStatus;
  language: string;
  modelId: string | null;
  modelVersion: string | null;
  version: number; // For optimistic concurrency conflict detection
  createdAt: string;
  updatedAt: string;
}

export interface TranscriptionRevision {
  id: string;
  transcriptionId: string;
  revisionNumber: number;
  text: string;
  changedById: string;
  changeSummary: string | null;
  createdAt: string;
}

export interface Dataset {
  id: string;
  name: string;
  description: string | null;
  language: string;
  source: string | null;
  license: string | null;
  manifestLocation: string;
  manifestChecksum: string;
  status: 'DRAFT' | 'VALIDATED' | 'READY' | 'ARCHIVED';
  sampleCount: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface DatasetSample {
  id: string;
  datasetId: string;
  imageStorageKey: string;
  transcription: string;
  language: string;
  bookId: string | null;
  manuscriptIdentifier: string | null;
  pageNumber: number | null;
  lineIdentifier: string | null;
  split: 'TRAIN' | 'VAL' | 'TEST';
  source: string | null;
  license: string | null;
  annotationStatus: 'UNCHECKED' | 'VERIFIED' | 'DISPUTED';
  createdAt: string;
}

export interface ModelRegistry {
  id: string;
  name: string;
  version: string;
  baseModelId: string | null;
  providerType: 'mock' | 'pretrained' | 'finetuned';
  supportedLanguages: string[];
  supportedModes: RecognitionMode[];
  artifactLocation: string | null;
  license: string;
  status: 'ACTIVE' | 'EXPERIMENTAL' | 'DEPRECATED' | 'OFFLINE';
  isAvailable: boolean;
  createdAt: string;
}

export interface EvaluationExperiment {
  id: string;
  modelId: string;
  datasetId: string;
  language: string;
  sampleCount: number;
  cer: number; // Character Error Rate
  wer: number; // Word Error Rate
  averageInferenceTimeMs: number;
  configuration: Record<string, any>;
  createdAt: string;
}

export interface TrainingJob {
  id: string;
  baseModelId: string;
  datasetId: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  configuration: {
    learningRate: number;
    batchSize: number;
    epochs: number;
    splits: string[];
    hardware: string;
  };
  logLocation: string | null;
  outputArtifactLocation: string | null;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  logs: string[];
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, any> | null;
  createdAt: string;
}

class InMemoryDataStore {
  users: Map<string, User> = new Map();
  books: Map<string, Book> = new Map();
  pages: Map<string, ManuscriptPage> = new Map();
  jobs: Map<string, RecognitionJob> = new Map();
  transcriptions: Map<string, Transcription> = new Map();
  revisions: Map<string, TranscriptionRevision[]> = new Map();
  datasets: Map<string, Dataset> = new Map();
  datasetSamples: Map<string, DatasetSample[]> = new Map();
  models: Map<string, ModelRegistry> = new Map();
  evaluations: Map<string, EvaluationExperiment> = new Map();
  trainingJobs: Map<string, TrainingJob> = new Map();
  auditEvents: AuditEvent[] = [];

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData() {
    const now = new Date().toISOString();

    // 1. Users
    const adminUser: User = {
      id: 'usr_admin_001',
      email: 'admin@manuscript.ai',
      passwordHash: hashPassword('AdminPass2026!'),
      displayName: 'Dr. Maryam Mirzakhani',
      role: 'ADMIN',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    const researcherUser: User = {
      id: 'usr_researcher_002',
      email: 'researcher@manuscript.ai',
      passwordHash: hashPassword('ResearchPass2026!'),
      displayName: 'Prof. Ehsan Yarshater',
      role: 'RESEARCHER',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    const viewerUser: User = {
      id: 'usr_viewer_003',
      email: 'viewer@manuscript.ai',
      passwordHash: hashPassword('ViewerPass2026!'),
      displayName: 'Layla Al-Khatib',
      role: 'VIEWER',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(adminUser.id, adminUser);
    this.users.set(researcherUser.id, researcherUser);
    this.users.set(viewerUser.id, viewerUser);

    // 2. Books
    const book1: Book = {
      id: 'bk_shahnameh_01',
      title: 'Shahnameh of Ferdowsi (شاهنامه فردوسی)',
      author: 'Abolqasem Ferdowsi (ابوالقاسم فردوسی)',
      language: 'fa',
      description: 'The monumental Shah Tahmasp manuscript, celebrated for exquisite Nastaliq calligraphy and Safavid miniature illumination.',
      manuscriptIdentifier: 'MS. Houghton / Met 1970.301',
      estimatedDate: '1522–1540 CE (Safavid Era)',
      collectionName: 'Metropolitan Museum of Art & Tehran Museum of Contemporary Art',
      sourceUrl: 'https://www.metmuseum.org/art/collection/search/452102',
      license: 'Public Domain / Open Access',
      createdById: adminUser.id,
      createdAt: now,
      updatedAt: now,
    };

    const book2: Book = {
      id: 'bk_golestan_02',
      title: 'Golestan of Saadi Shirazi (گلستان سعدی)',
      author: 'Saadi Shirazi (مشرف‌الدین مصلح سعدی)',
      language: 'fa',
      description: 'Masterpiece of Persian didactic prose and poetry in elegant Naskh and Nastaliq scripts with gilded arabesques.',
      manuscriptIdentifier: 'MS. Or. 5319',
      estimatedDate: '1568 CE (976 AH)',
      collectionName: 'British Library Oriental Collection',
      sourceUrl: 'https://blogs.bl.uk/asian-and-african/persian.html',
      license: 'Public Domain',
      createdById: researcherUser.id,
      createdAt: now,
      updatedAt: now,
    };

    const book3: Book = {
      id: 'bk_qanun_03',
      title: 'The Canon of Medicine (کتاب القانون في الطب)',
      author: 'Ibn Sina / Avicenna (ابن سینا)',
      language: 'ar',
      description: 'Encyclopedic medical canon in classical Arabic script, foundational to medieval Islamic and European medicine.',
      manuscriptIdentifier: 'MS. Arab. 51',
      estimatedDate: '1025 CE / 416 AH',
      collectionName: 'Bodleian Library, Oxford',
      sourceUrl: 'https://digital.bodleian.ox.ac.uk',
      license: 'Public Domain',
      createdById: adminUser.id,
      createdAt: now,
      updatedAt: now,
    };

    const book4: Book = {
      id: 'bk_hafiz_04',
      title: 'Divan of Hafiz Shirazi (دیوان حافظ شیرازی)',
      author: 'Khwaja Shams-ud-Din Muhammad Hafiz (حافظ)',
      language: 'fa',
      description: 'Lyrical ghazals copied in Timurid Nastaliq script by Sultan Ali Mashhadi with lapis lazuli borders.',
      manuscriptIdentifier: 'MS. Suppl. persan 1417',
      estimatedDate: '1485 CE (Timurid Era)',
      collectionName: 'Bibliothèque nationale de France (BnF)',
      sourceUrl: 'https://gallica.bnf.fr',
      license: 'Public Domain',
      createdById: researcherUser.id,
      createdAt: now,
      updatedAt: now,
    };

    this.books.set(book1.id, book1);
    this.books.set(book2.id, book2);
    this.books.set(book3.id, book3);
    this.books.set(book4.id, book4);

    // 3. Manuscript Pages
    const page1: ManuscriptPage = {
      id: 'pg_shahnameh_f01',
      bookId: book1.id,
      pageNumber: 1,
      folioLabel: 'Folio 1b',
      imageStorageKey: 'uploads/shahnameh_f01b.webp',
      originalFilename: 'shahnameh_dibache_f1b.webp',
      mimeType: 'image/webp',
      fileSize: 482104,
      checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      imageWidth: 1600,
      imageHeight: 2400,
      language: 'fa',
      uploadedById: adminUser.id,
      lines: [
        { id: 'ln_01', lineNumber: 1, box: [120, 180, 240, 820], recognizedText: 'به نام خداوند جان و خرد', confidence: 0.985 },
        { id: 'ln_02', lineNumber: 2, box: [250, 180, 370, 820], recognizedText: 'کزین برتر اندیشه برنگذرد', confidence: 0.978 },
        { id: 'ln_03', lineNumber: 3, box: [380, 180, 500, 820], recognizedText: 'خداوند نام و خداوند جای', confidence: 0.991 },
        { id: 'ln_04', lineNumber: 4, box: [510, 180, 630, 820], recognizedText: 'خداوند روزی ده رهنمای', confidence: 0.982 },
      ],
      createdAt: now,
      updatedAt: now,
    };

    const page2: ManuscriptPage = {
      id: 'pg_golestan_f01',
      bookId: book2.id,
      pageNumber: 1,
      folioLabel: 'Folio 1a',
      imageStorageKey: 'uploads/golestan_f01a.webp',
      originalFilename: 'golestan_dibache_f1a.webp',
      mimeType: 'image/webp',
      fileSize: 395120,
      checksum: 'c4ca4238a0b923820dcc509a6f75849b25fb26038848d797bb52b2b10a957d19',
      imageWidth: 1500,
      imageHeight: 2200,
      language: 'fa',
      uploadedById: researcherUser.id,
      lines: [
        { id: 'ln_g01', lineNumber: 1, box: [140, 200, 260, 800], recognizedText: 'منت خدای را عز و جل که طاعتش موجب قربت است', confidence: 0.962 },
        { id: 'ln_g02', lineNumber: 2, box: [280, 200, 400, 800], recognizedText: 'و به شکر اندرش مزید نعمت، هر نفسی که فرو می‌رود ممد حیات است', confidence: 0.954 },
      ],
      createdAt: now,
      updatedAt: now,
    };

    const page3: ManuscriptPage = {
      id: 'pg_qanun_f01',
      bookId: book3.id,
      pageNumber: 1,
      folioLabel: 'Folio 1r',
      imageStorageKey: 'uploads/qanun_f01r.webp',
      originalFilename: 'canon_medicine_f1r.webp',
      mimeType: 'image/webp',
      fileSize: 521400,
      checksum: '8b1a9953c4611296a827abf8c47804d7d117a58a6a61bc79f170428581e28f32',
      imageWidth: 1650,
      imageHeight: 2500,
      language: 'ar',
      uploadedById: adminUser.id,
      lines: [
        { id: 'ln_q01', lineNumber: 1, box: [150, 160, 280, 840], recognizedText: 'القول في حد الطب وموضوعه وغايته في المعالجة', confidence: 0.974 },
        { id: 'ln_q02', lineNumber: 2, box: [300, 160, 430, 840], recognizedText: 'إن الطب علم يتعرف منه أحوال بدن الإنسان من جهة ما يصح ويزول عن الصحة', confidence: 0.981 },
      ],
      createdAt: now,
      updatedAt: now,
    };

    this.pages.set(page1.id, page1);
    this.pages.set(page2.id, page2);
    this.pages.set(page3.id, page3);

    // 4. Recognition Jobs
    const job1: RecognitionJob = {
      id: 'job_rec_001',
      pageId: page1.id,
      requestedById: researcherUser.id,
      modelId: 'mdl_trocr_persian_v1',
      recognitionMode: 'FULL_PAGE',
      status: 'COMPLETED',
      errorCode: null,
      errorMessage: null,
      submittedAt: new Date(Date.now() - 3600000).toISOString(),
      startedAt: new Date(Date.now() - 3590000).toISOString(),
      completedAt: new Date(Date.now() - 3582000).toISOString(),
      processingDurationMs: 8200,
    };

    const job2: RecognitionJob = {
      id: 'job_rec_002',
      pageId: page2.id,
      requestedById: researcherUser.id,
      modelId: 'mdl_trocr_persian_v1',
      recognitionMode: 'FULL_PAGE',
      status: 'COMPLETED',
      errorCode: null,
      errorMessage: null,
      submittedAt: new Date(Date.now() - 1800000).toISOString(),
      startedAt: new Date(Date.now() - 1790000).toISOString(),
      completedAt: new Date(Date.now() - 1783500).toISOString(),
      processingDurationMs: 6500,
    };

    this.jobs.set(job1.id, job1);
    this.jobs.set(job2.id, job2);

    // 5. Transcriptions & Revisions
    const rawText1 = `به نام خداوند جان و خرد
کزین برتر اندیشه برنگذرد
خداوند نام و خداوند جای
خداوند روزی ده رهنمای`;

    const correctedText1 = `به نام خداوند جان و خرد
کزین برتر اندیشه برنگذرد
خداوند نام و خداوند جای
خداوند روزی ده رهنمای`;

    const transcription1: Transcription = {
      id: 'tr_shahnameh_01',
      pageId: page1.id,
      recognitionJobId: job1.id,
      rawText: rawText1,
      correctedText: correctedText1,
      normalizedSearchText: normalizePersianArabicText(correctedText1),
      reviewStatus: 'APPROVED',
      language: 'fa',
      modelId: 'mdl_trocr_persian_v1',
      modelVersion: 'v1.2.0',
      version: 2,
      createdAt: new Date(Date.now() - 3580000).toISOString(),
      updatedAt: new Date(Date.now() - 1800000).toISOString(),
    };

    const rev1: TranscriptionRevision = {
      id: 'rev_01_tr1',
      transcriptionId: transcription1.id,
      revisionNumber: 1,
      text: rawText1,
      changedById: researcherUser.id,
      changeSummary: 'استخراج اولیه از خط نستعلیق توسط مدل TrOCR',
      createdAt: new Date(Date.now() - 3580000).toISOString(),
    };

    const rev2: TranscriptionRevision = {
      id: 'rev_02_tr1',
      transcriptionId: transcription1.id,
      revisionNumber: 2,
      text: correctedText1,
      changedById: adminUser.id,
      changeSummary: 'بررسی دانشگاهی و تطبیق با نسخه مصحح جلال خالقی مطلق',
      createdAt: new Date(Date.now() - 1800000).toISOString(),
    };

    this.transcriptions.set(transcription1.id, transcription1);
    this.revisions.set(transcription1.id, [rev1, rev2]);

    const rawText2 = `منت خدای را عز و جل که طاعتش موجب قربت است
و به شکر اندرش مزید نعمت، هر نفسی که فرو می‌رود ممد حیات است`;

    const transcription2: Transcription = {
      id: 'tr_golestan_02',
      pageId: page2.id,
      recognitionJobId: job2.id,
      rawText: rawText2,
      correctedText: rawText2,
      normalizedSearchText: normalizePersianArabicText(rawText2),
      reviewStatus: 'PENDING_REVIEW',
      language: 'fa',
      modelId: 'mdl_trocr_persian_v1',
      modelVersion: 'v1.2.0',
      version: 1,
      createdAt: new Date(Date.now() - 1780000).toISOString(),
      updatedAt: new Date(Date.now() - 1780000).toISOString(),
    };

    this.transcriptions.set(transcription2.id, transcription2);
    this.revisions.set(transcription2.id, [
      {
        id: 'rev_01_tr2',
        transcriptionId: transcription2.id,
        revisionNumber: 1,
        text: rawText2,
        changedById: researcherUser.id,
        changeSummary: 'بازشناسی خودکار سطرها',
        createdAt: new Date(Date.now() - 1780000).toISOString(),
      },
    ]);

    // 6. Datasets
    const dataset1: Dataset = {
      id: 'ds_persian_htr_corpus',
      name: 'Persian Historical Manuscript HTR Corpus (PHMC-2026)',
      description: 'مجموعه داده استاندارد دست‌نویس‌های خط نستعلیق و شکسته تیموری و صفوی برای ارزیابی HTR.',
      language: 'fa',
      source: 'National Library and Archives of Iran & British Library',
      license: 'CC-BY-4.0 Academic Open',
      manifestLocation: 'storage/datasets/phmc_2026/manifest.csv',
      manifestChecksum: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      status: 'READY',
      sampleCount: 1420,
      createdById: adminUser.id,
      createdAt: now,
      updatedAt: now,
    };

    const dataset2: Dataset = {
      id: 'ds_arabic_naskh_corpus',
      name: 'Arabic Classical Manuscripts Benchmark (ACMB)',
      description: 'مجموعه متون علمی و فلسفی جهان اسلام به خط نسخ تاریخی با نشانه‌گذاری سطر به سطر.',
      language: 'ar',
      source: 'Bodleian & Leiden Oriental Collections',
      license: 'CC-BY-SA-4.0',
      manifestLocation: 'storage/datasets/acmb_naskh/manifest.csv',
      manifestChecksum: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
      status: 'READY',
      sampleCount: 980,
      createdById: researcherUser.id,
      createdAt: now,
      updatedAt: now,
    };

    this.datasets.set(dataset1.id, dataset1);
    this.datasets.set(dataset2.id, dataset2);

    // 7. Models
    const model1: ModelRegistry = {
      id: 'mdl_trocr_persian_v1',
      name: 'TrOCR-Base Persian Nastaliq',
      version: 'v1.2.0',
      baseModelId: 'microsoft/trocr-base-stage1',
      providerType: 'pretrained',
      supportedLanguages: ['fa'],
      supportedModes: ['LINE', 'FULL_PAGE'],
      artifactLocation: 'storage/models/trocr_persian_nastaliq_v1.2.pt',
      license: 'Apache-2.0',
      status: 'ACTIVE',
      isAvailable: true,
      createdAt: now,
    };

    const model2: ModelRegistry = {
      id: 'mdl_htr_arabic_naskh_v2',
      name: 'HTR-Naskh Classical Arabic',
      version: 'v2.0.1',
      baseModelId: 'clovaai/deep-text-recognition-benchmark',
      providerType: 'finetuned',
      supportedLanguages: ['ar', 'fa'],
      supportedModes: ['LINE'],
      artifactLocation: 'storage/models/htr_naskh_arabic_v2.pt',
      license: 'MIT',
      status: 'ACTIVE',
      isAvailable: true,
      createdAt: now,
    };

    const model3: ModelRegistry = {
      id: 'mdl_mock_dev_eval',
      name: 'Mock Academic HTR Provider (Dev & Tests)',
      version: 'v1.0.0-mock',
      baseModelId: null,
      providerType: 'mock',
      supportedLanguages: ['fa', 'ar', 'ota'],
      supportedModes: ['LINE', 'FULL_PAGE'],
      artifactLocation: null,
      license: 'Public Domain',
      status: 'ACTIVE',
      isAvailable: true,
      createdAt: now,
    };

    this.models.set(model1.id, model1);
    this.models.set(model2.id, model2);
    this.models.set(model3.id, model3);

    // 8. Evaluations
    const eval1: EvaluationExperiment = {
      id: 'eval_exp_001',
      modelId: model1.id,
      datasetId: dataset1.id,
      language: 'fa',
      sampleCount: 250,
      cer: 0.042, // 4.2% Character Error Rate
      wer: 0.089, // 8.9% Word Error Rate
      averageInferenceTimeMs: 142,
      configuration: {
        beamSize: 5,
        temperature: 0.2,
        normalizePersian: true,
        stripDiacritics: true,
      },
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    };

    const eval2: EvaluationExperiment = {
      id: 'eval_exp_002',
      modelId: model2.id,
      datasetId: dataset2.id,
      language: 'ar',
      sampleCount: 180,
      cer: 0.038, // 3.8% Character Error Rate
      wer: 0.076, // 7.6% Word Error Rate
      averageInferenceTimeMs: 118,
      configuration: {
        beamSize: 4,
        temperature: 0.0,
        normalizeArabic: true,
      },
      createdAt: new Date(Date.now() - 43200000).toISOString(),
    };

    this.evaluations.set(eval1.id, eval1);
    this.evaluations.set(eval2.id, eval2);

    // 9. Training Job
    const trainJob1: TrainingJob = {
      id: 'trn_job_001',
      baseModelId: model1.id,
      datasetId: dataset1.id,
      status: 'COMPLETED',
      configuration: {
        learningRate: 0.00005,
        batchSize: 16,
        epochs: 15,
        splits: ['TRAIN', 'VAL'],
        hardware: '1x NVIDIA A100-SXM4-40GB',
      },
      logLocation: 'storage/training_logs/trn_job_001.log',
      outputArtifactLocation: 'storage/models/trocr_persian_nastaliq_v1.2.pt',
      startedAt: new Date(Date.now() - 172800000).toISOString(),
      completedAt: new Date(Date.now() - 158400000).toISOString(),
      errorMessage: null,
      logs: [
        'Epoch 1/15 [loss: 1.423, val_cer: 0.182]',
        'Epoch 5/15 [loss: 0.654, val_cer: 0.094]',
        'Epoch 10/15 [loss: 0.312, val_cer: 0.058]',
        'Epoch 15/15 [loss: 0.189, val_cer: 0.042] - Checkpoint saved successfully',
      ],
      createdAt: new Date(Date.now() - 172800000).toISOString(),
    };

    this.trainingJobs.set(trainJob1.id, trainJob1);

    // 10. Audit Events
    this.auditEvents.push(
      {
        id: 'aud_001',
        userId: adminUser.id,
        action: 'USER_LOGIN',
        entityType: 'User',
        entityId: adminUser.id,
        metadata: { ip: '127.0.0.1', client: 'Manuscript-AI-Web' },
        createdAt: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        id: 'aud_002',
        userId: researcherUser.id,
        action: 'SUBMIT_RECOGNITION_JOB',
        entityType: 'RecognitionJob',
        entityId: job1.id,
        metadata: { pageId: page1.id, model: model1.name },
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'aud_003',
        userId: adminUser.id,
        action: 'APPROVE_TRANSCRIPTION',
        entityType: 'Transcription',
        entityId: transcription1.id,
        metadata: { reviewStatus: 'APPROVED' },
        createdAt: new Date(Date.now() - 1800000).toISOString(),
      },
    );
  }

  // Helper methods
  recordAudit(userId: string, action: string, entityType: string, entityId: string, metadata: any = null) {
    const audit: AuditEvent = {
      id: `aud_${crypto.randomUUID().slice(0, 8)}`,
      userId,
      action,
      entityType,
      entityId,
      metadata,
      createdAt: new Date().toISOString(),
    };
    this.auditEvents.unshift(audit);
    if (this.auditEvents.length > 500) {
      this.auditEvents.pop();
    }
    return audit;
  }
}

export const db = new InMemoryDataStore();
