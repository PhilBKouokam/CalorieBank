import { clerkMiddleware, createClerkClient, getAuth } from '@clerk/express';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import type { ApiEnv } from '../env';
import { AppError } from '../errors';
import type { DevelopmentUser } from '../modules/goal-configuration/goal-configuration.repository';

declare global {
  // Express exposes request-scoped locals through declaration merging.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Locals {
      currentUser?: DevelopmentUser;
      requestId?: string;
    }
  }
}

export type AuthenticationBoundary = {
  verify: RequestHandler;
  requireUser: RequestHandler;
};

export type VerifiedIdentity = {
  subject: string;
  email: string;
};

type IdentityVerifier = (request: Request) => Promise<VerifiedIdentity | null>;

type ClerkAuthSnapshot = {
  clerkAuthObjectPresent: boolean;
  clerkIsAuthenticated: boolean;
  clerkSessionPresent: boolean;
  clerkSubjectPresent: boolean;
  subjectFingerprint: string | null;
};

const callbackPaths = new Set([
  '/v1/me/integrations/fitbit/callback',
  '/v1/me/integrations/fatsecret/callback',
  '/v1/me/integrations/whoop/callback',
]);

function isPublicRequest(request: Request) {
  return request.path === '/health' || request.path === '/health/ready' || callbackPaths.has(request.path);
}

function subjectFingerprint(subject: string) {
  return createHash('sha256').update(subject).digest('hex').slice(0, 12);
}

function configurationFingerprint(value: string) {
  // FNV-1a is only a non-reversible diagnostic label shared with mobile.
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function requestAuthHeaders(request: Request) {
  const authorization = request.header('authorization');
  return {
    authorizationHeaderPresent: Boolean(authorization),
    bearerTokenPresent: Boolean(authorization?.startsWith('Bearer ')),
  };
}

function clerkAuthSnapshot(request: Request): ClerkAuthSnapshot {
  try {
    const auth = getAuth(request);
    const subject = auth.userId;
    return {
      clerkAuthObjectPresent: true,
      clerkIsAuthenticated: Boolean(auth.isAuthenticated),
      clerkSessionPresent: Boolean(auth.sessionId),
      clerkSubjectPresent: Boolean(subject),
      subjectFingerprint: subject ? subjectFingerprint(subject) : null,
    };
  } catch {
    return {
      clerkAuthObjectPresent: false,
      clerkIsAuthenticated: false,
      clerkSessionPresent: false,
      clerkSubjectPresent: false,
      subjectFingerprint: null,
    };
  }
}

function logAuthBoundary(
  config: ApiEnv,
  request: Request,
  event: 'request_received' | 'request_rejected' | 'current_user_resolved',
  values: Record<string, unknown>,
) {
  if (config.APP_ENV !== 'local') return;
  console.info(JSON.stringify({
    level: 'info',
    component: 'auth_boundary',
    event,
    routePath: request.path,
    authMode: config.AUTH_MODE,
    appEnvironment: config.APP_ENV,
    ...requestAuthHeaders(request),
    ...clerkAuthSnapshot(request),
    ...values,
  }));
}

function authError(message: string, statusCode: number, code: string) {
  return new AppError(message, statusCode, { code });
}

function logIdentityResolution(
  config: ApiEnv,
  identity: VerifiedIdentity,
  user: DevelopmentUser,
  outcome: 'created' | 'existing',
) {
  if (config.APP_ENV !== 'local') return;
  console.info(JSON.stringify({
    level: 'info',
    message: 'clerk_identity_resolved',
    subjectFingerprint: subjectFingerprint(identity.subject),
    internalUserSuffix: user.id.slice(-8),
    outcome,
  }));
}

/**
 * Resolves only by a verified Clerk subject. Email is descriptive metadata and
 * is never an ownership lookup: a recreated Clerk user may reuse an email.
 */
export async function resolveVerifiedClerkIdentity(
  db: PrismaClient,
  config: ApiEnv,
  identity: VerifiedIdentity,
): Promise<DevelopmentUser> {
  const mapped = await db.user.findUnique({ where: { authSubject: identity.subject } });
  if (mapped) {
    if (mapped.authProvider !== 'clerk') {
      throw authError('Authenticated identity is linked to an unsupported provider.', 409, 'UNSUPPORTED_AUTH_PROVIDER');
    }
    const user = { id: mapped.id, email: mapped.email };
    logIdentityResolution(config, identity, user, 'existing');
    return user;
  }

  try {
    const created = await db.user.create({
      data: {
        email: identity.email,
        authProvider: 'clerk',
        authSubject: identity.subject,
        profile: { create: {} },
        bankAccountInitialization: { create: {} },
      },
    });
    const user = { id: created.id, email: created.email };
    logIdentityResolution(config, identity, user, 'created');
    return user;
  } catch (error) {
    // Concurrent first requests may race on the unique subject. Re-read only
    // that subject; never select a user by email or an arbitrary existing row.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const concurrentlyCreated = await db.user.findUnique({ where: { authSubject: identity.subject } });
      if (concurrentlyCreated?.authProvider === 'clerk') {
        const user = { id: concurrentlyCreated.id, email: concurrentlyCreated.email };
        logIdentityResolution(config, identity, user, 'existing');
        return user;
      }
    }
    throw error;
  }
}

