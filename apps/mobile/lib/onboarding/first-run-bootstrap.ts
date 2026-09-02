import { fetchBankSummary, fetchOnboardingStatus, fetchToday } from '@/lib/api/client';
import { runAccountLifecycle } from '@/lib/lifecycle/account-lifecycle';
import { deriveFirstRunBootstrapState } from '@/lib/onboarding/onboarding-recovery';

function log(event: string, metadata: Record<string, unknown> = {}) {
  console.info(JSON.stringify({ component: 'first_run_bootstrap', event, ...metadata }));
}

export async function runFirstRunBootstrap() {
  const startedAt = Date.now();
  log('first_run_bootstrap_started');
  try {
    const lifecycle = await runAccountLifecycle({ force: true });
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const [onboarding, bank, today] = await Promise.all([
      fetchOnboardingStatus(),
      fetchBankSummary(),
      fetchToday(timezone),
    ]);
    const state = deriveFirstRunBootstrapState({ onboarding, bank, today });
    if (state.currentBurnReady) log('first_run_current_burn_ready');
    if (state.currentIntakeReady) log('first_run_current_intake_ready');
    if (state.historyReady) log('first_run_history_ready');
    if (state.bankReady) log('first_run_bank_ready');
    log(state.complete && lifecycle.status !== 'partial'
      ? 'first_run_bootstrap_completed'
      : 'first_run_bootstrap_partial', {
      durationMs: Date.now() - startedAt,
      lifecycleStatus: lifecycle.status,
      currentBurnReady: state.currentBurnReady,
      currentIntakeReady: state.currentIntakeReady,
      historyReady: state.historyReady,
      bankReady: state.bankReady,
    });
    return { lifecycle, state };
  } catch (error) {
    log('first_run_bootstrap_failed', {
      durationMs: Date.now() - startedAt,
      reasonCode: error instanceof Error ? error.name : 'unknown',
    });
    return null;
  }
}
