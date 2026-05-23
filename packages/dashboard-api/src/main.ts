import 'reflect-metadata';

function validateEnv(): void {
  const errors: string[] = [];

  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL is required');
  }

  const jwtSecret = process.env.JWT_SECRET ?? '';
  if (jwtSecret.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters');
  }

  const encryptionKey = process.env.ENCRYPTION_KEY ?? '';
  if (!/^[0-9a-f]{64}$/i.test(encryptionKey)) {
    errors.push(
      'ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)',
    );
  }

  const internalSecret = process.env.INTERNAL_WEBHOOK_SECRET ?? '';
  if (internalSecret.length < 32) {
    errors.push('INTERNAL_WEBHOOK_SECRET must be at least 32 characters');
  }

  const corsOrigin = process.env.CORS_ORIGIN ?? '';
  if (!corsOrigin || corsOrigin === '*') {
    errors.push('CORS_ORIGIN must be a specific URL — not empty or wildcard');
  }

  // Optional — only validate if explicitly set
  if (process.env.ARGON2_MEMORY_KB !== undefined) {
    const memCost = parseInt(process.env.ARGON2_MEMORY_KB, 10);
    if (isNaN(memCost) || memCost < 8192) {
      errors.push('ARGON2_MEMORY_KB must be >= 8192 if set');
    }
  }

  if (process.env.ARGON2_TIME_COST !== undefined) {
    const timeCost = parseInt(process.env.ARGON2_TIME_COST, 10);
    if (isNaN(timeCost) || timeCost < 1) {
      errors.push('ARGON2_TIME_COST must be >= 1 if set');
    }
  }

  if (errors.length > 0) {
    for (const err of errors) {
      console.error(`[Config] FATAL: ${err}`);
    }
    process.exit(1);
  }
}

async function bootstrap(): Promise<void> {
  validateEnv();

  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('./app.module');
  const { ValidationPipe } = await import('@nestjs/common');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
    bodyParser: false,
  });

  const { json: expressJson, urlencoded: expressUrlEncoded } = await import('express');
  app.use(
    expressJson({
      limit: '10mb',
      verify: (req: import('http').IncomingMessage & { rawBody?: Buffer }, _res, buf) => {
        (req as { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
  app.use(expressUrlEncoded({ extended: true, limit: '10mb' }));

  // Trust X-Forwarded-For for correct IP in throttler when behind a reverse proxy
  const expressApp = app.getHttpAdapter().getInstance() as {
    set: (key: string, value: unknown) => void;
  };
  expressApp.set('trust proxy', 1);

  app.enableCors({
    origin: process.env.CORS_ORIGIN!,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = parseInt(process.env.DASHBOARD_PORT ?? '3000', 10);
  await app.listen(port, '0.0.0.0');
  console.log(`[Dashboard API] Listening on port ${port}`);
}

bootstrap().catch((err) => {
  console.error('[Dashboard API] Fatal startup error:', err);
  process.exit(1);
});
