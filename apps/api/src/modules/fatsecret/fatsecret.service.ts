import { createHash, randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

import type { ApiEnv } from '../../env';
import { AppError } from '../../errors';
import type { DevelopmentUser } from '../goal-configuration/goal-configuration.repository';
import {
  decryptProviderSecret,
  encryptProviderSecret,
  validateProviderTokenEncryptionKey,
} from '../provider-oauth/token-crypto';
import type { TodayAggregateRepository } from '../today/today.repository';
import type { FinalizationScheduler, OrchestrationTrigger } from '../finalization-orchestration/finalization-orchestration.service';
import { FatSecretIntakeProvider, FATSECRET_PROVIDER_ID } from './fatsecret.provider';
import { createSignedOAuth1Parameters, oauth1Query } from './oauth1';

type FatSecretErrorPayload = { error?: { code?: number | string; message?: string } };

class FatSecretApiError extends Error {
  constructor(readonly providerCode: string | null, message: string) {
    super(message);
    this.name = 'FatSecretApiError';
  }
}

function configured(config: ApiEnv) {
  const encryptionKey = config.EXTERNAL_PROVIDER_TOKEN_ENCRYPTION_KEY;
  if (!config.FATSECRET_CONSUMER_KEY || !config.FATSECRET_CONSUMER_SECRET || !config.FATSECRET_REDIRECT_URI || !encryptionKey) {
    throw new AppError('FatSecret is not configured for this environment.', 503);
  }
  validateProviderTokenEncryptionKey(encryptionKey);
  return {
    consumerKey: config.FATSECRET_CONSUMER_KEY,
    consumerSecret: config.FATSECRET_CONSUMER_SECRET,
    redirectUri: config.FATSECRET_REDIRECT_URI,
    encryptionKey,
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

function parseTokenResponse(text: string) {
  const values = new URLSearchParams(text);
  const token = values.get('oauth_token');
  const secret = values.get('oauth_token_secret');
  if (!token || !secret) throw new FatSecretApiError(null, 'FatSecret returned an incomplete token response.');
  return { token, secret, callbackConfirmed: values.get('oauth_callback_confirmed') };
}

function providerError(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null;
  const error = (payload as FatSecretErrorPayload).error;
  if (!error) return null;
  return new FatSecretApiError(error.code === undefined ? null : String(error.code), error.message ?? 'FatSecret request failed.');
}

export class FatSecretService {
  constructor(
    private readonly db: PrismaClient,
    private readonly todayRepository: TodayAggregateRepository,
    private readonly config: ApiEnv,
    private readonly fetcher: typeof fetch = fetch,
    private readonly now: () => Date = () => new Date(),
    private readonly nonce: () => string = () => randomBytes(16).toString('hex'),
    private readonly finalizationScheduler?: FinalizationScheduler,
  ) {}

  async getConnection(userId: string) {
    const connection = await this.db.externalProviderConnection.findUnique({
      where: { userId_provider: { userId, provider: FATSECRET_PROVIDER_ID } },
    });
    return {
      provider: FATSECRET_PROVIDER_ID,
      displayName: 'FatSecret',
      status: connection?.status === 'connected'
        ? 'connected' as const
        : connection
          ? 'needs_attention' as const
          : 'not_connected' as const,
      lastSyncedAt: connection?.lastSyncedAt?.toISOString() ?? null,
    };
  }

  private signedParameters(input: {
    method: string;
    url: string;
    token?: string;
    tokenSecret?: string;
    callback?: string;
    verifier?: string;
    requestParameters?: readonly (readonly [string, string])[];
  }) {
    const secrets = configured(this.config);
    return createSignedOAuth1Parameters({
      ...input,
      consumerKey: secrets.consumerKey,
      consumerSecret: secrets.consumerSecret,
      timestamp: Math.floor(this.now().getTime() / 1000),
      nonce: this.nonce(),
    });
  }

  async createAuthorizationUrl(user: DevelopmentUser, mobileRedirectUri: string) {
    const secrets = configured(this.config);
    const parameters = this.signedParameters({
      method: 'POST',
      url: this.config.FATSECRET_REQUEST_TOKEN_URL,
      callback: secrets.redirectUri,
    });
    const response = await this.fetcher(this.config.FATSECRET_REQUEST_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: oauth1Query(parameters),
    });
    if (!response.ok) throw new AppError('FatSecret connection could not be started.', 502);
    const requestToken = parseTokenResponse(await response.text());
    if (requestToken.callbackConfirmed !== 'true') {
      throw new AppError('FatSecret did not confirm the callback address.', 502);
    }
    await this.db.user.upsert({
      where: { id: user.id },
      update: { email: user.email },
      create: { id: user.id, email: user.email },
    });
    await this.db.externalProviderOAuthAttempt.create({
      data: {
        userId: user.id,
        provider: FATSECRET_PROVIDER_ID,
        stateHash: hash(requestToken.token),
        encryptedRequestToken: encryptProviderSecret(requestToken.token, secrets.encryptionKey),
        encryptedRequestTokenSecret: encryptProviderSecret(requestToken.secret, secrets.encryptionKey),
        mobileRedirectUri: safeMobileRedirect(mobileRedirectUri),
        expiresAt: new Date(this.now().getTime() + 10 * 60 * 1000),
      },
    });
    const authorizationUrl = new URL(this.config.FATSECRET_AUTHORIZE_URL);
    authorizationUrl.searchParams.set('oauth_token', requestToken.token);
    return authorizationUrl.toString();
  }

  async completeAuthorization(oauthToken: string, verifier: string) {
    const secrets = configured(this.config);
    const attempt = await this.db.externalProviderOAuthAttempt.findUnique({
      where: { stateHash: hash(oauthToken) },
    });
    if (
      !attempt ||
      attempt.provider !== FATSECRET_PROVIDER_ID ||
      attempt.consumedAt ||
      attempt.expiresAt <= this.now() ||
      !attempt.encryptedRequestToken ||
      !attempt.encryptedRequestTokenSecret
    ) throw new AppError('FatSecret authorization is invalid or expired.', 400);
    const storedRequestToken = decryptProviderSecret(attempt.encryptedRequestToken, secrets.encryptionKey);
    if (storedRequestToken !== oauthToken) throw new AppError('FatSecret authorization token is invalid.', 400);
    const requestTokenSecret = decryptProviderSecret(attempt.encryptedRequestTokenSecret, secrets.encryptionKey);
    const parameters = this.signedParameters({
      method: 'GET',
      url: this.config.FATSECRET_ACCESS_TOKEN_URL,
      token: oauthToken,
      tokenSecret: requestTokenSecret,
      verifier,
    });
    const url = new URL(this.config.FATSECRET_ACCESS_TOKEN_URL);
    url.search = oauth1Query(parameters).toString();
    const response = await this.fetcher(url, { headers: { Accept: 'application/x-www-form-urlencoded' } });
    if (!response.ok) throw new AppError('FatSecret authorization could not be completed.', 502);
    const access = parseTokenResponse(await response.text());
    await this.db.$transaction([
      this.db.externalProviderConnection.upsert({
        where: { userId_provider: { userId: attempt.userId, provider: FATSECRET_PROVIDER_ID } },
        create: {
          userId: attempt.userId,
          provider: FATSECRET_PROVIDER_ID,
          authProtocol: 'oauth1',
          encryptedAccessToken: encryptProviderSecret(access.token, secrets.encryptionKey),
          encryptedTokenSecret: encryptProviderSecret(access.secret, secrets.encryptionKey),
          encryptedRefreshToken: null,
          accessTokenExpiresAt: null,
          scopes: [],
        },
        update: {
          authProtocol: 'oauth1',
          encryptedAccessToken: encryptProviderSecret(access.token, secrets.encryptionKey),
          encryptedTokenSecret: encryptProviderSecret(access.secret, secrets.encryptionKey),
          encryptedRefreshToken: null,
          accessTokenExpiresAt: null,
          scopes: [],
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

  private async delegatedCredentials(userId: string) {
    const secrets = configured(this.config);
    const connection = await this.db.externalProviderConnection.findUnique({
      where: { userId_provider: { userId, provider: FATSECRET_PROVIDER_ID } },
    });
    if (!connection || connection.status !== 'connected' || !connection.encryptedTokenSecret) {
      throw new AppError('FatSecret is not connected.', 409);
    }
    return {
      connection,
      token: decryptProviderSecret(connection.encryptedAccessToken, secrets.encryptionKey),
      tokenSecret: decryptProviderSecret(connection.encryptedTokenSecret, secrets.encryptionKey),
    };
  }

  async syncRollingWindow(user: DevelopmentUser, currentLocalDate: string, timezone: string, force = false, dayCount = 3, trigger: OrchestrationTrigger = 'manual_refresh') {
    const datesRequested = Array.from({ length: dayCount }, (_, days) => previousLocalDate(currentLocalDate, days));
    const { connection, token, tokenSecret } = await this.delegatedCredentials(user.id);
    if (!force && connection.lastSyncedAt && this.now().getTime() - connection.lastSyncedAt.getTime() < 5 * 60 * 1000) {
      return { datesRequested, datesUpdated: [], datesSkipped: datesRequested };
    }
    const session = await this.db.ingestionSyncSession.create({
      data: {
        userId: user.id,
        provider: FATSECRET_PROVIDER_ID,
        localDate: new Date(`${currentLocalDate}T00:00:00.000Z`),
        timezone,
        trigger,
        startedAt: this.now(),
        datesQueried: datesRequested,
        expenditureStatus: 'skipped',
        intakeStatus: 'not_attempted',
        stepsStatus: 'skipped',
        workoutsStatus: 'skipped',
      },
    });
    const diaryUrl = `${this.config.FATSECRET_API_BASE_URL}/food-entries/month/v1`;
    const provider = new FatSecretIntakeProvider({
      fetchMonthlyDiary: async (date) => {
        const requestParameters = [['date', String(date)], ['format', 'json']] as const;
        const parameters = this.signedParameters({
          method: 'GET', url: diaryUrl, token, tokenSecret, requestParameters,
        });
        const url = new URL(diaryUrl);
        url.search = oauth1Query(parameters).toString();
        const response = await this.fetcher(url, { headers: { Accept: 'application/json' } });
        const payload = await response.json().catch(() => null) as unknown;
        if (!response.ok) throw new FatSecretApiError(String(response.status), 'FatSecret diary is temporarily unavailable.');
        const error = providerError(payload);
        if (error) throw error;
        return payload;
      },
    }, this.now);
    const categoryResults: Array<Record<string, string>> = [];
    const datesUpdated: string[] = [];
    let recordsImported = 0;
    let recordsUpdated = 0;
    try {
      const aggregates = await provider.fetchRollingDailyCalorieIntakeAggregates(
        datesRequested.map((localDate) => ({
          userId: user.id,
          localDate,
          timezone,
          isCurrentDay: localDate === currentLocalDate,
        })),
      );
      for (let index = 0; index < datesRequested.length; index += 1) {
        const localDate = datesRequested[index]!;
        const aggregate = aggregates[index];
        if (!aggregate) {
          const changed = await this.todayRepository.markIntakeAggregateUnavailable?.(user, {
            localDate,
            provider: FATSECRET_PROVIDER_ID,
            syncSessionId: session.id,
            isCurrentDay: localDate === currentLocalDate,
          }) ?? false;
          if (changed) datesUpdated.push(localDate);
          categoryResults.push({ provider: FATSECRET_PROVIDER_ID, category: 'intake', localDate, queryResult: 'empty', uploadResult: changed ? 'updated' : 'unchanged' });
          continue;
        }
        const result = await this.todayRepository.upsertIntakeAggregate(user, { ...aggregate, syncSessionId: session.id });
        if (result === 'created') recordsImported += 1;
        if (result === 'updated') recordsUpdated += 1;
        if (result === 'created' || result === 'updated') datesUpdated.push(localDate);
        categoryResults.push({ provider: FATSECRET_PROVIDER_ID, category: 'intake', localDate, queryResult: 'ready', uploadResult: result });
      }
      await this.db.$transaction([
        this.db.externalProviderConnection.update({
          where: { id: connection.id },
          data: { lastSyncedAt: this.now(), lastErrorCode: null },
        }),
        this.db.ingestionSyncSession.update({
          where: { id: session.id },
          data: {
            status: 'completed',
            completedAt: this.now(),
            intakeStatus: aggregates.some(Boolean) ? 'ready' : 'unavailable',
            datesUploaded: datesUpdated,
            datesSkipped: datesRequested.filter((date) => !datesUpdated.includes(date)),
            recordsImported,
            recordsUpdated,
            categoryResults,
          },
        }),
      ]);
      const finalization = this.finalizationScheduler
        ? await this.finalizationScheduler.execute({
            user,
            currentLocalDate,
            timezone,
            dates: datesRequested,
            trigger,
            syncSessionId: session.id,
          })
        : { datesReconciled: [], datesLocked: [], waitingDates: [], errors: [] };
      await this.db.ingestionSyncSession.update({
        where: { id: session.id },
        data: {
          datesReconciled: finalization.datesReconciled,
          datesLocked: finalization.datesLocked,
          waitingDates: finalization.waitingDates.map((item) => item.date),
        },
      });
      return { datesRequested, datesUpdated, datesSkipped: datesRequested.filter((date) => !datesUpdated.includes(date)) };
    } catch (error) {
      const reconnect = error instanceof FatSecretApiError && error.providerCode === '9';
      await this.db.$transaction([
        this.db.externalProviderConnection.update({
          where: { id: connection.id },
          data: {
            status: reconnect ? 'needs_reconnect' : connection.status,
            lastErrorCode: reconnect ? 'access_token_invalid' : 'diary_sync_failed',
          },
        }),
        this.db.ingestionSyncSession.update({
          where: { id: session.id },
          data: { status: 'failed', completedAt: this.now(), intakeStatus: 'error', errorCode: 'fatsecret_sync_failed' },
        }),
      ]);
      throw new AppError('FatSecret diary could not be refreshed.', reconnect ? 401 : 502);
    }
  }

  async disconnect(user: DevelopmentUser) {
    const selection = await this.db.providerSelection.findUnique({ where: { userId: user.id } });
    if (selection?.authoritativeIntakeProvider === FATSECRET_PROVIDER_ID) {
      throw new AppError(
        'Choose another calories eaten source before disconnecting FatSecret.',
        409,
        { code: 'SELECTED_SOURCE_MUST_CHANGE_FIRST', role: 'eaten' },
      );
    }
    await this.db.$transaction([
      this.db.externalProviderConnection.deleteMany({ where: { userId: user.id, provider: FATSECRET_PROVIDER_ID } }),
      this.db.externalProviderOAuthAttempt.deleteMany({ where: { userId: user.id, provider: FATSECRET_PROVIDER_ID } }),
    ]);
  }
}
