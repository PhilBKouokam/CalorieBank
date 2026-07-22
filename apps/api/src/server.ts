import { createApp } from './app';
import { env } from './env';
import { prisma } from './db/client';
import { bootstrapDevelopmentTodayAggregates } from './modules/today/today.bootstrap';
import { PrismaTodayAggregateRepository } from './modules/today/today.repository';

async function start() {
  try {
    await bootstrapDevelopmentTodayAggregates({
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

  app.listen(env.PORT, '0.0.0.0', () => {
    console.info(
      JSON.stringify({
        level: 'info',
        message: 'api_listening',
        service: 'caloriebank-api',
        port: env.PORT,
      }),
    );
  });
}

void start();

async function shutdown() {
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => {
  void shutdown();
});
process.on('SIGTERM', () => {
  void shutdown();
});
