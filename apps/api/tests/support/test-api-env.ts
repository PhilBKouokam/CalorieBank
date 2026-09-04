import { env, type ApiEnv } from '../../src/env';

type LocalDevelopmentOverrides = Partial<Omit<ApiEnv, 'APP_ENV' | 'AUTH_MODE'>>;

export function localDevelopmentApiEnv(overrides: LocalDevelopmentOverrides = {}): ApiEnv {
  return {
    ...env,
    ...overrides,
    APP_ENV: 'local',
    AUTH_MODE: 'development',
  };
}
