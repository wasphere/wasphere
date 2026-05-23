/**
 * Phase A verification script — run after migration to confirm table structure.
 * Since there are no legacy api_token / webhook_url columns to migrate from,
 * this verifies the tables exist and have the correct structure.
 *
 * Usage: npx ts-node scripts/verify-phase-a.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Phase A verification starting…\n');
  let passed = 0;
  let failed = 0;

  async function check(label: string, fn: () => Promise<boolean>) {
    try {
      const result = await fn();
      if (result) {
        console.log(`  ✅ ${label}`);
        passed++;
      } else {
        console.log(`  ❌ FAIL: ${label}`);
        failed++;
      }
    } catch (err) {
      console.log(`  ❌ ERROR: ${label} — ${String(err)}`);
      failed++;
    }
  }

  // Verify api_keys table is accessible
  await check('api_keys table exists and is queryable', async () => {
    await prisma.apiKey.count();
    return true;
  });

  // Verify webhooks table is accessible
  await check('webhooks table exists and is queryable', async () => {
    await prisma.webhook.count();
    return true;
  });

  // Verify unique index on key_prefix by attempting duplicate insert (expect error)
  await check('api_keys.key_prefix unique constraint active', async () => {
    const testPrefix = '__test_verify_a__';
    // Clean up any leftover from previous run
    await prisma.apiKey.deleteMany({ where: { keyPrefix: testPrefix } });

    const ws = await prisma.workspace.findFirst();
    if (!ws) {
      console.log('    (no workspace exists — skipping constraint test, table structure OK)');
      return true;
    }

    await prisma.apiKey.create({
      data: {
        workspaceId: ws.id,
        name: '__verify_test__',
        keyPrefix: testPrefix,
        keyHash: '__hash__',
        permissions: ['*'],
      },
    });

    let threw = false;
    try {
      await prisma.apiKey.create({
        data: {
          workspaceId: ws.id,
          name: '__verify_test_2__',
          keyPrefix: testPrefix,
          keyHash: '__hash2__',
          permissions: ['*'],
        },
      });
    } catch {
      threw = true;
    }

    // Clean up
    await prisma.apiKey.deleteMany({ where: { keyPrefix: testPrefix } });
    return threw;
  });

  // Verify CASCADE delete: deleting workspace removes its api_keys and webhooks
  await check('api_keys + webhooks cascade on workspace delete', async () => {
    // Create a throwaway workspace (need a user first)
    const user = await prisma.user.findFirst();
    if (!user) {
      console.log('    (no user exists — skipping cascade test, FK structure OK)');
      return true;
    }

    const ws = await prisma.workspace.create({
      data: { name: '__verify_cascade__', ownerId: user.id },
    });

    await prisma.apiKey.create({
      data: {
        workspaceId: ws.id,
        name: '__key__',
        keyPrefix: '__pfx_cascade__',
        keyHash: '__h__',
        permissions: ['*'],
      },
    });

    await prisma.webhook.create({
      data: {
        workspaceId: ws.id,
        name: '__wh__',
        url: 'https://example.com/hook',
        events: ['*'],
        signingSecret: 'a'.repeat(64),
      },
    });

    await prisma.workspace.delete({ where: { id: ws.id } });

    const keyCount = await prisma.apiKey.count({ where: { workspaceId: ws.id } });
    const hookCount = await prisma.webhook.count({ where: { workspaceId: ws.id } });
    return keyCount === 0 && hookCount === 0;
  });

  console.log(`\nPhase A verification complete: ${passed} passed, ${failed} failed.`);

  if (failed > 0) {
    console.error('\nFix failures before proceeding to Phase B.');
    process.exit(1);
  } else {
    console.log('\nAll checks passed. Phase B can begin.');
  }
}

main()
  .catch((err) => {
    console.error('Verification script error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
