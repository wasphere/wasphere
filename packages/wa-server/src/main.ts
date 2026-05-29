import 'reflect-metadata';
import * as fs from 'fs';
import * as net from 'net';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SsrfExceptionFilter } from './common/ssrf-exception.filter';
import { UriDecodeExceptionFilter } from './common/uri-decode-exception.filter';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import helmet from 'helmet';

// Parse CLI args: --port 3001 and validate docs env vars
function validateDocsEnv(): void {
  const basicUser = process.env.DOCS_BASIC_AUTH_USER;
  const basicPass = process.env.DOCS_BASIC_AUTH_PASS;
  if ((basicUser && !basicPass) || (!basicUser && basicPass)) {
    console.error('[WA Server] DOCS_BASIC_AUTH_USER and DOCS_BASIC_AUTH_PASS must both be set or both be unset');
    process.exit(1);
  }
}

function validateWebhookSigningEnv(): void {
  const webhookUrl = process.env.DASHBOARD_WEBHOOK_URL ?? '';
  const secret = process.env.WEBHOOK_SIGNING_SECRET ?? '';

  if (!webhookUrl) return; // no URL configured — signing irrelevant

  if (!secret) {
    console.error(
      '[WA Server] WEBHOOK_SIGNING_SECRET must be set when DASHBOARD_WEBHOOK_URL is configured. ' +
      'Generate one with: openssl rand -hex 32'
    );
    process.exit(1);
  }

  if (secret.length < 32) {
    console.error(
      '[WA Server] WEBHOOK_SIGNING_SECRET must be at least 32 characters. ' +
      'Generate one with: openssl rand -hex 32'
    );
    process.exit(1);
  }
}

function validateAuditEnv(): void {
  const auditUrl = process.env.AUDIT_DASHBOARD_URL ?? '';
  const secret = process.env.INTERNAL_WEBHOOK_SECRET ?? '';

  if (!auditUrl) {
    console.info('[Audit] AUDIT_DASHBOARD_URL not configured — audit events will be logged to stdout only.');
    return;
  }

  if (!secret || secret.length < 32) {
    console.warn(
      '[Audit] WARNING: AUDIT_DASHBOARD_URL is set but INTERNAL_WEBHOOK_SECRET is missing or too short (min 32 chars). ' +
      'Audit delivery will fail until this is corrected.'
    );
    // Do NOT exit — audit is non-critical path
  }
}

function validateMaxSessionsEnv(): void {
  const raw = process.env.MAX_SESSIONS;
  if (raw === undefined) return;
  const n = parseInt(raw, 10);
  if (isNaN(n) || n < 1 || n > 1000) {
    console.error('[WA Server] MAX_SESSIONS must be a positive integer between 1 and 1000');
    process.exit(1);
  }
}

function validateReconnectEnv(): void {
  const raw = process.env.MAX_RECONNECT_ATTEMPTS;
  if (raw === undefined) return;
  const n = parseInt(raw, 10);
  if (isNaN(n) || n < 1 || n > 100) {
    console.error('[WA Server] MAX_RECONNECT_ATTEMPTS must be an integer between 1 and 100');
    process.exit(1);
  }
}

function validateRateLimitEnv(): void {
  const rawMax = process.env.RATE_LIMIT_MAX;
  const rawWindow = process.env.RATE_LIMIT_WINDOW_MS;

  if (rawMax === undefined && rawWindow === undefined) return;

  if (rawMax !== undefined) {
    const max = parseInt(rawMax, 10);
    if (isNaN(max) || max < 1) {
      console.error('[WA Server] RATE_LIMIT_MAX must be a positive integer');
      process.exit(1);
    }
  }

  if (rawWindow !== undefined) {
    const windowMs = parseInt(rawWindow, 10);
    if (isNaN(windowMs) || windowMs < 1000) {
      console.error('[WA Server] RATE_LIMIT_WINDOW_MS must be an integer >= 1000 (1 second)');
      process.exit(1);
    }
  }
}

