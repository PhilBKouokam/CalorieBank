import { createHash, randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

import type { ApiEnv } from '../../env';
import { AppError } from '../../errors';
import type { DevelopmentUser } from '../goal-configuration/goal-configuration.repository';
import type { TodayAggregateRepository } from '../today/today.repository';
import type { FinalizationScheduler } from '../finalization-orchestration/finalization-orchestration.service';
import { getLocalDateForTimezone } from '../today/today.time';
import { FitbitExpenditureProvider, type FitbitActivityTransport } from './fitbit.provider';
import { decryptFitbitSecret, encryptFitbitSecret } from './token-crypto';

type FitbitTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id: string;
  scope?: string;
};

function configured(config: ApiEnv) {
  if (!config.FITBIT_CLIENT_ID || !config.FITBIT_CLIENT_SECRET || !config.FITBIT_REDIRECT_URI || !config.FITBIT_TOKEN_ENCRYPTION_KEY) {
    throw new AppError('Fitbit is not configured for this environment.', 503);
  }
  return {
    clientId: config.FITBIT_CLIENT_ID,
    clientSecret: config.FITBIT_CLIENT_SECRET,
    redirectUri: config.FITBIT_REDIRECT_URI,
    encryptionKey: config.FITBIT_TOKEN_ENCRYPTION_KEY,
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

function safeMobileRedirect(value: string) {
  if (!/^caloriebank:\/\/integrations(?:\?.*)?$/.test(value)) {
    throw new AppError('Mobile redirect URI is invalid.', 400);
  }
  return value;
}

export class FitbitService {
  constructor(
    private readonly db: PrismaClient,
    private readonly todayRepository: TodayAggregateRepository,
    private readonly config: ApiEnv,
    private readonly finalizationScheduler?: FinalizationScheduler,
    private readonly fetcher: typeof fetch = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async createAuthorizationUrl(user: DevelopmentUser, mobileRedirectUri: string) {
    const secrets = configured(this.config);
    const state = randomBytes(32).toString('base64url');
    const verifier = randomBytes(48).toString('base64url');
    await this.db.user.upsert({
      where: { id: user.id }, update: { email: user.email }, create: { id: user.id, email: user.email },
    });
    await this.db.fitbitOAuthAttempt.create({
      data: {
        userId: user.id,
        stateHash: hash(state),
        encryptedCodeVerifier: encryptFitbitSecret(verifier, secrets.encryptionKey),
        mobileRedirectUri: safeMobileRedirect(mobileRedirectUri),
        expiresAt: new Date(this.now().getTime() + 10 * 60 * 1000),
      },
    });
    const url = new URL(this.config.FITBIT_AUTHORIZATION_URL);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', secrets.clientId);
    url.searchParams.set('redirect_uri', secrets.redirectUri);
    url.searchParams.set('scope', 'activity');
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', hash(verifier));
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  }

  private async tokenRequest(body: URLSearchParams): Promise<FitbitTokenResponse> {
    const secrets = configured(this.config);
    const response = await this.fetcher(this.config.FITBIT_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${secrets.clientId}:${secrets.clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    if (!response.ok) throw new AppError('Fitbit authorization could not be completed.', 502);
    const payload = await response.json() as Partial<FitbitTokenResponse>;
    if (!payload.access_token || !payload.refresh_token || !payload.expires_in || !payload.user_id) {
      throw new AppError('Fitbit returned an incomplete authorization response.', 502);
    }
    return payload as FitbitTokenResponse;
  }

  async completeAuthorization(code: string, state: string) {
    const secrets = configured(this.config);
    const attempt = await this.db.fitbitOAuthAttempt.findUnique({ where: { stateHash: hash(state) } });
    if (!attempt || attempt.consumedAt || attempt.expiresAt <= this.now()) {
      throw new AppError('Fitbit authorization state is invalid or expired.', 400);
    }
    const verifier = decryptFitbitSecret(attempt.encryptedCodeVerifier, secrets.encryptionKey);
    const token = await this.tokenRequest(new URLSearchParams({
      grant_type: 'authorization_code', code, redirect_uri: secrets.redirectUri, code_verifier: verifier,
    }));
    await this.db.$transaction([
      this.db.fitbitOAuthAttempt.update({ where: { id: attempt.id }, data: { consumedAt: this.now() } }),
      this.db.fitbitConnection.upsert({
        where: { userId: attempt.userId },
        create: {
          userId: attempt.userId,
          fitbitUserId: token.user_id,
          encryptedAccessToken: encryptFitbitSecret(token.access_token, secrets.encryptionKey),
          encryptedRefreshToken: encryptFitbitSecret(token.refresh_token, secrets.encryptionKey),
          accessTokenExpiresAt: new Date(this.now().getTime() + token.expires_in * 1000),
          scopes: token.scope?.split(' ').filter(Boolean) ?? ['activity'],
        },
        update: {
          fitbitUserId: token.user_id,
          encryptedAccessToken: encryptFitbitSecret(token.access_token, secrets.encryptionKey),
          encryptedRefreshToken: encryptFitbitSecret(token.refresh_token, secrets.encryptionKey),
          accessTokenExpiresAt: new Date(this.now().getTime() + token.expires_in * 1000),
          scopes: token.scope?.split(' ').filter(Boolean) ?? ['activity'],
          status: 'connected', lastErrorCode: null, connectedAt: this.now(),
        },
      }),
    ]);
    return attempt.mobileRedirectUri;
  }

  private async accessToken(userId: string) {
    const secrets = configured(this.config);
    const connection = await this.db.fitbitConnection.findUnique({ where: { userId } });
    if (!connection || connection.status !== 'connected') throw new AppError('Fitbit is not connected.', 409);
    if (connection.accessTokenExpiresAt.getTime() > this.now().getTime() + 60_000) {
      return decryptFitbitSecret(connection.encryptedAccessToken, secrets.encryptionKey);
    }
    try {
      const token = await this.tokenRequest(new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: decryptFitbitSecret(connection.encryptedRefreshToken, secrets.encryptionKey),
      }));
      await this.db.fitbitConnection.update({
        where: { userId },
        data: {
          encryptedAccessToken: encryptFitbitSecret(token.access_token, secrets.encryptionKey),
          encryptedRefreshToken: encryptFitbitSecret(token.refresh_token, secrets.encryptionKey),
          accessTokenExpiresAt: new Date(this.now().getTime() + token.expires_in * 1000),
          lastRefreshedAt: this.now(), status: 'connected', lastErrorCode: null,
        },
      });
      return token.access_token;
    } catch (error) {
      await this.db.fitbitConnection.update({ where: { userId }, data: { status: 'needs_reconnect', lastErrorCode: 'token_refresh_failed' } });
      throw error;
    }
  }

  async syncRollingWindow(user: DevelopmentUser, currentLocalDate: string, timezone: string, force = false) {
    const datesRequested = [0, 1, 2].map((days) => previousLocalDate(currentLocalDate, days));
    const connection = await this.db.fitbitConnection.findUnique({ where: { userId: user.id } });
    if (!force && connection?.lastSyncedAt && this.now().getTime() - connection.lastSyncedAt.getTime() < 5 * 60 * 1000) {
      return { datesRequested, datesUpdated: [], datesSkipped: datesRequested };
    }
    const accessToken = await this.accessToken(user.id);
    const session = await this.db.ingestionSyncSession.create({
      data: {
        userId: user.id, localDate: new Date(`${currentLocalDate}T00:00:00.000Z`), timezone,
        provider: 'fitbit', trigger: 'manual_refresh', startedAt: this.now(), datesQueried: datesRequested,
        expenditureStatus: 'not_attempted', intakeStatus: 'skipped', stepsStatus: 'skipped', workoutsStatus: 'skipped',
      },
    });
    const transport: FitbitActivityTransport = {
      fetchDailyActivity: async (date) => {
        const response = await this.fetcher(`${this.config.FITBIT_API_BASE_URL}/1/user/-/activities/date/${date}.json`, {
          headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
        });
        if (response.status === 401) {
          await this.db.fitbitConnection.update({ where: { userId: user.id }, data: { status: 'needs_reconnect', lastErrorCode: 'access_revoked' } });
          throw new AppError('Fitbit access needs to be reconnected.', 401);
        }
        if (!response.ok) throw new AppError('Fitbit activity data is temporarily unavailable.', 502);
        return response.json();
      },
    };
    const provider = new FitbitExpenditureProvider(transport, this.now);
    const datesUpdated: string[] = [];
    const datesSkipped: string[] = [];
    try {
      for (const localDate of datesRequested) {
        const aggregate = await provider.fetchDailyExpenditureAggregate({
          userId: user.id, localDate, timezone, isCurrentDay: localDate === currentLocalDate,
        });
        aggregate.syncSessionId = session.id;
        const result = await this.todayRepository.upsertExpenditureAggregate(user, aggregate);
        (result === 'created' || result === 'updated' ? datesUpdated : datesSkipped).push(localDate);
      }
      const orchestration = await this.finalizationScheduler?.execute({
        user,
        currentLocalDate,
        timezone,
        dates: datesRequested,
        trigger: 'provider_reconnect',
        syncSessionId: session.id,
      });
      await this.db.$transaction([
        this.db.fitbitConnection.update({ where: { userId: user.id }, data: { lastSyncedAt: this.now(), lastErrorCode: null } }),
        this.db.ingestionSyncSession.update({
          where: { id: session.id },
          data: {
            status: 'completed', completedAt: this.now(), expenditureStatus: 'ready',
            datesUploaded: datesUpdated, datesSkipped,
            datesReconciled: orchestration?.datesReconciled ?? [],
            datesLocked: orchestration?.datesLocked ?? [],
            waitingDates: orchestration?.waitingDates ?? [],
            recordsImported: datesUpdated.length, recordsSkipped: datesSkipped.length,
          },
        }),
      ]);
      return { datesRequested, datesUpdated, datesSkipped };
    } catch (error) {
      await this.db.ingestionSyncSession.update({
        where: { id: session.id }, data: { status: 'failed', completedAt: this.now(), expenditureStatus: 'error', errorCode: 'fitbit_sync_failed' },
      });
      throw error;
    }
  }

  async disconnect(user: DevelopmentUser) {
    await this.db.$transaction([
      this.db.fitbitConnection.deleteMany({ where: { userId: user.id } }),
      this.db.providerSelection.updateMany({
        where: { userId: user.id, authoritativeExpenditureProvider: 'fitbit' },
        data: { authoritativeExpenditureProvider: 'apple_health', allowExpenditureFallback: false, selectedAt: this.now() },
      }),
    ]);
    const [profile, provisional] = await Promise.all([
      this.db.userProfile.findUnique({ where: { userId: user.id } }),
      this.db.finalizedDailyBankRecord.findMany({
        where: { userId: user.id, status: 'PROVISIONAL' }, select: { logDate: true },
      }),
    ]);
    const timezone = profile?.timezone ?? 'America/Chicago';
    const currentLocalDate = getLocalDateForTimezone(timezone, this.now());
    await this.finalizationScheduler?.execute({
      user, currentLocalDate, timezone,
      dates: provisional.map((record) => record.logDate.toISOString().slice(0, 10)),
      trigger: 'provider_reconnect',
    });
  }
}
