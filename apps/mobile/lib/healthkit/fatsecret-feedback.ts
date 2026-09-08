import { fetchProviderSelection, syncFatSecret } from '../api/client';
import { foodConnectionMessage, foodConnectionState } from './connection-feedback';

export async function refreshFatSecretWithFeedback(timezone: string, duringSetup = false) {
  let failed = false;
  try { await syncFatSecret(timezone, true); } catch { failed = true; }
  // Read connection truth after the diary request: retrieval failure is not an auth failure.
  const providers = await fetchProviderSelection();
  const state = foodConnectionState(
    providers.connectedProviders.find((provider) => provider.provider === 'fatsecret')?.status,
    providers.intake.authoritativeProvider === 'fatsecret' && providers.intake.status === 'ready',
    failed,
  );
  return { state, message: foodConnectionMessage('FatSecret', state, duringSetup) };
}
