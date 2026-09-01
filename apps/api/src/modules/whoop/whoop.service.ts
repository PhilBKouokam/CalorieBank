import { createHash, randomBytes } from 'node:crypto';
import { getLocalDateUtcBounds } from '@caloriebank/domain';
import { Prisma, type PrismaClient } from '@prisma/client';

import type { ApiEnv } from '../../env';
import { AppError } from '../../errors';
import type { DevelopmentUser } from '../goal-configuration/goal-configuration.repository';
import {
  decryptProviderSecret,
  encryptProviderSecret,
  validateProviderTokenEncryptionKey,
} from '../provider-oauth/token-crypto';
import type { TodayAggregateRepository } from '../today/today.repository';
import { WHOOP_PROVIDER_ID, WhoopWorkoutProvider } from './whoop.provider';

const WHOOP_SCOPES = ['read:workout', 'offline'] as const;

type WhoopTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  refresh_token_expires_in?: number;
  scope?: string;
};

function configured(config: ApiEnv) {
  if (!config.WHOOP_CLIENT_ID || !config.WHOOP_CLIENT_SECRET || !config.WHOOP_REDIRECT_URI || !config.WHOOP_TOKEN_ENCRYPTION_KEY) {
    throw new AppError('WHOOP is not configured for this environment.', 503);
  }
  validateProviderTokenEncryptionKey(config.WHOOP_TOKEN_ENCRYPTION_KEY);
  return {
    clientId: config.WHOOP_CLIENT_ID,
    clientSecret: config.WHOOP_CLIENT_SECRET,
    redirectUri: config.WHOOP_REDIRECT_URI,
    encryptionKey: config.WHOOP_TOKEN_ENCRYPTION_KEY,
  };
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('base64url');
}

function safeMobileRedirect(value: string) {
  if (!/^caloriebank:\/\/integrations(?:\?.*)?$/.test(value)) {
    throw new AppError('Mobile redirect URI is invalid.', 400);
  }
  return value;
}

