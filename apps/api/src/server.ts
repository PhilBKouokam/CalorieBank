import { createApp } from './app';
import { env } from './env';
import { prisma } from './db/client';

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
