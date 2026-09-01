type UnknownRecord = Record<string, unknown>;

export type HostedAuthOperation = 'sign_in' | 'sign_up';

export type HostedAuthRedirect = {
  nativeRedirectUrl: string;
  nativeRedirectScheme: string;
};

function record(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null ? value as UnknownRecord : null;
}

function safeCode(value: unknown) {
  return typeof value === 'string' && /^[a-zA-Z0-9_.-]{1,100}$/.test(value)
    ? value
    : null;
}

function redactMessage(value: unknown) {
  if (typeof value !== 'string' || value.length === 0) return 'Hosted authentication failed.';
  return value
    .replace(/https?:\/\/[^\s]+/gi, (url) => {
      try {
        const parsed = new URL(url);
        return `${parsed.origin}${parsed.pathname}`;
      } catch {
        return '[redacted-url]';
      }
    })
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/\b(?:pk|sk)_(?:test|live)_[a-zA-Z0-9_-]+/g, '[redacted-key]')
    .replace(
      /\b(authorization\s+code|authorization|code|access[_ -]?token|refresh[_ -]?token|token|cookie|session|password|client[_ -]?secret|secret)\s*[:=]\s*[^,;]+/gi,
      '$1=[redacted]',
    )
    .slice(0, 300);
}

export function hostedAuthErrorMetadata(error: unknown) {
  const details = record(error);
  const nestedError = Array.isArray(details?.errors) ? record(details.errors[0]) : null;
  return {
    errorType: error instanceof Error
      ? error.name
      : typeof details?.name === 'string'
        ? details.name.slice(0, 100)
        : typeof error,
    clerkErrorCode: safeCode(details?.code) ?? safeCode(nestedError?.code),
    safeMessage: redactMessage(error instanceof Error ? error.message : details?.message),
  };
}

export function hostedAuthResultMetadata(result: {
  createdSessionId: string | null;
  authSessionResult: { type: string } | null;
}) {
  return {
    authSessionResultExists: result.authSessionResult !== null,
    authSessionResultType: result.authSessionResult?.type ?? null,
    createdSessionIdExists: result.createdSessionId !== null,
  };
}

export function defaultHostedAuthRedirect(bundleIdentifier: string): HostedAuthRedirect {
  return {
    nativeRedirectUrl: `${bundleIdentifier}://callback`,
    nativeRedirectScheme: bundleIdentifier,
  };
}
