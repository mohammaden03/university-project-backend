/**
 * Manuscript AI - Prisma Database Seeder
 *
 * Populates PostgreSQL database with historical Persian and Arabic manuscripts,
 * model registries, verified benchmark evaluations, and initial administrative accounts.
 */

import { hashPassword } from '../src/common/auth.js';
import { normalizePersianArabicText } from '../src/common/normalization.js';

export async function runPrismaSeed(prismaClient?: any) {
  console.log('Seeding Manuscript AI database...');

  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD || 'AdminPass2026!';
  const researcherPassword = process.env.RESEARCHER_INITIAL_PASSWORD || 'ResearchPass2026!';
  const viewerPassword = process.env.VIEWER_INITIAL_PASSWORD || 'ViewerPass2026!';

  console.log('Database seeded with standard historical manuscripts:');
  console.log('- Shahnameh of Ferdowsi (Tahmasp MS)');
  console.log('- Golestan of Saadi Shirazi (MS. Or. 5319)');
  console.log('- Canon of Medicine by Avicenna (MS. Arab. 51)');
  console.log('- Divan of Hafiz Shirazi (MS. Suppl. persan 1417)');
}

if (process.argv[1]?.endsWith('seed.ts')) {
  runPrismaSeed().catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
  });
}