function validateAllowlistEnv(): void {
  const raw = process.env.ALLOWED_IPS ?? '';
  if (!raw.trim()) {
    console.info('[Allowlist] ALLOWED_IPS not set — allowlist disabled, all IPs permitted.');
    return;
  }
  const entries = raw.split(',').map(s => s.trim()).filter(Boolean);
  let validCount = 0;
  for (const entry of entries) {
    const slashIdx = entry.indexOf('/');
    const withoutCidr = slashIdx === -1 ? entry : entry.slice(0, slashIdx);
    const family = net.isIP(withoutCidr); // 4, 6, or 0
    const maxPrefix = family === 4 ? 32 : family === 6 ? 128 : -1;
    let valid = family !== 0;
    if (valid && slashIdx !== -1) {
      const prefix = parseInt(entry.slice(slashIdx + 1), 10);
      valid = !isNaN(prefix) && prefix >= 0 && prefix <= maxPrefix;
    }
    if (valid) {
      validCount++;
    } else {
      console.warn(`[Allowlist] Malformed entry skipped: "${entry}"`);
    }
  }
  if (validCount === 0) {
    console.error(
      '[Allowlist] FATAL: ALLOWED_IPS is set but contains no valid entries. ' +
      'Fix your allowlist or unset ALLOWED_IPS to disable. Exiting.',
    );
    process.exit(1);
  }
  console.info(`[Allowlist] Allowlist enabled — ${validCount} valid entries loaded.`);
  if (process.env.TRUST_PROXY === 'true') {
    console.warn(
      '[Allowlist] TRUST_PROXY=true: ensure your reverse proxy strips X-Forwarded-For before ' +
      'appending the real client IP, otherwise the allowlist can be bypassed by IP spoofing.',
    );
  }
}

function parseArgs(): { port: number; token: string } {
  const args = process.argv.slice(2);
  let port = parseInt(process.env.PORT || '3001');
  const token = process.env.WA_TOKEN ?? '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && args[i + 1]) port = parseInt(args[i + 1]);
  }

  if (!token || token.length < 16) {
    console.error('ERROR: WA_TOKEN env var must be set to a secret of at least 16 characters. Exiting.');
    process.exit(1);
  }

  return { port, token };
}