export function createAuthenticationBoundary(
  config: ApiEnv,
  db: PrismaClient,
  identityVerifier?: IdentityVerifier,
): AuthenticationBoundary {
  if (config.AUTH_MODE === 'development') {
    if (config.APP_ENV !== 'local') {
      throw new Error('Development identity is restricted to APP_ENV=local.');
    }
    return {
      verify: (_request, _response, next) => next(),
    requireUser: (request, response, next) => {
        if (!isPublicRequest(request)) {
          if (request.header('authorization')) {
            logAuthBoundary(config, request, 'request_rejected', {
              httpStatus: 409,
              currentUserLookupStarted: false,
              currentUserLookupOutcome: 'not_started',
              rejectionBranch: 'development_auth_conflict',
              errorCode: 'DEVELOPMENT_AUTH_CONFLICT',
              safeMessage: 'This API is configured for development authentication and cannot accept Clerk credentials.',
            });
            return next(authError(
              'This API is configured for development authentication and cannot accept Clerk credentials.',
              409,
              'DEVELOPMENT_AUTH_CONFLICT',
            ));
          }
          response.locals.currentUser = { id: config.DEV_USER_ID, email: config.DEV_USER_EMAIL };
        }
        next();
      },
    };
  }

  const publishableKey = config.CLERK_PUBLISHABLE_KEY;
  const secretKey = config.CLERK_SECRET_KEY;
  if (!publishableKey || !secretKey) throw new Error('Clerk authentication is not configured.');
  if (config.APP_ENV === 'local') {
    console.info(JSON.stringify({
      level: 'info',
      component: 'auth_boundary',
      event: 'clerk_configuration',
      publishableKeyEnvironment: publishableKey.startsWith('pk_test_') ? 'test' : publishableKey.startsWith('pk_live_') ? 'live' : 'unknown',
      publishableKeyFingerprint: configurationFingerprint(publishableKey),
      secretKeyEnvironment: secretKey.startsWith('sk_test_') ? 'test' : secretKey.startsWith('sk_live_') ? 'live' : 'unknown',
    }));
  }
  const client = createClerkClient({ publishableKey, secretKey });
  const clerkVerify = clerkMiddleware({ clerkClient: client });
  const verify = identityVerifier
    ? ((_request, _response, next) => next()) as RequestHandler
    : ((request, response, next) => {
      clerkVerify(request, response, (error?: unknown) => {
        if (error) {
          logAuthBoundary(config, request, 'request_rejected', {
            httpStatus: 401,
            currentUserLookupStarted: false,
            currentUserLookupOutcome: 'not_started',
            rejectionBranch: 'clerk_middleware_rejected',
            errorCode: 'CLERK_AUTH_REJECTED',
            safeMessage: 'Clerk authentication could not be verified.',
          });
          return next(authError('Authentication could not be verified.', 401, 'CLERK_AUTH_REJECTED'));
        }
        logAuthBoundary(config, request, 'request_received', {
          currentUserLookupStarted: false,
          currentUserLookupOutcome: 'not_started',
        });
        next();
      });
    }) as RequestHandler;
  return {
    verify,
    requireUser: async (request: Request, response: Response, next: NextFunction) => {
      try {
        if (isPublicRequest(request)) return next();
        if (identityVerifier) {
          const identity = await identityVerifier(request);
          if (!identity) throw authError('Authentication is required.', 401, 'AUTHENTICATION_REQUIRED');
          response.locals.currentUser = await resolveVerifiedClerkIdentity(db, config, identity);
          return next();
        }

        const auth = getAuth(request);
        const { userId } = auth;
        if (!userId) {
          logAuthBoundary(config, request, 'request_rejected', {
            httpStatus: 401,
            currentUserLookupStarted: false,
            currentUserLookupOutcome: 'not_started',
            rejectionBranch: 'missing_clerk_subject',
            errorCode: 'AUTHENTICATION_REQUIRED',
            safeMessage: 'Authentication is required.',
          });
          throw authError('Authentication is required.', 401, 'AUTHENTICATION_REQUIRED');
        }
        const mapped = await db.user.findUnique({ where: { authSubject: userId } });
        if (mapped) {
          if (mapped.authProvider !== 'clerk') {
            logAuthBoundary(config, request, 'request_rejected', {
              httpStatus: 409,
              currentUserLookupStarted: true,
              currentUserLookupOutcome: 'mapped_to_unsupported_provider',
              rejectionBranch: 'unsupported_auth_provider',
              errorCode: 'UNSUPPORTED_AUTH_PROVIDER',
              safeMessage: 'Authenticated identity is linked to an unsupported provider.',
            });
            throw authError('Authenticated identity is linked to an unsupported provider.', 409, 'UNSUPPORTED_AUTH_PROVIDER');
          }
          const user = { id: mapped.id, email: mapped.email };
          logIdentityResolution(config, { subject: userId, email: user.email }, user, 'existing');
          logAuthBoundary(config, request, 'current_user_resolved', {
            currentUserLookupStarted: true,
            currentUserLookupOutcome: 'existing',
            internalUserSuffix: user.id.slice(-8),
          });
          response.locals.currentUser = user;
          return next();
        }
        const clerkUser = await client.users.getUser(userId);
        const primaryEmail = clerkUser.emailAddresses.find(
          (email) => email.id === clerkUser.primaryEmailAddressId,
        )?.emailAddress;
        if (!primaryEmail) {
          logAuthBoundary(config, request, 'request_rejected', {
            httpStatus: 403,
            currentUserLookupStarted: true,
            currentUserLookupOutcome: 'primary_email_unavailable',
            rejectionBranch: 'missing_primary_email',
            errorCode: 'PRIMARY_EMAIL_REQUIRED',
            safeMessage: 'Authenticated account has no primary email address.',
          });
          throw authError('Authenticated account has no primary email address.', 403, 'PRIMARY_EMAIL_REQUIRED');
        }
        response.locals.currentUser = await resolveVerifiedClerkIdentity(db, config, {
          subject: userId,
          email: primaryEmail.toLowerCase(),
        });
        logAuthBoundary(config, request, 'current_user_resolved', {
          currentUserLookupStarted: true,
          currentUserLookupOutcome: 'created',
          internalUserSuffix: response.locals.currentUser.id.slice(-8),
        });
        next();
      } catch (error) {
        if (error instanceof AppError && error.statusCode === 409) {
          const code = typeof error.details === 'object' && error.details !== null && 'code' in error.details
            ? (error.details as { code?: unknown }).code
            : 'AUTH_BOUNDARY_CONFLICT';
          logAuthBoundary(config, request, 'request_rejected', {
            httpStatus: 409,
            currentUserLookupStarted: true,
            currentUserLookupOutcome: 'conflict',
            rejectionBranch: 'current_user_resolution_conflict',
            errorCode: typeof code === 'string' ? code : 'AUTH_BOUNDARY_CONFLICT',
            safeMessage: error.message,
          });
        }
        next(error);
      }
    },
  };
}

export function currentUser(response: Response): DevelopmentUser {
  const user = response.locals.currentUser;
  if (!user) throw new AppError('Authentication is required.', 401);
  return user;
}

export type RequestUserSource = DevelopmentUser | ((response: Response) => DevelopmentUser);

export function resolveRequestUser(source: RequestUserSource, response: Response) {
  return typeof source === 'function' ? source(response) : source;
}
