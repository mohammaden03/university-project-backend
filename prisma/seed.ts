/**
 * Manuscript AI - Prisma PostgreSQL Database Seeder
 *
 * Populates real database entities:
 * - Verified User accounts with bcrypt/pbkdf2 password hashing
 * - Master Persian & Arabic manuscript catalog (Shahnameh, Golestan, Canon of Medicine, Divan of Hafiz)
 * - Initial high-resolution manuscript folios with cryptographic SHA-256 checksums
 * - Ground truth transcriptions with optimistic concurrency versions and revision history
 * - Pretrained neural HTR model registries
 * - Standardized benchmark datasets and initial CER/WER evaluation experiments
 */

import { prisma } from '../src/database/prisma.service.js';
import { hashPassword } from '../src/common/auth.js';
import { normalizePersianArabicText } from '../src/common/normalization.js';

export async function runPrismaSeed(client = prisma) {
  console.log('[PrismaSeed] Starting database population...');

  // 1. Seed Users (with environment variable password support, fallback to secure dev defaults)
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD || 'AdminPass2026!';
  const researcherPassword = process.env.RESEARCHER_INITIAL_PASSWORD || 'ResearchPass2026!';
  const viewerPassword = process.env.VIEWER_INITIAL_PASSWORD || 'ViewerPass2026!';

  const admin = await client.user.upsert({
    where: { email: 'admin@manuscript.ai' },
    create: {
      id: 'usr_admin_001',
      email: 'admin@manuscript.ai',
      passwordHash: hashPassword(adminPassword),
      displayName: 'Dr. Maryam Mirzakhani',
      role: 'ADMIN',
      isActive: true,
    },
    update: {
      displayName: 'Dr. Maryam Mirzakhani',
      role: 'ADMIN',
      isActive: true,
    },
  });

  const researcher = await client.user.upsert({
    where: { email: 'researcher@manuscript.ai' },
    create: {
      id: 'usr_researcher_002',
      email: 'researcher@manuscript.ai',
      passwordHash: hashPassword(researcherPassword),
      displayName: 'Prof. Ehsan Yarshater',
      role: 'RESEARCHER',
      isActive: true,
    },
    update: {
      displayName: 'Prof. Ehsan Yarshater',
      role: 'RESEARCHER',
      isActive: true,
    },
  });

  const viewer = await client.user.upsert({
    where: { email: 'viewer@manuscript.ai' },
    create: {
      id: 'usr_viewer_003',
      email: 'viewer@manuscript.ai',
      passwordHash: hashPassword(viewerPassword),
      displayName: 'Layla Al-Khatib',
      role: 'VIEWER',
      isActive: true,
    },
    update: {
      displayName: 'Layla Al-Khatib',
      role: 'VIEWER',
      isActive: true,
    },
  });

  console.log('[PrismaSeed] Users initialized (Admin, Researcher, Viewer).');

  // 2. Seed Books
  const bookShahnameh = await client.book.upsert({
    where: { id: 'bk_shahnameh_01' },
    create: {
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
      createdById: admin.id,
    },
    update: {
      title: 'Shahnameh of Ferdowsi (شاهنامه فردوسی)',
      author: 'Abolqasem Ferdowsi (ابوالقاسم فردوسی)',
    },
  });

  const bookGolestan = await client.book.upsert({
    where: { id: 'bk_golestan_02' },
    create: {
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
      createdById: researcher.id,
    },
    update: {
      title: 'Golestan of Saadi Shirazi (گلستان سعدی)',
    },
  });

  const bookQanun = await client.book.upsert({
    where: { id: 'bk_qanun_03' },
    create: {
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
      createdById: admin.id,
    },
    update: {
      title: 'The Canon of Medicine (کتاب القانون في الطب)',
    },
  });

  const bookHafiz = await client.book.upsert({
    where: { id: 'bk_hafiz_04' },
    create: {
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
      createdById: researcher.id,
    },
    update: {
      title: 'Divan of Hafiz Shirazi (دیوان حافظ شیرازی)',
    },
  });

  console.log('[PrismaSeed] Historical manuscript catalog seeded (4 master codices).');

  // 3. Seed Manuscript Pages
  const page1 = await client.manuscriptPage.upsert({
    where: { id: 'pg_shahnameh_f01' },
    create: {
      id: 'pg_shahnameh_f01',
      bookId: bookShahnameh.id,
      pageNumber: 1,
      folioLabel: 'Folio 1b (Dibacheh)',
      imageStorageKey: 'uploads/folios/shahnameh_f01b.webp',
      originalFilename: 'shahnameh_dibache_f1b.webp',
      mimeType: 'image/webp',
      fileSize: 482104,
      checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      imageWidth: 1600,
      imageHeight: 2400,
      language: 'fa',
      uploadedById: admin.id,
    },
    update: { folioLabel: 'Folio 1b (Dibacheh)' },
  });

  const page2 = await client.manuscriptPage.upsert({
    where: { id: 'pg_golestan_f01' },
    create: {
      id: 'pg_golestan_f01',
      bookId: bookGolestan.id,
      pageNumber: 1,
      folioLabel: 'Folio 1b (Preface)',
      imageStorageKey: 'uploads/folios/golestan_f01b.webp',
      originalFilename: 'golestan_dibache_f1b.webp',
      mimeType: 'image/webp',
      fileSize: 512400,
      checksum: 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
      imageWidth: 1550,
      imageHeight: 2350,
      language: 'fa',
      uploadedById: researcher.id,
    },
    update: { folioLabel: 'Folio 1b (Preface)' },
  });

  const page3 = await client.manuscriptPage.upsert({
    where: { id: 'pg_qanun_f01' },
    create: {
      id: 'pg_qanun_f01',
      bookId: bookQanun.id,
      pageNumber: 1,
      folioLabel: 'Folio 1a (Book I Opening)',
      imageStorageKey: 'uploads/folios/qanun_f01a.webp',
      originalFilename: 'avicenna_canon_f1a.webp',
      mimeType: 'image/webp',
      fileSize: 630120,
      checksum: '3e23e8160039594a33894f6564e1b1348bbd7a0088d42c4acb73eeaed59c009d',
      imageWidth: 1700,
      imageHeight: 2500,
      language: 'ar',
      uploadedById: admin.id,
    },
    update: { folioLabel: 'Folio 1a (Book I Opening)' },
  });

  const page4 = await client.manuscriptPage.upsert({
    where: { id: 'pg_hafiz_f01' },
    create: {
      id: 'pg_hafiz_f01',
      bookId: bookHafiz.id,
      pageNumber: 1,
      folioLabel: 'Folio 1b (Ghazal 1)',
      imageStorageKey: 'uploads/folios/hafiz_f01b.webp',
      originalFilename: 'hafiz_ghazal_f1b.webp',
      mimeType: 'image/webp',
      fileSize: 420800,
      checksum: '2e7d2c03a9507ae265ecf5b5356885a53393a2029d241394997265a1a25aefc6',
      imageWidth: 1500,
      imageHeight: 2300,
      language: 'fa',
      uploadedById: researcher.id,
    },
    update: { folioLabel: 'Folio 1b (Ghazal 1)' },
  });

  // 4. Seed Model Registries
  await client.modelRegistry.upsert({
    where: { id: 'mdl_trocr_persian_v1' },
    create: {
      id: 'mdl_trocr_persian_v1',
      name: 'Persian TrOCR Historical Model',
      version: '1.2.0',
      baseModelId: 'microsoft/trocr-base-stage1',
      providerType: 'pretrained',
      supportedLanguages: ['fa'],
      supportedModes: ['FULL_PAGE', 'LINE'],
      artifactLocation: 'models/trocr_persian_historical_v1.2.pt',
      license: 'Apache-2.0',
      status: 'ACTIVE',
      isAvailable: true,
    },
    update: { isAvailable: true },
  });

  await client.modelRegistry.upsert({
    where: { id: 'mdl_crnn_arabic_v2' },
    create: {
      id: 'mdl_crnn_arabic_v2',
      name: 'Arabic BiLSTM-CRNN Manuscript Recognizer',
      version: '2.1.0',
      baseModelId: null,
      providerType: 'pretrained',
      supportedLanguages: ['ar'],
      supportedModes: ['LINE'],
      artifactLocation: 'models/crnn_arabic_manuscript_v2.pt',
      license: 'MIT',
      status: 'ACTIVE',
      isAvailable: true,
    },
    update: { isAvailable: true },
  });

  await client.modelRegistry.upsert({
    where: { id: 'mdl_bert_normalizer_fa' },
    create: {
      id: 'mdl_bert_normalizer_fa',
      name: 'Persian/Arabic Text Normalizer & Punctuation Corrector',
      version: '1.0.0',
      baseModelId: 'HooshvareLab/bert-fa-base-uncased',
      providerType: 'pretrained',
      supportedLanguages: ['fa', 'ar'],
      supportedModes: ['LINE', 'FULL_PAGE'],
      artifactLocation: 'models/bert_persian_norm_v1.bin',
      license: 'Apache-2.0',
      status: 'ACTIVE',
      isAvailable: true,
    },
    update: { isAvailable: true },
  });

  // 5. Seed Transcriptions & Revisions
  const shahnamehText = `به نام خداوند جان و خرد
کزین برتر اندیشه برنگذرد
خداوند نام و خداوند جای
خداوند روزی ده رهنمای
خداوند کیوان و گَردان سپهر
فروزندهٔ ماه و ناهید و مهر`;

  const tr1 = await client.transcription.upsert({
    where: { id: 'tr_shahnameh_f01' },
    create: {
      id: 'tr_shahnameh_f01',
      pageId: page1.id,
      rawText: shahnamehText,
      correctedText: shahnamehText,
      normalizedSearchText: normalizePersianArabicText(shahnamehText),
      reviewStatus: 'APPROVED',
      language: 'fa',
      modelId: 'mdl_trocr_persian_v1',
      modelVersion: '1.2.0',
      version: 1,
    },
    update: { reviewStatus: 'APPROVED' },
  });

  const golestanText = `منت خدای را عز و جل که طاعتش موجب قربت است و به شکر اندرش مزید نعمت. هر نفسی که فرو می‌رود ممدّ حیات است و چون برمی‌آید مفرّح ذات.`;

  await client.transcription.upsert({
    where: { id: 'tr_golestan_f01' },
    create: {
      id: 'tr_golestan_f01',
      pageId: page2.id,
      rawText: golestanText,
      correctedText: golestanText,
      normalizedSearchText: normalizePersianArabicText(golestanText),
      reviewStatus: 'APPROVED',
      language: 'fa',
      modelId: 'mdl_trocr_persian_v1',
      modelVersion: '1.2.0',
      version: 1,
    },
    update: { reviewStatus: 'APPROVED' },
  });

  const qanunText = `بسم الله الرحمن الرحيم. القول في حد الطب وموضوعه. قال الشيخ الرئيس أبو علي الحسين بن عبد الله بن سينا: الطب علم يتعرف منه أحوال بدن الإنسان من جهة ما يصح ويزول عن الصحة ليحفظ الصحة حاصلة ويستردها زائلة.`;

  await client.transcription.upsert({
    where: { id: 'tr_qanun_f01' },
    create: {
      id: 'tr_qanun_f01',
      pageId: page3.id,
      rawText: qanunText,
      correctedText: qanunText,
      normalizedSearchText: normalizePersianArabicText(qanunText),
      reviewStatus: 'PENDING_REVIEW',
      language: 'ar',
      modelId: 'mdl_crnn_arabic_v2',
      modelVersion: '2.1.0',
      version: 1,
    },
    update: {},
  });

  const revCount = await client.transcriptionRevision.count({ where: { transcriptionId: tr1.id } });
  if (revCount === 0) {
    await client.transcriptionRevision.create({
      data: {
        id: `rev_1_${tr1.id}`,
        transcriptionId: tr1.id,
        revisionNumber: 1,
        text: shahnamehText,
        changedById: admin.id,
        changeSummary: 'نسخه آغازین تصحیح‌شده از روی نسخه خطی شاه تهماسب',
      },
    });
  }

  // 6. Seed Datasets
  await client.dataset.upsert({
    where: { id: 'ds_persian_htr_corpus' },
    create: {
      id: 'ds_persian_htr_corpus',
      name: 'Persian Nastaliq & Shekasteh Manuscript Corpus',
      description: 'Benchmark dataset containing 1,420 manually verified manuscript line samples in Nastaliq, Shekasteh, and Naskh scripts.',
      language: 'fa',
      source: 'University Consortium for Manuscript Studies',
      license: 'CC-BY-NC 4.0',
      manifestLocation: 'datasets/manifests/persian_htr_corpus.csv',
      manifestChecksum: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
      status: 'READY',
      sampleCount: 1420,
      createdById: researcher.id,
    },
    update: { sampleCount: 1420 },
  });

  await client.dataset.upsert({
    where: { id: 'ds_arabic_medical_manuscripts' },
    create: {
      id: 'ds_arabic_medical_manuscripts',
      name: 'Classical Arabic Scientific & Medical Manuscripts',
      description: 'Line-level annotations from Avicenna, Al-Razi, and Ibn al-Nafis historical medical treatises.',
      language: 'ar',
      source: 'Bodleian & BnF Historical Archives',
      license: 'Open Access Research',
      manifestLocation: 'datasets/manifests/arabic_medical_corpus.csv',
      manifestChecksum: 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
      status: 'READY',
      sampleCount: 850,
      createdById: admin.id,
    },
    update: { sampleCount: 850 },
  });

  // 7. Seed Baseline Evaluations
  const evalCount = await client.evaluationExperiment.count();
  if (evalCount === 0) {
    await client.evaluationExperiment.create({
      data: {
        id: 'eval_bench_001',
        modelId: 'mdl_trocr_persian_v1',
        datasetId: 'ds_persian_htr_corpus',
        language: 'fa',
        sampleCount: 500,
        cer: 0.042, // 4.2% CER
        wer: 0.089, // 8.9% WER
        averageInferenceTimeMs: 142,
        configuration: {
          beamWidth: 5,
          normalizeUnicode: true,
          levenshteinMode: 'standard',
        },
      },
    });

    await client.evaluationExperiment.create({
      data: {
        id: 'eval_bench_002',
        modelId: 'mdl_crnn_arabic_v2',
        datasetId: 'ds_arabic_medical_manuscripts',
        language: 'ar',
        sampleCount: 300,
        cer: 0.068, // 6.8% CER
        wer: 0.124, // 12.4% WER
        averageInferenceTimeMs: 95,
        configuration: {
          beamWidth: 3,
          normalizeUnicode: true,
          levenshteinMode: 'standard',
        },
      },
    });
  }

  // 8. Seed Initial Audit Record
  await client.auditEvent.create({
    data: {
      id: `aud_init_${Date.now()}`,
      userId: admin.id,
      action: 'SYSTEM_SEED_INITIALIZED',
      entityType: 'System',
      entityId: 'manuscript-ai-core',
      metadata: { seededAt: new Date().toISOString() },
    },
  });

  console.log('[PrismaSeed] Database seeding completed successfully.');
}

if (process.argv[1]?.endsWith('seed.ts')) {
  runPrismaSeed().catch((err) => {
    console.error('[PrismaSeed] Fatal error:', err);
    process.exit(1);
  });
}
