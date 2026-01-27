import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PipelineStageSeedingService } from '../contacts/services/pipeline-stage-seeding.service';

/**
 * Seed pipeline stages
 *
 * Seeds the default 7 pipeline stages for the insurance business type.
 * Safe to run multiple times - uses upsert logic to avoid duplicates.
 *
 * Usage:
 * pnpm seed:pipeline-stages
 */
async function bootstrap() {
  console.log('[Seed] Starting pipeline stages seeding...');

  const app = await NestFactory.createApplicationContext(AppModule);
  const seedingService = app.get(PipelineStageSeedingService);

  try {
    await seedingService.seedDefaultStages();
    console.log('[Seed] ✅ Pipeline stages seeding completed successfully');
  } catch (error) {
    console.error('[Seed] ❌ Pipeline stages seeding failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();
