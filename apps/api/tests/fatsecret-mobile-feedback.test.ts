import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchProviderSelection, syncFatSecret } from '../../mobile/lib/api/client';
import { refreshFatSecretWithFeedback } from '../../mobile/lib/healthkit/fatsecret-feedback';

vi.mock('../../mobile/lib/api/client', () => ({ fetchProviderSelection: vi.fn(), syncFatSecret: vi.fn() }));

describe('FatSecret mobile connection feedback', () => {
  beforeEach(() => vi.resetAllMocks());
  function provider(status: string, intake: string) {
    vi.mocked(fetchProviderSelection).mockResolvedValue({
      connectedProviders: [{ provider: 'fatsecret', status }],
      intake: { authoritativeProvider: 'fatsecret', status: intake },
    } as Awaited<ReturnType<typeof fetchProviderSelection>>);
  }
  it('reads acknowledged connection state after a successful empty query', async () => {
    provider('connected', 'unavailable');
    expect((await refreshFatSecretWithFeedback('America/Chicago')).state).toBe('no_data');
    expect(syncFatSecret).toHaveBeenCalledWith('America/Chicago', true);
  });
  it('does not mislabel transient retrieval failure as missing food or failed authorization', async () => {
    vi.mocked(syncFatSecret).mockRejectedValue(new Error('upstream'));
    provider('connected', 'unavailable');
    expect((await refreshFatSecretWithFeedback('America/Chicago')).state).toBe('refresh_failed');
  });
  it('requires reconnect when server reports revoked authorization', async () => {
    vi.mocked(syncFatSecret).mockRejectedValue(new Error('upstream'));
    provider('needs_attention', 'ready');
    expect((await refreshFatSecretWithFeedback('America/Chicago')).state).toBe('reauthentication_required');
  });
  it('transitions to ready when later food arrives', async () => {
    provider('connected', 'unavailable');
    expect((await refreshFatSecretWithFeedback('America/Chicago')).state).toBe('no_data');
    provider('connected', 'ready');
    expect((await refreshFatSecretWithFeedback('America/Chicago')).state).toBe('ready');
  });
  it('does not invent connection truth when the followup read fails', async () => {
    vi.mocked(fetchProviderSelection).mockRejectedValue(new Error('offline'));
    await expect(refreshFatSecretWithFeedback('America/Chicago')).rejects.toThrow('offline');
  });
});