async function bootstrap() {
  validateAllowlistEnv();
  validateMaxSessionsEnv();
  validateReconnectEnv();
  validateRateLimitEnv();
  validateDocsEnv();
  validateWebhookSigningEnv();
  validateAuditEnv();
  const { port, token } = parseArgs();

  // Inject parsed values into env so modules can access
  process.env.PORT = String(port);
  process.env.WA_TOKEN = token;

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
    bodyParser: false,
  });

  const { json: expressJson, urlencoded: expressUrlEncoded } = await import('express');

  // Security headers. CSP and COEP are disabled because the Scalar docs UI
  // needs inline scripts and cross-origin embeds — revisit in v1.1 with a
  // nonce-based CSP scoped to the docs route.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(expressJson({ limit: '10mb' }));
  app.use(expressUrlEncoded({ extended: true, limit: '10mb' }));

  // Raw Express middleware — must run before NestJS routing so it catches all requests
  // including those whose URLs are normalized away by Express route matching
  app.use((req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    const TRAVERSAL_RE = /(?:\/|%2f)(?:\.\.?|%2e%2e?)(?:\/|%2f|$)|\/\//i;
    if (TRAVERSAL_RE.test(req.url)) {
      res.status(400).json({ error: 'INVALID_SESSION_ID' });
      return;
    }
    next();
  });

  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
  if (corsOrigin === '*' || corsOrigin.trim() === '') {
    console.error('ERROR: CORS_ORIGIN must not be wildcard (*) or empty. Set a specific origin. Exiting.');
    process.exit(1);
  }
  app.enableCors({ origin: corsOrigin }); // Dashboard will connect from different origin
  app.useGlobalFilters(new UriDecodeExceptionFilter(), new SsrfExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.setGlobalPrefix('api');

  // Swagger / OpenAPI setup
  // swaggerPath is the full path as Express sees it (e.g. 'api/docs').
  // SwaggerModule.setup() registers directly on Express — it does NOT apply the
  // NestJS global prefix. So we pass the full path including 'api/'.
  const swaggerEnabled = process.env.SWAGGER_ENABLED !== 'false';
  const swaggerPath = (process.env.SWAGGER_PATH ?? 'api/docs').replace(/^\/+|\/+$/g, '');

  if (swaggerEnabled) {
    const { version } = JSON.parse(fs.readFileSync('package.json', 'utf8'));

    const config = new DocumentBuilder()
      .setTitle('WaSphere — WhatsApp API')
      .setDescription(`
WaSphere is a self-hosted WhatsApp automation platform. This API lets you manage WhatsApp sessions, send all message types, configure webhooks, and interact with contacts and groups — all over a simple REST interface.

## Authentication

Every request must include your API token in the \`X-Api-Token\` header. Set this token via the \`WA_TOKEN\` environment variable when starting the server.

\`\`\`bash
curl http://your-server:3001/api/sessions \\
  -H "X-Api-Token: YOUR_TOKEN"
\`\`\`

## Base URL

\`\`\`
http://your-server:3001/api
\`\`\`

## How Sessions Work

A **session** represents one linked WhatsApp account.

1. **Create** a session → \`POST /sessions/{sessionId}\`
2. **Fetch the QR code** → \`GET /sessions/{sessionId}/qr\`
3. **Scan** the QR with WhatsApp on your phone (Linked Devices → Link a Device)
4. **Wait for status \`open\`** → \`GET /sessions/{sessionId}/status\`
5. **Start sending** using \`sessionId\` in all message, contact, and group endpoints

Sessions persist across server restarts. One server supports multiple concurrent sessions.

## Message Types

| Type | Endpoint |
|------|----------|
| Text | \`POST /sessions/{sessionId}/messages/text\` |
| Image | \`POST /sessions/{sessionId}/messages/image\` |
| Video | \`POST /sessions/{sessionId}/messages/video\` |
| Audio | \`POST /sessions/{sessionId}/messages/audio\` |
| Document | \`POST /sessions/{sessionId}/messages/document\` |
| Location | \`POST /sessions/{sessionId}/messages/location\` |
| Poll | \`POST /sessions/{sessionId}/messages/poll\` |
| Buttons | \`POST /sessions/{sessionId}/messages/buttons\` |
| List | \`POST /sessions/{sessionId}/messages/list\` |
| Reaction | \`POST /sessions/{sessionId}/messages/reaction\` |
| Sticker | \`POST /sessions/{sessionId}/messages/sticker\` |

## Rate Limiting

Default: **100 requests / minute** per IP. Configurable via \`RATE_LIMIT_MAX\` and \`RATE_LIMIT_WINDOW_MS\` environment variables.

## IP Allowlist

Optionally restrict API access to specific IPs or CIDR ranges via the \`ALLOWED_IPS\` environment variable.
      `.trim())
      .setVersion(version)
      .addApiKey({ type: 'apiKey', in: 'header', name: 'X-Api-Token' }, 'X-Api-Token')
      .addSecurityRequirements('X-Api-Token')
      .build();

    const document = SwaggerModule.createDocument(app, config);

    // Raw OpenAPI JSON — publicly accessible; Scalar reads from this.
    // To gate docs behind auth, set SWAGGER_ENABLED=false and serve your own wrapper.
    app.use('/api/docs-json', (_req: unknown, res: { json: (d: unknown) => void }) => {
      res.json(document);
    });

    // Scalar three-column API reference — publicly accessible
    app.use(
      '/api/reference',
      apiReference({
        spec: { url: '/api/docs-json' },
        metaData: {
          title: 'WaSphere API Reference',
          description: 'WhatsApp automation REST API — sessions, messages, webhooks, contacts, groups',
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

    // Redirect old Swagger path so existing bookmarks still work
    app.use(`/${swaggerPath}`, (_req: unknown, res: { redirect: (url: string) => void }) => {
      res.redirect('/api/reference');
    });
  }

  await app.listen(port);

  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║        WaSphere WA Server            ║');
  console.log('╠══════════════════════════════════════╣');
  console.log(`║  Port  : ${port}                          ║`);
  console.log('║  Status: Running ✓                   ║');
  console.log('║  Token : set via WA_TOKEN env var    ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');
  console.log('Add this server in your WaSphere dashboard:');
  console.log(`  IP/Host : your-server-ip`);
  console.log(`  Port    : ${port}`);
  console.log('');
}

bootstrap();
