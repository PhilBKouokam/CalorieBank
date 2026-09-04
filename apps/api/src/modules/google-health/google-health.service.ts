import { createHash, randomBytes } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import {
  estimateRestingBurnFromLowActivityHours,
  getBankContributionStatus,
  getLocalDateUtcBounds,
  getProvisionalLockAt,
  selectRestingBurnLookback,
} from '@caloriebank/domain';

import type { ApiEnv } from '../../env';
import { AppError } from '../../errors';
import type { FinalizationScheduler, OrchestrationTrigger } from '../finalization-orchestration/finalization-orchestration.service';
import type { DevelopmentUser } from '../goal-configuration/goal-configuration.repository';
import { getLocalDateForTimezone } from '../today/today.time';
import type { TodayAggregateRepository } from '../today/today.repository';
import {
  MAXIMUM_CALIBRATION_WORKOUTS,
  STEP_ESTIMATION_LOOKBACK_DAYS,
} from '../today/steps-intelligence';
import {
  GOOGLE_HEALTH_FITBIT_PROVIDER_ID,
  GoogleHealthFitbitExpenditureProvider,
  GoogleHealthFitbitStepProvider,
  GoogleHealthFitbitWorkoutProvider,
  GoogleHealthDailyRollupSchema,
  GoogleHealthHourlyRollupSchema,
  type GoogleHealthExerciseTransport,
  type GoogleHealthStepsTransport,
  type GoogleHealthTotalCaloriesTransport,
} from './google-health.provider';
import {
  decryptGoogleHealthSecret,
  encryptGoogleHealthSecret,
  validateGoogleHealthEncryptionKey,
} from './token-crypto';

export const GOOGLE_HEALTH_ACTIVITY_READ_SCOPE =
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly';

type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  refresh_token_expires_in?: number;
  scope?: string;
};

type GoogleHealthIdentity = {
  healthUserId: string;
  legacyUserId?: string;
};

export type GoogleHealthOAuthDiagnosticLogger = (
  event: string,
  metadata?: Readonly<Record<string, unknown>>,
) => void;

class GoogleHealthRemoteError extends AppError {
  constructor(
    message: string,
    readonly googleHttpStatus: number,
    readonly googleErrorCode: string | null,
  ) {
    super(message, 502);
    this.name = 'GoogleHealthRemoteError';
  }
}

function defaultOAuthLogger(event: string, metadata: Readonly<Record<string, unknown>> = {}) {
  console.info(JSON.stringify({
    level: event === 'oauth_callback_failure' ? 'error' : 'info',
    component: 'google_health_oauth',
    event,
    ...metadata,
  }));
}

function safeGooglePayload(value: unknown) {
  if (!value || typeof value !== 'object') return { code: null, message: null };
  const payload = value as {
    error?: string | { code?: number; status?: string; message?: string };
    error_description?: string;
    message?: string;
  };
  const nested = typeof payload.error === 'object' ? payload.error : null;
  const code = typeof payload.error === 'string'
    ? payload.error
    : typeof nested?.status === 'string'
      ? nested.status
      : typeof nested?.code === 'number'
        ? String(nested.code)
        : null;
  const message = payload.error_description ?? nested?.message ?? payload.message ?? null;
  return {
    code: code?.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 80) ?? null,
    message: message?.replace(/\s+/g, ' ').slice(0, 240) ?? null,
  };
}

function redactOAuthMessage(message: string) {
  return message
    .replace(/(?:ya29\.|1\/\/|4\/)[a-zA-Z0-9._~-]+/g, '[redacted]')
    .replace(/\b(access_token|refresh_token|code|client_secret)=[^&\s]+/gi, '$1=[redacted]')
    .replace(/\s+/g, ' ')
    .slice(0, 240);
}

async function parseGoogleResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new GoogleHealthRemoteError(
      'Google returned a malformed response.',
      response.status,
      'malformed_response',
    );
  }
}

function configured(config: ApiEnv) {
  if (!config.GOOGLE_HEALTH_CLIENT_ID || !config.GOOGLE_HEALTH_CLIENT_SECRET || !config.GOOGLE_HEALTH_REDIRECT_URI || !config.GOOGLE_HEALTH_TOKEN_ENCRYPTION_KEY) {
    throw new AppError('Fitbit is not configured for this environment.', 503, { code: 'CONFIGURATION_ERROR' });
  }
  validateGoogleHealthEncryptionKey(config.GOOGLE_HEALTH_TOKEN_ENCRYPTION_KEY);
  return {
    clientId: config.GOOGLE_HEALTH_CLIENT_ID,
    clientSecret: config.GOOGLE_HEALTH_CLIENT_SECRET,
    redirectUri: config.GOOGLE_HEALTH_REDIRECT_URI,
    encryptionKey: config.GOOGLE_HEALTH_TOKEN_ENCRYPTION_KEY,
  };
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('base64url');
}

