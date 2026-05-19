import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

// Parse CLI args: --port 3001 --token MY_SECRET
function parseArgs(): { port: number; token: string } {
  const args = process.argv.slice(2);
  let port = parseInt(process.env.PORT || '3001');
  let token = process.env.WA_TOKEN || 'changeme';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && args[i + 1]) port = parseInt(args[i + 1]);
    if (args[i] === '--token' && args[i + 1]) token = args[i + 1];
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

  app.enableCors({ origin: '*' }); // Dashboard will connect from different origin
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.setGlobalPrefix('api');

  await app.listen(port);

  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║        WaSphere WA Server            ║');
  console.log('╠══════════════════════════════════════╣');
  console.log(`║  Port  : ${port}                          ║`);
  console.log(`║  Token : ${token.substring(0, 8)}...              ║`);
  console.log('║  Status: Running ✓                   ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');
  console.log('Add this server in your WaSphere dashboard:');
  console.log(`  IP/Host : your-server-ip`);
  console.log(`  Port    : ${port}`);
  console.log(`  Token   : ${token}`);
  console.log('');
}

bootstrap();
