import 'reflect-metadata';
import * as fs from 'fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SsrfExceptionFilter } from './common/ssrf-exception.filter';
import { UriDecodeExceptionFilter } from './common/uri-decode-exception.filter';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

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
  validateDocsEnv();
  validateWebhookSigningEnv();
  const { port, token } = parseArgs();

  // Inject parsed values into env so modules can access
  process.env.PORT = String(port);
  process.env.WA_TOKEN = token;

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

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
      .setTitle('WaSphere WA Server')
      .setDescription('REST API for managing WhatsApp sessions, messages, groups, contacts, and webhooks.')
      .setVersion(version)
      .addApiKey({ type: 'apiKey', in: 'header', name: 'X-Api-Token' }, 'X-Api-Token')
      .addSecurityRequirements('X-Api-Token')
      .build();

    const document = SwaggerModule.createDocument(app, config);

    const basicUser = process.env.DOCS_BASIC_AUTH_USER;
    const basicPass = process.env.DOCS_BASIC_AUTH_PASS;
    const expressApp = app.getHttpAdapter().getInstance();

    // SwaggerModule registers directly on Express (not NestJS router), so NestJS
    // middleware consumer (AuthMiddleware) does not cover Swagger routes.
    // We attach auth guards directly on the Express app BEFORE SwaggerModule.setup().
    if (basicUser && basicPass) {
      // Basic Auth mode: check Basic credentials on all /api/docs* paths.
      const basicAuthGuard = (req: any, res: any, next: any) => {
        const authHeader = req.headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Basic ')) {
          res.setHeader('WWW-Authenticate', 'Basic realm="WaSphere Docs"');
          return res.status(401).send('Unauthorized');
        }
        const [user, pass] = Buffer.from(authHeader.slice(6), 'base64').toString().split(':');
        if (user !== basicUser || pass !== basicPass) {
          res.setHeader('WWW-Authenticate', 'Basic realm="WaSphere Docs"');
          return res.status(401).send('Unauthorized');
        }
        next();
      };
      expressApp.use(`/${swaggerPath}`, basicAuthGuard);
      expressApp.use(`/${swaggerPath}-json`, basicAuthGuard);
    } else {
      // X-Api-Token fallback mode: reuse the same token check as the rest of the API.
      const tokenGuard = (req: any, res: any, next: any) => {
        const incoming = req.headers['x-api-token'];
        if (!incoming || incoming !== token) {
          return res.status(401).json({ message: 'Unauthorized', statusCode: 401 });
        }
        next();
      };
      expressApp.use(`/${swaggerPath}`, tokenGuard);
      expressApp.use(`/${swaggerPath}-json`, tokenGuard);
    }

    // SwaggerModule registers at /${swaggerPath} and /${swaggerPath}-json on Express directly.
    SwaggerModule.setup(swaggerPath, app, document);
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
