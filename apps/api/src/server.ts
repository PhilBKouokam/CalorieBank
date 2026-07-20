import { createApp } from './app';
import { env } from './env';

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