function previousLocalDate(localDate: string, days: number) {
  const value = new Date(`${localDate}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

function nextLocalDate(localDate: string) {
  return previousLocalDate(localDate, -1);
}

function civilDate(localDate: string) {
  const [year, month, day] = localDate.split('-').map(Number);
  return { date: { year, month, day } };
}

type SyncCategory = 'expenditure' | 'steps' | 'workouts';
type SafeCategoryResult = {
  provider: typeof GOOGLE_HEALTH_FITBIT_PROVIDER_ID;
  category: SyncCategory;
  localDate: string;
  queryResult: 'ready' | 'empty' | 'error';
  uploadResult: 'created' | 'updated' | 'unchanged' | 'ignored_stale' | 'not_applicable' | 'error';
  errorCode?: string;
};

function safeMobileRedirect(value: string) {
  if (!/^caloriebank:\/\/integrations(?:\?.*)?$/.test(value)) {
    throw new AppError('Mobile redirect URI is invalid.', 400, { code: 'INVALID_REDIRECT' });
  }
  return value;
}

export class GoogleHealthFitbitService {
  constructor(
    private readonly db: PrismaClient,
    private readonly todayRepository: TodayAggregateRepository,
    private readonly config: ApiEnv,
    private readonly finalizationScheduler?: FinalizationScheduler,
    private readonly fetcher: typeof fetch = fetch,
    private readonly now: () => Date = () => new Date(),
    private readonly oauthLogger: GoogleHealthOAuthDiagnosticLogger = defaultOAuthLogger,
  ) {}

  logOAuthStage(event: string, metadata: Readonly<Record<string, unknown>> = {}) {
    this.oauthLogger(event, metadata);
  }

  logOAuthFailure(stage: string, error: unknown) {
    const remote = error instanceof GoogleHealthRemoteError ? error : null;
    const prismaCode = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : null;
    const safeMessage = error instanceof Error
      ? redactOAuthMessage(error.message)
      : 'Unknown callback failure';
    const migrationRelevant = Boolean(
      remote && /legacy|migrat|continue with google|google account/i.test(safeMessage),
    );
    this.oauthLogger('oauth_callback_failure', {
      stage,
      errorType: error instanceof Error ? error.name : typeof error,
      googleHttpStatus: remote?.googleHttpStatus ?? null,
      googleErrorCode: remote?.googleErrorCode ?? null,
      prismaCode,
      safeMessage,
      ...(migrationRelevant ? { accountAction: 'Confirm Fitbit uses Continue with Google.' } : {}),
    });
  }

  async inspectBurnParity(user: DevelopmentUser, localDate: string, timezone: string) {
    if (this.config.APP_ENV !== 'local') {
      throw new AppError('Google Health diagnostics are unavailable.', 404);
    }
    const currentLocalDate = getLocalDateForTimezone(timezone, this.now());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate) || localDate >= currentLocalDate) {
      throw new AppError('Diagnostic date must be a completed local date.', 400);
    }

    const accessToken = await this.accessToken(user.id);
    const response = await this.fetcher(
      `${this.config.GOOGLE_HEALTH_API_BASE_URL}/users/me/dataTypes/total-calories/dataPoints:dailyRollUp`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          range: { start: civilDate(localDate), end: civilDate(nextLocalDate(localDate)) },
          windowSizeDays: 1,
          dataSourceFamily: 'users/me/dataSourceFamilies/all-sources',
        }),
      },
    );
    if (!response.ok) {
      const payload = await parseGoogleResponse(response).catch(() => null);
      const safe = safeGooglePayload(payload);
      throw new GoogleHealthRemoteError(
        response.status === 401
          ? 'Google Health authorization has expired.'
          : 'Google Health is temporarily unavailable.',
        response.status,
        safe.code,
      );
    }
    const payload = GoogleHealthDailyRollupSchema.parse(await parseGoogleResponse(response));
    const point = payload.rollupDataPoints.find((candidate) => {
      const date = candidate.civilStartTime.date;
      return `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}` === localDate;
    });
    const liveApiKcal = point?.totalCalories?.kcalSum ?? null;
    const normalizedKcal = liveApiKcal === null ? null : Math.round(liveApiKcal);
    const date = new Date(`${localDate}T00:00:00.000Z`);
    const [persisted, record] = await Promise.all([
      this.db.dailyExpenditureAggregate.findUnique({
        where: {
          userId_localDate_provider: {
            userId: user.id,
            localDate: date,
            provider: GOOGLE_HEALTH_FITBIT_PROVIDER_ID,
          },
        },
      }),
      this.db.finalizedDailyBankRecord.findUnique({
        where: { userId_logDate: { userId: user.id, logDate: date } },
        include: { calculationSnapshots: { orderBy: { version: 'desc' }, take: 1 } },
      }),
    ]);
    const snapshot = record?.calculationSnapshots[0] ?? null;
    const status = record
      ? getBankContributionStatus(localDate, record.timezone, this.now())
      : null;
    const locksAt = record ? getProvisionalLockAt(localDate, record.timezone) : null;

    return {
      localDate,
      liveApiKcal,
      normalizedKcal,
      persistedAggregate: persisted ? {
        rawKcal: persisted.rawTotalDailyExpenditure,
        adjustedKcal: persisted.adjustedDailyExpenditure,
        providerFetchedAt: (persisted.providerUpdatedAt ?? persisted.importedAt).toISOString(),
        aggregateUpdatedAt: persisted.updatedAt.toISOString(),
      } : null,
      latestSnapshot: snapshot ? {
        rawKcal: snapshot.importedTotalDailyExpenditure,
        adjustedKcal: snapshot.adjustedExpenditure,
        calculatedAt: snapshot.createdAt.toISOString(),
      } : null,
      lifecycle: status && locksAt ? {
        status: status === 'open' ? 'provisional' as const : status,
        locksAt: locksAt.toISOString(),
      } : null,
      parity: {
        apiToNormalized: liveApiKcal === null || normalizedKcal === null
          ? null : normalizedKcal === Math.round(liveApiKcal),
        normalizedToStored: normalizedKcal === null || !persisted
          ? null : normalizedKcal === persisted.rawTotalDailyExpenditure,
        storedToSnapshot: !persisted || !snapshot
          ? null : persisted.rawTotalDailyExpenditure === snapshot.importedTotalDailyExpenditure,
      },
    };
  }

  async createAuthorizationUrl(user: DevelopmentUser, mobileRedirectUri: string) {
    let stage = 'configuration_validation';
    let attemptCreated = false;
    const parsedScheme = (() => {
      try { return new URL(mobileRedirectUri).protocol.replace(/:$/, ''); } catch { return null; }
    })();
    try {
      const secrets = configured(this.config);
      stage = 'mobile_redirect_validation';
      const safeRedirect = safeMobileRedirect(mobileRedirectUri);
      stage = 'oauth_attempt_creation';
      const state = randomBytes(32).toString('base64url');
      const verifier = randomBytes(48).toString('base64url');
      await this.db.user.upsert({
        where: { id: user.id }, update: { email: user.email }, create: { id: user.id, email: user.email },
      });
      await this.db.googleHealthOAuthAttempt.create({
        data: {
          userId: user.id,
          stateHash: hash(state),
          encryptedCodeVerifier: encryptGoogleHealthSecret(verifier, secrets.encryptionKey),
          mobileRedirectUri: safeRedirect,
          expiresAt: new Date(this.now().getTime() + 10 * 60 * 1000),
        },
      });
      attemptCreated = true;
      const url = new URL(this.config.GOOGLE_HEALTH_AUTHORIZATION_URL);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('client_id', secrets.clientId);
      url.searchParams.set('redirect_uri', secrets.redirectUri);
      url.searchParams.set('scope', GOOGLE_HEALTH_ACTIVITY_READ_SCOPE);
      url.searchParams.set('access_type', 'offline');
      url.searchParams.set('prompt', 'consent');
      url.searchParams.set('state', state);
      url.searchParams.set('code_challenge', hash(verifier));
      url.searchParams.set('code_challenge_method', 'S256');
      return url.toString();
    } catch (error) {
      const appError = error instanceof AppError ? error : null;
      const details = appError?.details as { code?: unknown } | undefined;
      const existingConnection = await this.db.googleHealthConnection.findUnique({ where: { userId: user.id } })
        .then((connection) => Boolean(connection))
        .catch(() => null);
      this.oauthLogger('authorization_start_failure', {
        stage,
        httpStatus: appError?.statusCode ?? 500,
        validationErrorCode: typeof details?.code === 'string' ? details.code : 'TEMPORARY_ERROR',
        safeMessage: redactOAuthMessage(error instanceof Error ? error.message : 'Authorization could not start.'),
        internalUserSuffix: user.id.slice(-8),
        mobileRedirectUriPresent: Boolean(mobileRedirectUri),
        parsedScheme,
        providerConfigurationComplete: Boolean(
          this.config.GOOGLE_HEALTH_CLIENT_ID && this.config.GOOGLE_HEALTH_CLIENT_SECRET
          && this.config.GOOGLE_HEALTH_REDIRECT_URI && this.config.GOOGLE_HEALTH_TOKEN_ENCRYPTION_KEY,
        ),
        existingConnection,
        oauthAttemptCreated: attemptCreated,
      });
      throw error;
    }
  }

  private async tokenRequest(body: URLSearchParams): Promise<GoogleTokenResponse> {
    const secrets = configured(this.config);
    body.set('client_id', secrets.clientId);
    body.set('client_secret', secrets.clientSecret);
    const response = await this.fetcher(this.config.GOOGLE_HEALTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const payload = await parseGoogleResponse(response);
    if (!response.ok) {
      const googleError = safeGooglePayload(payload);
      throw new GoogleHealthRemoteError(
        googleError.message ?? 'Google rejected the OAuth token request.',
        response.status,
        googleError.code,
      );
    }
    if (!payload || typeof payload !== 'object') {
      throw new GoogleHealthRemoteError(
        'Google returned an incomplete authorization response.',
        response.status,
        'incomplete_token_response',
      );
    }
    const tokenPayload = payload as Partial<GoogleTokenResponse>;
    if (!tokenPayload.access_token || !tokenPayload.expires_in) {
      throw new GoogleHealthRemoteError(
        'Google returned an incomplete authorization response.',
        response.status,
        'incomplete_token_response',
      );
    }
    return tokenPayload as GoogleTokenResponse;
  }

  private async getIdentity(accessToken: string): Promise<GoogleHealthIdentity> {
    const response = await this.fetcher(`${this.config.GOOGLE_HEALTH_API_BASE_URL}/users/me/identity`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
    const payload = await parseGoogleResponse(response);
    if (!response.ok) {
      const googleError = safeGooglePayload(payload);
      throw new GoogleHealthRemoteError(
        googleError.message ?? 'Google Health identity lookup failed.',
        response.status,
        googleError.code,
      );
    }
    if (!payload || typeof payload !== 'object') {
      throw new GoogleHealthRemoteError(
        'Google Health returned a malformed identity response.',
        response.status,
        'malformed_identity_response',
      );
    }
    const identity = payload as Partial<GoogleHealthIdentity>;
    if (typeof identity.healthUserId !== 'string' || identity.healthUserId.length === 0) {
      throw new GoogleHealthRemoteError(
        'Google Health identity response did not include a health user ID.',
        response.status,
        'missing_health_user_id',
      );
    }
    return {
      healthUserId: identity.healthUserId,
      ...(typeof identity.legacyUserId === 'string' && identity.legacyUserId.length > 0
        ? { legacyUserId: identity.legacyUserId }
        : {}),
    };
  }

  async completeAuthorization(code: string, state: string) {
    let stage = 'configuration_validation';
    try {
      const secrets = configured(this.config);
      stage = 'state_lookup_started';
      this.logOAuthStage(stage);
      const attempt = await this.db.googleHealthOAuthAttempt.findUnique({ where: { stateHash: hash(state) } });
      if (attempt) this.logOAuthStage('state_found');
      if (!attempt || attempt.consumedAt || attempt.expiresAt <= this.now()) {
        throw new AppError('Google authorization state is invalid or expired.', 400);
      }
      stage = 'state_validated';
      this.logOAuthStage(stage);
      const verifier = decryptGoogleHealthSecret(attempt.encryptedCodeVerifier, secrets.encryptionKey);

      stage = 'token_exchange_started';
      this.logOAuthStage(stage, { redirectUriMatchesConfiguredValue: true, pkceVerifierPresent: true });
      const token = await this.tokenRequest(new URLSearchParams({
        grant_type: 'authorization_code', code, redirect_uri: secrets.redirectUri, code_verifier: verifier,
      }));
      this.logOAuthStage('token_exchange_success', {
        refreshTokenPresent: Boolean(token.refresh_token),
      });

      stage = 'identity_lookup_started';
      this.logOAuthStage(stage);
      const identity = await this.getIdentity(token.access_token);
      this.logOAuthStage('identity_lookup_success', {
        healthUserIdPresent: true,
        legacyUserIdPresent: Boolean(identity.legacyUserId),
      });

      const existing = await this.db.googleHealthConnection.findUnique({
        where: { userId: attempt.userId },
      });
      if (!token.refresh_token && !existing) {
        stage = 'refresh_token_validation';
        throw new AppError(
          'Google did not return an offline refresh token. Reconnect with consent enabled.',
          502,
        );
      }
      const refreshTokenExpiresAt = token.refresh_token_expires_in
        ? new Date(this.now().getTime() + token.refresh_token_expires_in * 1000)
        : token.refresh_token
          ? null
          : existing?.refreshTokenExpiresAt ?? null;

      stage = 'token_encryption_started';
      this.logOAuthStage(stage);
      const encryptedAccessToken = encryptGoogleHealthSecret(token.access_token, secrets.encryptionKey);
      const encryptedRefreshToken = token.refresh_token
        ? encryptGoogleHealthSecret(token.refresh_token, secrets.encryptionKey)
        : existing!.encryptedRefreshToken;
      this.logOAuthStage('token_encryption_success');

      stage = 'connection_persist_started';
      this.logOAuthStage(stage);
      await this.db.$transaction([
        this.db.googleHealthConnection.upsert({
          where: { userId: attempt.userId },
          create: {
            userId: attempt.userId,
            encryptedAccessToken,
            encryptedRefreshToken,
            accessTokenExpiresAt: new Date(this.now().getTime() + token.expires_in * 1000),
            refreshTokenExpiresAt,
            healthUserId: identity.healthUserId,
            legacyUserId: identity.legacyUserId ?? null,
            scopes: token.scope?.split(' ').filter(Boolean) ?? [GOOGLE_HEALTH_ACTIVITY_READ_SCOPE],
          },
          update: {
            encryptedAccessToken,
            encryptedRefreshToken,
            accessTokenExpiresAt: new Date(this.now().getTime() + token.expires_in * 1000),
            refreshTokenExpiresAt,
            healthUserId: identity.healthUserId,
            legacyUserId: identity.legacyUserId ?? null,
            scopes: token.scope?.split(' ').filter(Boolean) ?? [GOOGLE_HEALTH_ACTIVITY_READ_SCOPE],
            status: 'connected', lastErrorCode: null, connectedAt: this.now(),
          },
        }),
        this.db.googleHealthOAuthAttempt.update({
          where: { id: attempt.id }, data: { consumedAt: this.now() },
        }),
      ]);
      this.logOAuthStage('connection_persist_success');
      this.logOAuthStage('mobile_redirect_started', { scheme: 'caloriebank' });
      return attempt.mobileRedirectUri;
    } catch (error) {
      this.logOAuthFailure(stage, error);
      throw error;
    }
  }

  private async accessToken(userId: string) {
    const secrets = configured(this.config);
    const connection = await this.db.googleHealthConnection.findUnique({ where: { userId } });
    if (!connection || connection.status !== 'connected') throw new AppError('Fitbit is not connected.', 409);
    if (connection.accessTokenExpiresAt.getTime() > this.now().getTime() + 60_000) {
      return decryptGoogleHealthSecret(connection.encryptedAccessToken, secrets.encryptionKey);
    }
    try {
      const token = await this.tokenRequest(new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: decryptGoogleHealthSecret(connection.encryptedRefreshToken, secrets.encryptionKey),
      }));
      await this.db.googleHealthConnection.update({
        where: { userId },
        data: {
          encryptedAccessToken: encryptGoogleHealthSecret(token.access_token, secrets.encryptionKey),
          ...(token.refresh_token ? {
            encryptedRefreshToken: encryptGoogleHealthSecret(token.refresh_token, secrets.encryptionKey),
          } : {}),
          accessTokenExpiresAt: new Date(this.now().getTime() + token.expires_in * 1000),
          ...(token.refresh_token_expires_in ? {
            refreshTokenExpiresAt: new Date(this.now().getTime() + token.refresh_token_expires_in * 1000),
          } : {}),
          lastRefreshedAt: this.now(), status: 'connected', lastErrorCode: null,
        },
      });
      return token.access_token;
    } catch (error) {
      await this.db.googleHealthConnection.update({ where: { userId }, data: { status: 'needs_reconnect', lastErrorCode: 'token_refresh_failed' } });
      throw error;
    }
  }

  async resolveRestingBurnEstimate(
    user: DevelopmentUser,
    currentLocalDate: string,
    timezone: string,
  ) {
    const [selection, connection] = await Promise.all([
      this.db.providerSelection.findUnique({ where: { userId: user.id } }),
      this.db.googleHealthConnection.findUnique({ where: { userId: user.id } }),
    ]);
    if (
      selection?.authoritativeExpenditureProvider !== GOOGLE_HEALTH_FITBIT_PROVIDER_ID ||
      connection?.status !== 'connected'
    ) return false;

    const existing = await this.db.restingBurnEstimate.findUnique({ where: { userId: user.id } });
    if (
      existing?.provider === GOOGLE_HEALTH_FITBIT_PROVIDER_ID &&
      this.now().getTime() - existing.calculatedAt.getTime() < 7 * 24 * 60 * 60 * 1000
    ) {
      this.oauthLogger('resting_model_resolved', {
        provider: 'fitbit',
        restingKcalPerHour: existing.providerKcalPerHour,
        source: existing.evidenceType,
        qualifyingObservations: existing.observationCount,
        lookbackDays: Math.max(1, Math.round(
          (existing.lookbackEndDate.getTime() - existing.lookbackStartDate.getTime()) / 86_400_000,
        ) + 1),
        cache: 'existing',
      });
      return true;
    }

    const accessToken = await this.accessToken(user.id);
    const request = async (url: string, init: RequestInit) => {
      const response = await this.fetcher(url, {
        ...init,
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', ...init.headers },
      });
      if (response.status === 401) {
        await this.db.googleHealthConnection.update({
          where: { userId: user.id },
          data: { status: 'needs_reconnect', lastErrorCode: 'access_revoked' },
        });
        throw new AppError('Fitbit access needs to be reconnected.', 401);
      }
      const payload = await parseGoogleResponse(response);
      if (!response.ok) {
        const safe = safeGooglePayload(payload);
        throw new GoogleHealthRemoteError(
          safe.message ?? 'Fitbit activity data is temporarily unavailable.',
          response.status,
          safe.code,
        );
      }
      return payload;
    };

    const attemptedWindows: number[] = [];
    const observations: Array<{
      calories: number;
      steps: number;
      overlapsWorkout: boolean;
      observedAt: Date;
    }> = [];
    const exercises: Array<{ start: Date; end: Date }> = [];
    const lookbackWindows: Array<{ days: number; observations: typeof observations }> = [];
    let coveredDays = 0;
    let hourlyCaloriesAvailable = false;
    let hourlyStepsAvailable = false;
    let qualifyingRestHours = 0;

    for (const targetDays of [14, 30, 90]) {
      while (coveredDays < targetDays) {
        const chunkDays = Math.min(14, targetDays - coveredDays);
        const chunkEndDate = previousLocalDate(currentLocalDate, coveredDays);
        const chunkStartDate = previousLocalDate(chunkEndDate, chunkDays);
        const bounds = {
          start: getLocalDateUtcBounds(chunkStartDate, timezone).start,
          end: getLocalDateUtcBounds(chunkEndDate, timezone).start,
        };
        const rollup = async (dataType: 'total-calories' | 'steps') => {
          const response = await request(
            `${this.config.GOOGLE_HEALTH_API_BASE_URL}/users/me/dataTypes/${dataType}/dataPoints:rollUp`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                range: { startTime: bounds.start.toISOString(), endTime: bounds.end.toISOString() },
                windowSize: '3600s',
                dataSourceFamily: 'users/me/dataSourceFamilies/all-sources',
              }),
            },
          );
          return GoogleHealthHourlyRollupSchema.parse(response).rollupDataPoints;
        };
        const fetchExercises = async () => {
          const dataPoints: unknown[] = [];
          let pageToken: string | undefined;
          do {
            const url = new URL(`${this.config.GOOGLE_HEALTH_API_BASE_URL}/users/me/dataTypes/exercise/dataPoints`);
            url.searchParams.set('filter', `exercise.interval.civil_start_time >= "${chunkStartDate}" AND exercise.interval.civil_start_time < "${chunkEndDate}"`);
            url.searchParams.set('pageSize', '25');
            if (pageToken) url.searchParams.set('pageToken', pageToken);
            const payload = await request(url.toString(), { method: 'GET' }) as {
              dataPoints?: unknown[];
              nextPageToken?: string;
            };
            dataPoints.push(...(payload.dataPoints ?? []));
            pageToken = payload.nextPageToken;
          } while (pageToken);
          return dataPoints;
        };
        const [calories, steps, exercisePayload] = await Promise.all([
          rollup('total-calories'),
          rollup('steps'),
          fetchExercises(),
        ]);
        hourlyCaloriesAvailable ||= calories.some((point) => Boolean(point.totalCalories));
        hourlyStepsAvailable ||= steps.length > 0;
        for (const point of exercisePayload as Array<{
          exercise?: { interval?: { startTime?: string; endTime?: string } };
        }>) {
          const start = point.exercise?.interval?.startTime;
          const end = point.exercise?.interval?.endTime;
          if (start && end) exercises.push({ start: new Date(start), end: new Date(end) });
        }
        const stepsByStart = new Map(steps.map((point) => [
          new Date(point.startTime).getTime(),
          point.steps?.countSum ?? 0,
        ]));
        for (const point of calories) {
          if (!point.totalCalories) continue;
          const stepCount = stepsByStart.get(new Date(point.startTime).getTime());
          if (stepCount === undefined) continue;
          const start = new Date(point.startTime);
          const end = new Date(point.endTime);
          observations.push({
            calories: point.totalCalories.kcalSum,
            steps: stepCount,
            overlapsWorkout: exercises.some((workout) => workout.start < end && workout.end > start),
            observedAt: start,
          });
        }
        coveredDays += chunkDays;
      }
      attemptedWindows.push(targetDays);
      lookbackWindows.push({ days: targetDays, observations: [...observations] });
      const currentEstimate = estimateRestingBurnFromLowActivityHours(observations);
      qualifyingRestHours = currentEstimate?.observationCount ?? 0;
      const estimate = selectRestingBurnLookback(lookbackWindows);
      if (estimate) {
        await this.todayRepository.upsertRestingBurnEstimate?.(user, {
          provider: GOOGLE_HEALTH_FITBIT_PROVIDER_ID,
          providerKcalPerHour: estimate.providerKcalPerHour,
          evidenceType: 'historical_low_activity_hours',
          observationCount: estimate.observationCount,
          lookbackStartDate: getLocalDateForTimezone(timezone, estimate.lookbackStartDate),
          lookbackEndDate: getLocalDateForTimezone(timezone, estimate.lookbackEndDate),
          calculatedAt: this.now(),
        });
        this.oauthLogger('resting_model_resolved', {
          provider: 'fitbit',
          restingKcalPerHour: estimate.providerKcalPerHour,
          source: 'historical_hourly_low_activity',
          qualifyingObservations: estimate.observationCount,
          lookbackDays: estimate.lookbackDays,
          cache: 'derived',
        });
        return true;
      }
    }

    this.oauthLogger('resting_burn_estimate_failed', {
      provider: 'fitbit',
      attemptedWindows,
      explicitRestingEnergyAvailable: false,
      hourlyCaloriesAvailable,
      hourlyStepsAvailable,
      qualifyingRestHours,
      rejectionReason: hourlyCaloriesAvailable && hourlyStepsAvailable
        ? 'fewer_than_three_qualifying_low_activity_hours'
        : !hourlyCaloriesAvailable
          ? 'no_hourly_total_calories'
          : 'no_hourly_steps',
    });
    return false;
  }

  async syncRollingWindow(user: DevelopmentUser, currentLocalDate: string, timezone: string, force = false, dayCount = 3, trigger: OrchestrationTrigger = 'manual_refresh') {
    const datesRequested = Array.from({ length: dayCount }, (_, days) => previousLocalDate(currentLocalDate, days));
    const connection = await this.db.googleHealthConnection.findUnique({ where: { userId: user.id } });
    if (!force && connection?.lastSyncedAt && this.now().getTime() - connection.lastSyncedAt.getTime() < 5 * 60 * 1000) {
      return { datesRequested, datesUpdated: [], datesSkipped: datesRequested };
    }
    const accessToken = await this.accessToken(user.id);
    const session = await this.db.ingestionSyncSession.create({
      data: {
        userId: user.id, localDate: new Date(`${currentLocalDate}T00:00:00.000Z`), timezone,
        provider: GOOGLE_HEALTH_FITBIT_PROVIDER_ID, trigger, startedAt: this.now(), datesQueried: datesRequested,
        expenditureStatus: 'not_attempted', intakeStatus: 'skipped', stepsStatus: 'not_attempted', workoutsStatus: 'not_attempted',
      },
    });
    const request = async (url: string, init: RequestInit) => {
      const response = await this.fetcher(url, {
        ...init,
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', ...init.headers },
      });
      if (response.status === 401) {
        await this.db.googleHealthConnection.update({
          where: { userId: user.id },
          data: { status: 'needs_reconnect', lastErrorCode: 'access_revoked' },
        });
        throw new AppError('Fitbit access needs to be reconnected.', 401);
      }
      if (!response.ok) throw new AppError('Fitbit activity data is temporarily unavailable.', 502);
      return response.json();
    };
    const dailyRollup = (dataType: 'total-calories' | 'steps', date: string) => request(
      `${this.config.GOOGLE_HEALTH_API_BASE_URL}/users/me/dataTypes/${dataType}/dataPoints:dailyRollUp`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          range: { start: civilDate(date), end: civilDate(nextLocalDate(date)) },
          windowSizeDays: 1,
          dataSourceFamily: 'users/me/dataSourceFamilies/all-sources',
        }),
      },
    );
    const expenditureTransport: GoogleHealthTotalCaloriesTransport = {
      fetchDailyTotalCalories: (date) => dailyRollup('total-calories', date),
    };
    const stepTransport: GoogleHealthStepsTransport = {
      fetchDailySteps: (date) => dailyRollup('steps', date),
    };
    const exerciseTransport: GoogleHealthExerciseTransport = {
      fetchDailyExercises: async (date) => {
        const dataPoints: unknown[] = [];
        let pageToken: string | undefined;
        do {
          const url = new URL(`${this.config.GOOGLE_HEALTH_API_BASE_URL}/users/me/dataTypes/exercise/dataPoints`);
          url.searchParams.set('filter', `exercise.interval.civil_start_time >= "${date}" AND exercise.interval.civil_start_time < "${nextLocalDate(date)}"`);
          url.searchParams.set('pageSize', '25');
          if (pageToken) url.searchParams.set('pageToken', pageToken);
          const payload = await request(url.toString(), { method: 'GET' }) as {
            dataPoints?: unknown[];
            nextPageToken?: string;
          };
          dataPoints.push(...(payload.dataPoints ?? []));
          pageToken = payload.nextPageToken;
        } while (pageToken);
        return { dataPoints };
      },
    };
    const expenditureProvider = new GoogleHealthFitbitExpenditureProvider(expenditureTransport, this.now);
    const stepProvider = new GoogleHealthFitbitStepProvider(stepTransport, this.now);
    const workoutProvider = new GoogleHealthFitbitWorkoutProvider(exerciseTransport, this.now);
    const refreshRestingBurnEstimate = async () => {
      const attemptedWindows: number[] = [];
      const observations: Array<{
        calories: number;
        steps: number;
        overlapsWorkout: boolean;
        observedAt: Date;
      }> = [];
      const exercises: Array<{ start: Date; end: Date }> = [];
      const lookbackWindows: Array<{
        days: number;
        observations: typeof observations;
      }> = [];
      let coveredDays = 0;
      let hourlyCaloriesAvailable = false;
      let hourlyStepsAvailable = false;
      let qualifyingRestHours = 0;
      for (const targetDays of [14, 30, 90]) {
        while (coveredDays < targetDays) {
          const chunkDays = Math.min(14, targetDays - coveredDays);
          const chunkEndDate = previousLocalDate(currentLocalDate, coveredDays);
          const chunkStartDate = previousLocalDate(chunkEndDate, chunkDays);
          const bounds = {
            start: getLocalDateUtcBounds(chunkStartDate, timezone).start,
            end: getLocalDateUtcBounds(chunkEndDate, timezone).start,
          };
          const rollup = async (dataType: 'total-calories' | 'steps') => {
            const response = await request(
              `${this.config.GOOGLE_HEALTH_API_BASE_URL}/users/me/dataTypes/${dataType}/dataPoints:rollUp`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  range: { startTime: bounds.start.toISOString(), endTime: bounds.end.toISOString() },
                  windowSize: '3600s',
                  dataSourceFamily: 'users/me/dataSourceFamilies/all-sources',
                }),
              },
            );
            return GoogleHealthHourlyRollupSchema.parse(response).rollupDataPoints;
          };
          const fetchExercises = async () => {
            const dataPoints: unknown[] = [];
            let pageToken: string | undefined;
            do {
              const url = new URL(`${this.config.GOOGLE_HEALTH_API_BASE_URL}/users/me/dataTypes/exercise/dataPoints`);
              url.searchParams.set('filter', `exercise.interval.civil_start_time >= "${chunkStartDate}" AND exercise.interval.civil_start_time < "${chunkEndDate}"`);
              url.searchParams.set('pageSize', '25');
              if (pageToken) url.searchParams.set('pageToken', pageToken);
              const payload = await request(url.toString(), { method: 'GET' }) as {
                dataPoints?: unknown[];
                nextPageToken?: string;
              };
              dataPoints.push(...(payload.dataPoints ?? []));
              pageToken = payload.nextPageToken;
            } while (pageToken);
            return { dataPoints };
          };
          const [calories, steps, exercisePayload] = await Promise.all([
            rollup('total-calories'),
            rollup('steps'),
            fetchExercises(),
          ]);
          hourlyCaloriesAvailable ||= calories.some((point) => Boolean(point.totalCalories));
          hourlyStepsAvailable ||= steps.length > 0;
          const parsedExercises = (exercisePayload as { dataPoints?: Array<{ exercise?: { interval?: { startTime?: string; endTime?: string } } }> }).dataPoints ?? [];
          for (const point of parsedExercises) {
            const start = point.exercise?.interval?.startTime;
            const end = point.exercise?.interval?.endTime;
            if (start && end) exercises.push({ start: new Date(start), end: new Date(end) });
          }
          const stepsByStart = new Map(steps.map((point) => [
            new Date(point.startTime).getTime(),
            point.steps?.countSum ?? 0,
          ]));
          for (const point of calories) {
            if (!point.totalCalories) continue;
            const stepCount = stepsByStart.get(new Date(point.startTime).getTime());
            if (stepCount === undefined) continue;
            const start = new Date(point.startTime);
            const end = new Date(point.endTime);
            observations.push({
              calories: point.totalCalories.kcalSum,
              steps: stepCount,
              overlapsWorkout: exercises.some((workout) => workout.start < end && workout.end > start),
              observedAt: start,
            });
          }
          coveredDays += chunkDays;
        }
        attemptedWindows.push(targetDays);
        lookbackWindows.push({ days: targetDays, observations: [...observations] });
        const currentEstimate = estimateRestingBurnFromLowActivityHours(observations);
        qualifyingRestHours = currentEstimate?.observationCount ?? 0;
        const estimate = selectRestingBurnLookback(lookbackWindows);
        if (estimate) {
          await this.todayRepository.upsertRestingBurnEstimate?.(user, {
            provider: GOOGLE_HEALTH_FITBIT_PROVIDER_ID,
            providerKcalPerHour: estimate.providerKcalPerHour,
            evidenceType: 'historical_low_activity_hours',
            observationCount: estimate.observationCount,
            lookbackStartDate: getLocalDateForTimezone(timezone, estimate.lookbackStartDate),
            lookbackEndDate: getLocalDateForTimezone(timezone, estimate.lookbackEndDate),
            calculatedAt: this.now(),
          });
          return;
        }
      }
      this.oauthLogger('resting_burn_estimate_failed', {
        provider: 'fitbit',
        attemptedWindows,
        explicitRestingEnergyAvailable: false,
        hourlyCaloriesAvailable,
        hourlyStepsAvailable,
        qualifyingRestHours,
        rejectionReason: hourlyCaloriesAvailable && hourlyStepsAvailable
          ? 'fewer_than_three_qualifying_low_activity_hours'
          : !hourlyCaloriesAvailable
            ? 'no_hourly_total_calories'
            : 'no_hourly_steps',
      });
    };
    const existingRestingModel = await this.db.restingBurnEstimate.findUnique({
      where: { userId: user.id },
    });
    if (
      !existingRestingModel ||
      existingRestingModel.provider !== GOOGLE_HEALTH_FITBIT_PROVIDER_ID ||
      this.now().getTime() - existingRestingModel.calculatedAt.getTime() >= 7 * 24 * 60 * 60 * 1000
    ) {
      await refreshRestingBurnEstimate().catch((error) => {
        this.oauthLogger('resting_burn_estimate_failed', {
          provider: 'fitbit',
          attemptedWindows: [14, 30, 90],
          explicitRestingEnergyAvailable: false,
          hourlyCaloriesAvailable: false,
          hourlyStepsAvailable: false,
          qualifyingRestHours: 0,
          rejectionReason: error instanceof GoogleHealthRemoteError
            ? error.googleErrorCode ?? 'google_health_request_failed'
            : 'unexpected_calibration_error',
          errorType: error instanceof Error ? error.name : typeof error,
        });
      });
    }
    const updatedDates = new Set<string>();
    const historicalWorkoutDatesUpdated = new Set<string>();
    const historicalWorkoutDatesQueried: string[] = [];
    const categoryResults: SafeCategoryResult[] = [];
    let recordsImported = 0;
    let recordsUpdated = 0;
    let recordsSkipped = 0;
    const successfulQueries: Record<SyncCategory, number> = { expenditure: 0, steps: 0, workouts: 0 };
    const failedQueries: Record<SyncCategory, number> = { expenditure: 0, steps: 0, workouts: 0 };
    try {
      for (const localDate of datesRequested) {
        const input = { userId: user.id, localDate, timezone, isCurrentDay: localDate === currentLocalDate };
        for (const category of ['expenditure', 'steps', 'workouts'] as const) {
          try {
            if (category === 'expenditure') {
              const aggregate = await expenditureProvider.fetchDailyExpenditureAggregate(input);
              successfulQueries.expenditure += 1;
              if (!aggregate) {
                categoryResults.push({ provider: GOOGLE_HEALTH_FITBIT_PROVIDER_ID, category, localDate, queryResult: 'empty', uploadResult: 'not_applicable' });
                recordsSkipped += 1;
                continue;
              }
              aggregate.syncSessionId = session.id;
              const result = await this.todayRepository.upsertExpenditureAggregate(user, aggregate);
              categoryResults.push({ provider: GOOGLE_HEALTH_FITBIT_PROVIDER_ID, category, localDate, queryResult: 'ready', uploadResult: result });
              if (result === 'created') recordsImported += 1;
              else if (result === 'updated') recordsUpdated += 1;
              else recordsSkipped += 1;
              if (result === 'created' || result === 'updated') updatedDates.add(localDate);
              continue;
            }
            if (category === 'steps') {
              const aggregate = await stepProvider.fetchDailyStepAggregate(input);
              successfulQueries.steps += 1;
              if (!aggregate) {
                categoryResults.push({ provider: GOOGLE_HEALTH_FITBIT_PROVIDER_ID, category, localDate, queryResult: 'empty', uploadResult: 'not_applicable' });
                recordsSkipped += 1;
                continue;
              }
              aggregate.syncSessionId = session.id;
              const result = await this.todayRepository.upsertStepAggregate(user, aggregate);
              categoryResults.push({ provider: GOOGLE_HEALTH_FITBIT_PROVIDER_ID, category, localDate, queryResult: 'ready', uploadResult: result });
              if (result === 'created') recordsImported += 1;
              else if (result === 'updated') recordsUpdated += 1;
              else recordsSkipped += 1;
              if (result === 'created' || result === 'updated') updatedDates.add(localDate);
              continue;
            }
            const fetchedAt = this.now();
            const workouts = (await workoutProvider.fetchDailyWorkouts(input)).map((workout) => ({
              ...workout, syncSessionId: session.id,
            }));
            successfulQueries.workouts += 1;
            const results = await this.todayRepository.upsertWorkouts(user, workouts);
            const deleted = await this.todayRepository.deleteMissingWorkoutsForDay?.(
              user.id, localDate, GOOGLE_HEALTH_FITBIT_PROVIDER_ID,
              workouts.map((workout) => workout.providerWorkoutId), fetchedAt,
            ) ?? 0;
            const created = results.filter((result) => result === 'created').length;
            const updated = results.filter((result) => result === 'updated').length;
            recordsImported += created;
            recordsUpdated += updated + deleted;
            recordsSkipped += results.length - created - updated;
            if (created + updated + deleted > 0) updatedDates.add(localDate);
            categoryResults.push({
              provider: GOOGLE_HEALTH_FITBIT_PROVIDER_ID, category, localDate,
              queryResult: workouts.length > 0 ? 'ready' : 'empty',
              uploadResult: created > 0 ? 'created' : updated + deleted > 0 ? 'updated' : 'unchanged',
            });
          } catch (error) {
            if (error instanceof AppError && error.statusCode === 401) throw error;
            failedQueries[category] += 1;
            categoryResults.push({
              provider: GOOGLE_HEALTH_FITBIT_PROVIDER_ID, category, localDate,
              queryResult: 'error', uploadResult: 'error',
              errorCode: `google_health_${category}_query_failed`,
            });
          }
        }
      }
      let calibrationWorkoutCount = await this.db.currentDayWorkout.count({
        where: {
          userId: user.id,
          provider: GOOGLE_HEALTH_FITBIT_PROVIDER_ID,
          activityType: { in: ['walking', 'running'] },
          endedAt: { lte: this.now() },
          totalSteps: { gt: 0 },
          totalEnergyBurned: { gt: 0 },
          localDate: {
            gte: new Date(`${previousLocalDate(currentLocalDate, STEP_ESTIMATION_LOOKBACK_DAYS)}T00:00:00.000Z`),
            lt: new Date(`${currentLocalDate}T00:00:00.000Z`),
          },
          syncStatus: 'ready',
        },
      });
      for (
        let offset = datesRequested.length;
        offset <= STEP_ESTIMATION_LOOKBACK_DAYS &&
          calibrationWorkoutCount < MAXIMUM_CALIBRATION_WORKOUTS;
        offset += 1
      ) {
        const localDate = previousLocalDate(currentLocalDate, offset);
        historicalWorkoutDatesQueried.push(localDate);
        try {
          const fetchedAt = this.now();
          const workouts = (await workoutProvider.fetchDailyWorkouts({
            userId: user.id,
            localDate,
            timezone,
            isCurrentDay: false,
          })).map((workout) => ({ ...workout, syncSessionId: session.id }));
          successfulQueries.workouts += 1;
          const results = await this.todayRepository.upsertWorkouts(user, workouts);
          const deleted = await this.todayRepository.deleteMissingWorkoutsForDay?.(
            user.id,
            localDate,
            GOOGLE_HEALTH_FITBIT_PROVIDER_ID,
            workouts.map((workout) => workout.providerWorkoutId),
            fetchedAt,
          ) ?? 0;
          const created = results.filter((result) => result === 'created').length;
          const updated = results.filter((result) => result === 'updated').length;
          recordsImported += created;
          recordsUpdated += updated + deleted;
          recordsSkipped += results.length - created - updated;
          if (created + updated + deleted > 0) historicalWorkoutDatesUpdated.add(localDate);
          calibrationWorkoutCount += workouts.filter(
            (workout) =>
              (workout.activityType === 'walking' || workout.activityType === 'running') &&
              (workout.totalSteps ?? 0) > 0 &&
              (workout.totalEnergyBurned ?? 0) > 0,
          ).length;
          categoryResults.push({
            provider: GOOGLE_HEALTH_FITBIT_PROVIDER_ID,
            category: 'workouts',
            localDate,
            queryResult: workouts.length > 0 ? 'ready' : 'empty',
            uploadResult: created > 0 ? 'created' : updated + deleted > 0 ? 'updated' : 'unchanged',
          });
        } catch (error) {
          if (error instanceof AppError && error.statusCode === 401) throw error;
          failedQueries.workouts += 1;
          categoryResults.push({
            provider: GOOGLE_HEALTH_FITBIT_PROVIDER_ID,
            category: 'workouts',
            localDate,
            queryResult: 'error',
            uploadResult: 'error',
            errorCode: 'google_health_workouts_query_failed',
          });
        }
      }
      await this.db.$transaction([
        this.db.googleHealthConnection.update({ where: { userId: user.id }, data: { lastSyncedAt: this.now(), lastErrorCode: null } }),
        this.db.ingestionSyncSession.update({
          where: { id: session.id },
          data: {
            status: Object.values(failedQueries).some((count) => count > 0) ? 'partially_completed' : 'completed',
            completedAt: this.now(),
            expenditureStatus: failedQueries.expenditure > 0 ? 'error' : successfulQueries.expenditure > 0 ? 'ready' : 'unavailable',
            stepsStatus: failedQueries.steps > 0 ? 'error' : successfulQueries.steps > 0 ? 'ready' : 'unavailable',
            workoutsStatus: failedQueries.workouts > 0 ? 'error' : successfulQueries.workouts > 0 ? 'ready' : 'unavailable',
            datesQueried: [...datesRequested, ...historicalWorkoutDatesQueried],
            datesUploaded: [...updatedDates, ...historicalWorkoutDatesUpdated],
            datesSkipped: datesRequested.filter((date) => !updatedDates.has(date)),
            recordsImported, recordsUpdated, recordsSkipped,
            warningCount: Object.values(failedQueries).reduce((sum, count) => sum + count, 0),
            categoryResults,
          },
        }),
      ]);
      const orchestration = await this.finalizationScheduler?.execute({
        user, currentLocalDate, timezone, dates: datesRequested,
        trigger, syncSessionId: session.id,
      });
      if (orchestration) {
        await this.db.ingestionSyncSession.update({
          where: { id: session.id },
          data: {
            datesReconciled: orchestration.datesReconciled,
            datesLocked: orchestration.datesLocked,
            waitingDates: orchestration.waitingDates,
          },
        });
      }
      return {
        datesRequested,
        datesUpdated: [...updatedDates],
        datesSkipped: datesRequested.filter((date) => !updatedDates.has(date)),
        retryableFailure: failedQueries.expenditure > 0,
      };
    } catch (error) {
      await this.db.ingestionSyncSession.update({
        where: { id: session.id }, data: {
          status: 'failed',
          completedAt: this.now(),
          expenditureStatus: 'error',
          stepsStatus: 'error',
          workoutsStatus: 'error',
          categoryResults,
          errorCode: 'google_health_sync_failed',
        },
      });
      throw error;
    }
  }

  async disconnect(user: DevelopmentUser) {
    const selection = await this.db.providerSelection.findUnique({ where: { userId: user.id } });
    if (
      selection?.authoritativeExpenditureProvider === GOOGLE_HEALTH_FITBIT_PROVIDER_ID
      || selection?.authoritativeActivityProvider === GOOGLE_HEALTH_FITBIT_PROVIDER_ID
    ) {
      throw new AppError(
        'Choose another calories burned source before disconnecting Fitbit.',
        409,
        { code: 'SELECTED_SOURCE_MUST_CHANGE_FIRST', role: 'burned' },
      );
    }
    const secrets = configured(this.config);
    const connection = await this.db.googleHealthConnection.findUnique({ where: { userId: user.id } });
    if (connection) {
      const token = decryptGoogleHealthSecret(connection.encryptedRefreshToken, secrets.encryptionKey);
      await this.fetcher(this.config.GOOGLE_HEALTH_REVOKE_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }),
      }).catch(() => undefined);
    }
    await this.db.googleHealthConnection.deleteMany({ where: { userId: user.id } });
  }

  async revokeForAccountDeletion(user: DevelopmentUser) {
    const connection = await this.db.googleHealthConnection.findUnique({ where: { userId: user.id } });
    if (!connection) return;
    const secrets = configured(this.config);
    const token = decryptGoogleHealthSecret(connection.encryptedRefreshToken, secrets.encryptionKey);
    let response: Response;
    try {
      response = await this.fetcher(this.config.GOOGLE_HEALTH_REVOKE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }),
      });
    } catch {
      throw new AppError('Fitbit access could not be revoked. Try deleting your account again.', 502, {
        code: 'PROVIDER_REVOCATION_FAILED', provider: 'google_health_fitbit',
      });
    }
    if (!response.ok) {
      throw new AppError('Fitbit access could not be revoked. Try deleting your account again.', 502, {
        code: 'PROVIDER_REVOCATION_FAILED', provider: 'google_health_fitbit',
      });
    }
    await this.db.$transaction([
      this.db.googleHealthConnection.deleteMany({ where: { userId: user.id } }),
      this.db.googleHealthOAuthAttempt.deleteMany({ where: { userId: user.id } }),
    ]);
  }
}
