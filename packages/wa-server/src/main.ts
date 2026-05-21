import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SsrfExceptionFilter } from './common/ssrf-exception.filter';
import { UriDecodeExceptionFilter } from './common/uri-decode-exception.filter';

// Parse CLI args: --port 3001
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
