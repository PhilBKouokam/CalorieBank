export async function retryDeletionOperation<T>(operation: () => Promise<T>, retryable: (error: unknown) => boolean) {
  for (let attempt = 0; ; attempt += 1) {
    try { return await operation(); }
    catch (error) {
      if (attempt >= 2 || !retryable(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
    }
  }
}

export function remoteStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const value = error as { status?: unknown; statusCode?: unknown };
  return typeof value.status === 'number' ? value.status : typeof value.statusCode === 'number' ? value.statusCode : undefined;
}
