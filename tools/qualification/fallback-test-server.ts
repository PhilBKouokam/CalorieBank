import { getAuth } from '@clerk/express';
import express from 'express';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertFallbackTestEnvironment, blockedFallbackTestRoute } from './fallback-test-policy';

async function main() {
  // Validate before importing any API module or opening a database connection.
  const isolation = assertFallbackTestEnvironment(process.env);
  if (process.versions.node !== '20.20.2') throw new Error('Use the qualified Node runtime.');
  if (process.env.FALLBACK_TEST_RUN_BASE_MIGRATIONS === '1') {
    const migrations = readdirSync(resolve('apps/api/prisma/migrations'), { withFileTypes: true })
      .filter(entry => entry.isDirectory());
    if (migrations.length !== 40) throw new Error('Only the frozen 40 core test migrations are permitted.');
    execFileSync(process.execPath, [resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy',
      '--schema', resolve('apps/api/prisma/schema.prisma')], { stdio: 'pipe' });
  }
  const [{ createApp }, { env }, { prisma }, { createAuthenticationBoundary }] = await Promise.all([
    import('../../apps/api/src/app'), import('../../apps/api/src/env'),
    import('../../apps/api/src/db/client'), import('../../apps/api/src/auth/current-user'),
  ]);
  const original = createAuthenticationBoundary(env, prisma);
  const app = express();
  app.disable('x-powered-by');
  app.use((request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    if (Date.now() >= isolation.expiry) return response.status(503).json({ error: 'This test session expired.' });
    if (blockedFallbackTestRoute(request)) return response.status(403).json({ error: 'This action is outside the synthetic qualification session.' });
    next();
  });
  app.use(createApp(env, {
    finalizationScheduler: null,
    todayPredictionResolver: null,
    authenticationBoundary: {
      verify: original.verify,
      requireUser: (request, response, next) => {
        if (request.path === '/health' || request.path === '/health/ready') return original.requireUser(request, response, next);
        const auth = getAuth(request);
        // Deny before the ordinary identity boundary could provision any row.
        if (!auth.isAuthenticated || !auth.sessionId || !auth.userId || !isolation.subjects.has(auth.userId)) {
          return response.status(401).json({ error: 'A dedicated test account is required.' });
        }
        return original.requireUser(request, response, next);
      },
    },
  }));
  const port = Number(process.env.PORT ?? 4321);
  const host = process.env.FALLBACK_TEST_LISTEN_HOST === '0.0.0.0' ? '0.0.0.0' : '127.0.0.1';
  const server = app.listen(port, host, () => {
    console.info(JSON.stringify({ event: 'fallback_test_ready', fixtureSource: 'ec9cbef',
      syntheticOnly: true, accountAccessConfigured: isolation.subjects.size > 0, providerCredentials: false }));
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
    server.close(() => { void prisma.$disconnect().then(() => process.exit(0)); });
  });
}

void main().catch(() => {
  // Validation and remote errors must not print environment values/connection URLs.
  console.error('The isolated fallback test service failed its safety preflight.');
  process.exitCode = 1;
});
