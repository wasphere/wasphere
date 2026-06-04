import 'reflect-metadata';
import { NestExpressApplication } from '@nestjs/platform-express';

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

  // Non-fatal: warn loudly if a token-leaking dev flag is set in production.
  // The forgotPassword handler additionally refuses to log the token in prod.
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.EXPOSE_RESET_TOKEN_IN_LOGS === 'true'
  ) {
    console.error(
      '[Config] SECURITY WARNING: EXPOSE_RESET_TOKEN_IN_LOGS is true in production. ' +
        'Reset tokens will NOT be logged, but you should unset this flag.',
    );
  }
}

async function bootstrap(): Promise<void> {
  validateEnv();

  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('./app.module');
  const { ValidationPipe } = await import('@nestjs/common');
  const { DocumentBuilder, SwaggerModule } = await import('@nestjs/swagger');
  const { apiReference } = await import('@scalar/nestjs-api-reference');
  const { default: helmet } = await import('helmet');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
    bodyParser: false,
  });

  const { json: expressJson, urlencoded: expressUrlEncoded } = await import('express');
  // 25mb accommodates inbound media forwarded as base64 from wa-server (e.g. a
  // ~16MB WhatsApp video inflates to ~21MB as base64). Larger media is skipped
  // inline; a streaming media endpoint is the v1.2 fix for big files.
  app.use(
    expressJson({
      limit: '25mb',
      verify: (req: import('http').IncomingMessage & { rawBody?: Buffer }, _res, buf) => {
        (req as { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
  app.use(expressUrlEncoded({ extended: true, limit: '25mb' }));

  // Security headers. CSP and COEP are disabled because the Scalar docs UI
  // (/api/reference) needs inline scripts and cross-origin embeds — revisit in
  // v1.1 with a nonce-based CSP scoped to the docs route.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

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

  // OpenAPI spec — generated from NestJS decorators, served as JSON and via Scalar UI
  const swaggerConfig = new DocumentBuilder()
    .setTitle('WaSphere — Admin API')
    .setDescription(`
WaSphere is a self-hosted WhatsApp automation platform. This Admin API manages the dashboard layer — workspaces, authentication, audit logs, and statistics.

> **Looking for the WhatsApp API?** That lives on the WA Server (port 3001). Use it to send messages, manage sessions, configure webhooks, and interact with contacts and groups.

## Authentication

All endpoints except \`/auth/register\`, \`/auth/login\`, \`/auth/refresh\`, \`/auth/forgot-password\`, and \`/auth/reset-password\` require a **Bearer token**.

\`\`\`bash
# 1. Login to get a token
curl -X POST http://your-dashboard:3000/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email": "you@example.com", "password": "yourpassword"}'

# 2. Use the token on protected endpoints
curl http://your-dashboard:3000/workspaces \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
\`\`\`

Tokens are short-lived JWTs. Use \`POST /auth/refresh\` with your refresh token to get a new access token.

## Base URL

\`\`\`
http://your-dashboard:3000
\`\`\`

## Workspaces

A **workspace** is the top-level container for your WaSphere setup. It holds your WA Server connection config (URL + token) and scopes all sessions, messages, and audit data.

Most endpoints are scoped under \`/workspaces/{id}\`. Fetch your workspace ID from \`GET /workspaces\`.

## Proxy

\`ALL /workspaces/{id}/proxy/*\` transparently forwards requests to your configured WA Server, injecting auth automatically. This is how the dashboard UI talks to the WhatsApp API without exposing your WA Server token to the browser.
    `.trim())
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);

  // Raw OpenAPI JSON — Scalar reads from this
  app.use('/api/docs-json', (_req: unknown, res: { json: (d: unknown) => void }) => {
    res.json(document);
  });

  // Scalar three-column API reference
  app.use(
    '/api/reference',
    apiReference({
      spec: { url: '/api/docs-json' },
      metaData: {
        title: 'WaSphere API Reference',
        description: 'Self-hosted WhatsApp automation platform',
      },
      defaultHttpClient: { targetKey: 'shell', clientKey: 'curl' },
      customCss: `
        .light-mode {
          --scalar-color-accent: #10b981;
          --scalar-background-accent: #10b98120;
        }
        .dark-mode {
          --scalar-color-accent: #34d399;
          --scalar-background-accent: #34d39920;
        }
      `,
    }),
  );

  // Redirect old Swagger URL so bookmarks don't 404
  app.use('/api/docs', (_req: unknown, res: { redirect: (url: string) => void }) => {
    res.redirect('/api/reference');
  });

  const port = parseInt(process.env.DASHBOARD_PORT ?? '3000', 10);
  await app.listen(port, '0.0.0.0');
  console.log(`[Dashboard API] Listening on port ${port}`);
}

bootstrap().catch((err) => {
  console.error('[Dashboard API] Fatal startup error:', err);
  process.exit(1);
});