function previousLocalDate(localDate: string, days: number) {
  const value = new Date(`${localDate}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

async function responsePayload(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text) as unknown; } catch { return null; }
}

export class WhoopService {
  constructor(
    private readonly db: PrismaClient,
    private readonly todayRepository: TodayAggregateRepository,
    private readonly config: ApiEnv,
    private readonly fetcher: typeof fetch = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async createAuthorizationUrl(user: DevelopmentUser, mobileRedirectUri: string) {
    const secrets = configured(this.config);
    // WHOOP currently documents an eight-character state value.
    const state = randomBytes(6).toString('base64url');
    await this.db.user.upsert({
      where: { id: user.id },
      update: { email: user.email },
      create: { id: user.id, email: user.email },
    });
    await this.db.externalProviderOAuthAttempt.create({
      data: {
        userId: user.id,
        provider: WHOOP_PROVIDER_ID,
        stateHash: hash(state),
        mobileRedirectUri: safeMobileRedirect(mobileRedirectUri),
        expiresAt: new Date(this.now().getTime() + 10 * 60 * 1000),
      },
    });
    const url = new URL(this.config.WHOOP_AUTHORIZATION_URL);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', secrets.clientId);
    url.searchParams.set('redirect_uri', secrets.redirectUri);
    url.searchParams.set('scope', WHOOP_SCOPES.join(' '));
    url.searchParams.set('state', state);
    return url.toString();
  }

  private async tokenRequest(body: URLSearchParams) {
    const secrets = configured(this.config);
    body.set('client_id', secrets.clientId);
    body.set('client_secret', secrets.clientSecret);
    const response = await this.fetcher(this.config.WHOOP_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const payload = await responsePayload(response);
    if (!response.ok) throw new AppError('WHOOP authorization could not be completed.', 502);
    if (!payload || typeof payload !== 'object') throw new AppError('WHOOP returned an incomplete token response.', 502);
    const token = payload as Partial<WhoopTokenResponse>;
    if (!token.access_token || !token.expires_in) throw new AppError('WHOOP returned an incomplete token response.', 502);
    return token as WhoopTokenResponse;
  }

  async completeAuthorization(code: string, state: string) {
    const secrets = configured(this.config);
    const attempt = await this.db.externalProviderOAuthAttempt.findUnique({
      where: { stateHash: hash(state) },
    });
    if (!attempt || attempt.provider !== WHOOP_PROVIDER_ID || attempt.consumedAt || attempt.expiresAt <= this.now()) {
      throw new AppError('WHOOP authorization state is invalid or expired.', 400);
    }
    const token = await this.tokenRequest(new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: secrets.redirectUri,
    }));
    const existing = await this.db.externalProviderConnection.findUnique({
      where: { userId_provider: { userId: attempt.userId, provider: WHOOP_PROVIDER_ID } },
    });
    if (!token.refresh_token && !existing) {
      throw new AppError('WHOOP did not return an offline refresh token.', 502);
    }
    const encryptedAccessToken = encryptProviderSecret(token.access_token, secrets.encryptionKey);
    const encryptedRefreshToken = token.refresh_token
      ? encryptProviderSecret(token.refresh_token, secrets.encryptionKey)
      : existing!.encryptedRefreshToken;
    await this.db.$transaction([
      this.db.externalProviderConnection.upsert({
        where: { userId_provider: { userId: attempt.userId, provider: WHOOP_PROVIDER_ID } },
        create: {
          userId: attempt.userId,
          provider: WHOOP_PROVIDER_ID,
          encryptedAccessToken,
          encryptedRefreshToken,
          accessTokenExpiresAt: new Date(this.now().getTime() + token.expires_in * 1000),
          refreshTokenExpiresAt: token.refresh_token_expires_in
            ? new Date(this.now().getTime() + token.refresh_token_expires_in * 1000)
            : null,
          scopes: token.scope?.split(' ').filter(Boolean) ?? [...WHOOP_SCOPES],
        },
        update: {
          encryptedAccessToken,
          encryptedRefreshToken,
          accessTokenExpiresAt: new Date(this.now().getTime() + token.expires_in * 1000),
          ...(token.refresh_token_expires_in ? {
            refreshTokenExpiresAt: new Date(this.now().getTime() + token.refresh_token_expires_in * 1000),
          } : {}),
          scopes: token.scope?.split(' ').filter(Boolean) ?? [...WHOOP_SCOPES],
          status: 'connected',
          lastErrorCode: null,
          connectedAt: this.now(),
        },
      }),
      this.db.externalProviderOAuthAttempt.update({
        where: { id: attempt.id },
        data: { consumedAt: this.now() },
      }),
    ]);
    return attempt.mobileRedirectUri;
  }

  private async accessToken(userId: string) {
    const secrets = configured(this.config);
    const connection = await this.db.externalProviderConnection.findUnique({
      where: { userId_provider: { userId, provider: WHOOP_PROVIDER_ID } },
    });
    if (
      !connection ||
      connection.status !== 'connected' ||
      !connection.accessTokenExpiresAt ||
      !connection.encryptedRefreshToken
    ) throw new AppError('WHOOP is not connected.', 409);
    if (connection.accessTokenExpiresAt.getTime() > this.now().getTime() + 60_000) {
      return decryptProviderSecret(connection.encryptedAccessToken, secrets.encryptionKey);
    }
    try {
      const token = await this.tokenRequest(new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: decryptProviderSecret(connection.encryptedRefreshToken, secrets.encryptionKey),
      }));
      await this.db.externalProviderConnection.update({
        where: { id: connection.id },
        data: {
          encryptedAccessToken: encryptProviderSecret(token.access_token, secrets.encryptionKey),
          ...(token.refresh_token ? {
            encryptedRefreshToken: encryptProviderSecret(token.refresh_token, secrets.encryptionKey),
          } : {}),
          accessTokenExpiresAt: new Date(this.now().getTime() + token.expires_in * 1000),
          lastRefreshedAt: this.now(),
          lastErrorCode: null,
        },
      });
      return token.access_token;
    } catch (error) {
      await this.db.externalProviderConnection.update({
        where: { id: connection.id },
        data: { status: 'needs_reconnect', lastErrorCode: 'token_refresh_failed' },
      });
      throw error;
    }
  }

  async syncRollingWindow(user: DevelopmentUser, currentLocalDate: string, timezone: string, force = false) {
    const datesRequested = [0, 1, 2].map((days) => previousLocalDate(currentLocalDate, days));
    const connection = await this.db.externalProviderConnection.findUnique({
      where: { userId_provider: { userId: user.id, provider: WHOOP_PROVIDER_ID } },
    });
    if (!force && connection?.lastSyncedAt && this.now().getTime() - connection.lastSyncedAt.getTime() < 5 * 60 * 1000) {
      return { datesRequested, datesUpdated: [], datesSkipped: datesRequested };
    }
    const accessToken = await this.accessToken(user.id);
    const session = await this.db.ingestionSyncSession.create({
      data: {
        userId: user.id,
        provider: WHOOP_PROVIDER_ID,
        localDate: new Date(`${currentLocalDate}T00:00:00.000Z`),
        timezone,
        trigger: 'manual_refresh',
        startedAt: this.now(),
        datesQueried: datesRequested,
        expenditureStatus: 'skipped',
        intakeStatus: 'skipped',
        stepsStatus: 'skipped',
        workoutsStatus: 'not_attempted',
      },
    });
    const provider = new WhoopWorkoutProvider({
      fetchDailyWorkouts: async (start, end, nextToken) => {
        const url = new URL(`${this.config.WHOOP_API_BASE_URL}/activity/workout`);
        url.searchParams.set('start', start.toISOString());
        url.searchParams.set('end', end.toISOString());
        url.searchParams.set('limit', '25');
        if (nextToken) url.searchParams.set('nextToken', nextToken);
        const response = await this.fetcher(url, {
          headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
        });
        if (response.status === 401) throw new AppError('WHOOP access needs to be reconnected.', 401);
        if (!response.ok) throw new AppError('WHOOP workout data is temporarily unavailable.', 502);
        return response.json();
      },
    }, (input) => getLocalDateUtcBounds(input.localDate, input.timezone), this.now);
    const datesUpdated: string[] = [];
    const categoryResults: Prisma.InputJsonObject[] = [];
    let recordsImported = 0;
    let recordsUpdated = 0;
    try {
      for (const localDate of datesRequested) {
        try {
          const fetchedAt = this.now();
          const workouts = (await provider.fetchDailyWorkouts({
            userId: user.id,
            localDate,
            timezone,
            isCurrentDay: localDate === currentLocalDate,
          })).map((workout) => ({ ...workout, syncSessionId: session.id }));
          const results = await this.todayRepository.upsertWorkouts(user, workouts);
          const deleted = await this.todayRepository.deleteMissingWorkoutsForDay?.(
            user.id,
            localDate,
            WHOOP_PROVIDER_ID,
            workouts.map((workout) => workout.providerWorkoutId),
            fetchedAt,
          ) ?? 0;
          const created = results.filter((result) => result === 'created').length;
          const updated = results.filter((result) => result === 'updated').length + deleted;
          recordsImported += created;
          recordsUpdated += updated;
          if (created + updated > 0) datesUpdated.push(localDate);
          categoryResults.push({
            provider: WHOOP_PROVIDER_ID,
            category: 'workouts',
            localDate,
            queryResult: workouts.length > 0 ? 'ready' : 'empty',
            uploadResult: created > 0 ? 'created' : updated > 0 ? 'updated' : 'unchanged',
          });
        } catch {
          categoryResults.push({
            provider: WHOOP_PROVIDER_ID,
            category: 'workouts',
            localDate,
            queryResult: 'error',
            uploadResult: 'error',
            errorCode: 'whoop_workout_query_failed',
          });
        }
      }
      const failed = categoryResults.some((result) => result.queryResult === 'error');
      await this.db.$transaction([
        this.db.externalProviderConnection.update({
          where: { id: connection!.id },
          data: { lastSyncedAt: this.now(), lastErrorCode: failed ? 'partial_workout_sync' : null },
        }),
        this.db.ingestionSyncSession.update({
          where: { id: session.id },
          data: {
            status: failed ? 'partially_completed' : 'completed',
            completedAt: this.now(),
            workoutsStatus: failed ? 'error' : 'ready',
            datesUploaded: datesUpdated,
            datesSkipped: datesRequested.filter((date) => !datesUpdated.includes(date)),
            recordsImported,
            recordsUpdated,
            categoryResults,
          },
        }),
      ]);
      return {
        datesRequested,
        datesUpdated,
        datesSkipped: datesRequested.filter((date) => !datesUpdated.includes(date)),
      };
    } catch (error) {
      await this.db.ingestionSyncSession.update({
        where: { id: session.id },
        data: { status: 'failed', completedAt: this.now(), workoutsStatus: 'error', errorCode: 'whoop_sync_failed' },
      });
      throw error;
    }
  }

  async disconnect(user: DevelopmentUser) {
    const secrets = configured(this.config);
    const connection = await this.db.externalProviderConnection.findUnique({
      where: { userId_provider: { userId: user.id, provider: WHOOP_PROVIDER_ID } },
    });
    if (!connection) return;
    const accessToken = decryptProviderSecret(connection.encryptedAccessToken, secrets.encryptionKey);
    await this.fetcher(`${this.config.WHOOP_API_BASE_URL}/user/access`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => undefined);
    const selection = await this.db.providerSelection.findUnique({ where: { userId: user.id } });
    await this.db.$transaction([
      this.db.externalProviderConnection.delete({ where: { id: connection.id } }),
      ...(selection?.authoritativeActivityProvider === WHOOP_PROVIDER_ID
        ? [this.db.providerSelection.update({
          where: { userId: user.id },
          data: { authoritativeActivityProvider: 'apple_health', allowActivityFallback: false },
        })]
        : []),
    ]);
  }
}
