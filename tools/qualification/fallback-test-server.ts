import { getAuth } from '@clerk/express';
import express from 'express';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertFallbackTestEnvironment, blockedFallbackTestRoute, classifySyntheticNativeFixture } from './fallback-test-policy';
import { createIosFixtureGuard, createIosFixturePayloadGuard, createIosFixtureStore } from './fallback-ios-guard';

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
  const iosGuard = createIosFixtureGuard(isolation.iosFixture, createIosFixtureStore(prisma));
  const app = express();
  app.disable('x-powered-by');
  app.use((request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    if (Date.now() >= isolation.expiry) return response.status(503).json({ error: 'This test session expired.' });
    if (blockedFallbackTestRoute(request, isolation.nativeFixture, isolation.iosFixture)) return response.status(403).json({ error: 'This action is outside the synthetic qualification session.' });
    next();
  });
  // Parse only the explicitly enabled exact native route; the ordinary API still
  // performs authentication, ownership, source selection and freshness checks.
  app.use(createIosFixturePayloadGuard(isolation.iosFixture));
  app.use((request, response, next) => {
    if (request.method !== 'POST' || request.path !== '/v1/me/ingestion/native-intake') return next();
    express.json({ limit: '32kb' })(request, response, error => {
      const decision = error ? 'invalid_json' : isolation.nativeFixture
        ? classifySyntheticNativeFixture(request.body as unknown, isolation.nativeFixture) : 'disabled';
      if (decision !== 'accepted') {
        // Only an allowlisted decision code leaves this test boundary. Never log
        // the body, parser error, source, date, amount, identity or credential.
        if (isolation.nativeFixture) console.info(JSON.stringify({ event: 'fallback_native_upload_rejected', reason: decision }));
        return response.status(403).json({ error: 'Only the configured synthetic native fixture is permitted.' });
      }
      next();
    });
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
        return original.requireUser(request, response, error => {
          if (error) return next(error);
          return iosGuard(request, response, next);
        });
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
