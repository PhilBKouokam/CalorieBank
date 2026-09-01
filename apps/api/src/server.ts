import { createApp } from './app';
import { env } from './env';
import { prisma } from './db/client';
import { bootstrapDevelopmentTodayAggregates } from './modules/today/today.bootstrap';
import { PrismaTodayAggregateRepository } from './modules/today/today.repository';

async function start() {
  try {
    if (env.APP_ENV === 'local' && env.AUTH_MODE === 'development') await bootstrapDevelopmentTodayAggregates({
      config: env,
      developmentUser: {
        id: env.DEV_USER_ID,
        email: env.DEV_USER_EMAIL,
      },
      repository: new PrismaTodayAggregateRepository(prisma),
    });
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        message: 'development_today_bootstrap_failed',
        service: 'caloriebank-api',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    );
  }

  const app = createApp();

  const server = app.listen(env.PORT, '0.0.0.0', () => {
    console.info(
      JSON.stringify({
        level: 'info',
        message: 'api_listening',
        service: 'caloriebank-api',
        port: env.PORT,
        appEnvironment: env.APP_ENV,
        authenticationMode: env.AUTH_MODE,
      }),
    );
  });
  return server;
}

const serverPromise = start();
let shutdownPromise: Promise<void> | null = null;

function shutdown(signal: 'SIGINT' | 'SIGTERM') {
  if (shutdownPromise) return shutdownPromise;
  shutdownPromise = (async () => {
    console.info(JSON.stringify({
      level: 'info', message: 'api_shutdown_started', service: 'caloriebank-api', signal,
    }));
    const server = await serverPromise;
    if (server.listening) {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
    await prisma.$disconnect();
    console.info(JSON.stringify({
      level: 'info', message: 'api_shutdown_completed', service: 'caloriebank-api', signal,
    }));
  })();
  return shutdownPromise;
}

process.on('SIGINT', () => {
  void shutdown('SIGINT').then(() => process.exit(0)).catch((error) => {
    console.error(JSON.stringify({
      level: 'error', message: 'api_shutdown_failed', service: 'caloriebank-api',
      reasonCode: error instanceof Error ? error.name : 'unknown',
    }));
    process.exit(1);
  });
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM').then(() => process.exit(0)).catch((error) => {
    console.error(JSON.stringify({
      level: 'error', message: 'api_shutdown_failed', service: 'caloriebank-api',
      reasonCode: error instanceof Error ? error.name : 'unknown',
    }));
    process.exit(1);
  });
});
