import type { OnboardingStage, OnboardingStatusResponse, ProviderSelectionInput, ProviderSelectionResponse } from '@caloriebank/schemas';
import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoalConfigurationForm } from '@/components/caloriebank/GoalConfigurationForm';
import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';
import {
  completeOnboarding,
  completeOnboardingWelcome,
  fetchOnboardingStatus,
  fetchProviderSelection,
  saveProviderSelection,
  startFatSecretAuthorization,
  startFitbitAuthorization,
  MOBILE_INTEGRATION_REDIRECT_URI,
  ProviderAuthorizationError,
  getApiRequestFailureKind,
  syncFatSecret,
  syncFitbit,
} from '@/lib/api/client';
import {
  connectAppleHealth,
  getAppleHealthConnectionStatus,
  refreshAppleHealthForCurrentAccount,
} from '@/lib/healthkit/healthkit-connection';
import {
  discoverAppleHealthIntakeWriters,
  resolveKnownFoodTracker,
  type AppleHealthIntakeWriter,
  type KnownFoodTracker,
} from '@/lib/healthkit/apple-health-intake-writers';
import {
  initialImportPlan,
  onboardingRecoveryMessage,
  preparationEditStage,
  previousSetupStage,
  selectedAppleHealthWriter,
  sourceNeedsData,
} from '@/lib/onboarding/onboarding-recovery';

type AppleIntakeAction = `apple-intake:${KnownFoodTracker | 'other' | string}`;
type BusyAction = 'loading' | 'fitbit' | 'fatsecret' | 'apple-burn' | AppleIntakeAction | 'preparing' | 'complete' | null;

const stageNumber = {
  welcome: 0,
  calories_burned: 1,
  calories_eaten: 2,
  goal: 3,
  preparing_bank: 4,
  ready: 5,
  complete: 5,
} as const;

export default function OnboardingScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<OnboardingStatusResponse | null>(null);
  const [providerState, setProviderState] = useState<ProviderSelectionResponse | null>(null);
  const [busy, setBusy] = useState<BusyAction>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<'attention' | 'error'>('error');
  const [preparationAttempted, setPreparationAttempted] = useState(false);
  const [displayStage, setDisplayStage] = useState<OnboardingStage | null>(null);
  const [discoveredIntakeWriters, setDiscoveredIntakeWriters] =
    useState<AppleHealthIntakeWriter[]>([]);

  const refresh = useCallback(async () => {
    try {
      const [next, providers] = await Promise.all([
        fetchOnboardingStatus(),
        fetchProviderSelection(),
      ]);
      setStatus(next);
      setProviderState(providers);
      if (next.completed) router.replace('/today');
      return next;
    } catch {
      setMessage('Setup could not refresh. Check your connection and try again.');
      return null;
    } finally {
      setBusy(null);
    }
  }, [router]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  async function run(action: BusyAction, work: () => Promise<unknown>) {
    setBusy(action);
    setMessage(null);
    setMessageTone('error');
    try {
      await work();
      setDisplayStage(null);
      if (action !== 'preparing') setPreparationAttempted(false);
      await refresh();
    } catch (error) {
      const failureKind = getApiRequestFailureKind(error);
      const recoveryMessage = onboardingRecoveryMessage({
        action: action?.startsWith('apple') || action === 'preparing'
          ? action === 'preparing' ? 'preparing' : 'apple'
          : 'other',
        failureKind,
        usesAppleHealth:
          status?.expenditure.provider === 'apple_health'
          || status?.intake.provider === 'apple_health',
      });
      setMessage(
        error instanceof ProviderAuthorizationError && error.code === 'INVALID_REDIRECT'
          ? 'Fitbit could not start because its return address is invalid. Try again.'
          : error instanceof ProviderAuthorizationError && error.code === 'CONFIGURATION_ERROR'
            ? 'Fitbit is temporarily unavailable. Try again later.'
            : error instanceof Error && (
              error.message.startsWith('Fitbit is connected') ||
              error.message.startsWith('FatSecret is connected')
            )
              ? error.message
            : recoveryMessage,
      );
      setBusy(null);
    }
  }

  async function selectProvider(input: Partial<ProviderSelectionInput>) {
    const current = await fetchProviderSelection();
    await saveProviderSelection({
      authoritativeExpenditureProvider:
        input.authoritativeExpenditureProvider ?? current.expenditure.authoritativeProvider,
      authoritativeActivityProvider:
        input.authoritativeActivityProvider ?? current.activityContext.authoritativeProvider,
      authoritativeIntakeProvider:
        input.authoritativeIntakeProvider ?? current.intake.authoritativeProvider,
      ...('appleHealthIntakeWriter' in input
        ? { appleHealthIntakeWriter: input.appleHealthIntakeWriter }
        : {}),
    });
  }

  async function connectFitbit() {
    await run('fitbit', async () => {
      const redirect = MOBILE_INTEGRATION_REDIRECT_URI;
      const { authorizationUrl } = await startFitbitAuthorization(redirect);
      const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, redirect);
      if (result.type !== 'success') throw new Error('Connection cancelled');
      await selectProvider({
        authoritativeExpenditureProvider: 'google_health_fitbit',
        authoritativeActivityProvider: 'google_health_fitbit',
      });
      await syncFitbit(Intl.DateTimeFormat().resolvedOptions().timeZone, true).catch(() => {
        throw new Error('Fitbit is connected, but CalorieBank couldn’t get your calorie data yet.');
      });
    });
  }

  async function connectFatSecret() {
    await run('fatsecret', async () => {
      const redirect = MOBILE_INTEGRATION_REDIRECT_URI;
      const { authorizationUrl } = await startFatSecretAuthorization(redirect);
      const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, redirect);
      if (result.type !== 'success') throw new Error('Connection cancelled');
      await selectProvider({ authoritativeIntakeProvider: 'fatsecret' });
      await syncFatSecret(Intl.DateTimeFormat().resolvedOptions().timeZone, true).catch(() => {
        throw new Error('FatSecret is connected, but CalorieBank couldn’t get your calorie data yet.');
      });
    });
  }

  async function connectApple(role: 'expenditure') {
    await run('apple-burn', async () => {
      if (await getAppleHealthConnectionStatus() !== 'connected') await connectAppleHealth();
      await selectProvider({
        authoritativeExpenditureProvider: 'apple_health',
        authoritativeActivityProvider: 'apple_health',
      });
      await refreshAppleHealthForCurrentAccount({ trigger: 'provider_reconnect', dayCount: 8 });
      const providers = await fetchProviderSelection();
      if (role === 'expenditure' && providers.expenditure.status !== 'ready') {
        setMessageTone('attention');
        setMessage('CalorieBank hasn’t found complete Apple Health burn data yet. Refresh Apple Health to check again.');
        return;
      }
    });
  }

  async function selectAppleHealthIntakeWriter(writer: AppleHealthIntakeWriter) {
    await selectProvider({
      authoritativeIntakeProvider: 'apple_health',
      appleHealthIntakeWriter: {
        bundleIdentifier: writer.bundleIdentifier,
        displayName: writer.displayName,
      },
    });
    await refreshAppleHealthForCurrentAccount({ trigger: 'provider_reconnect', dayCount: 8 });
    const providers = await fetchProviderSelection();
    if (providers.intake.status !== 'ready') {
      setMessageTone('attention');
      setMessage(`${writer.displayName} data is still being loaded from Apple Health. Refresh Apple Health to check again.`);
      return;
    }
  }

  async function connectAppleIntakeTracker(tracker: KnownFoodTracker) {
    await run(`apple-intake:${tracker}`, async () => {
      if (await getAppleHealthConnectionStatus() !== 'connected') await connectAppleHealth();
      await refreshAppleHealthForCurrentAccount({ trigger: 'provider_reconnect', dayCount: 8 });
      const writers = await discoverAppleHealthIntakeWriters();
      const writer = resolveKnownFoodTracker(tracker, writers);
      const trackerName = {
        cronometer: 'Cronometer', myfitnesspal: 'MyFitnessPal',
        lose_it: 'Lose It!', macrofactor: 'MacroFactor',
      }[tracker];
      if (!writer) {
        setMessageTone('attention');
        setMessage(`No food data was found from ${trackerName} yet. Refresh Apple Health to check again.`);
        return;
      }
      await selectAppleHealthIntakeWriter(writer);
    });
  }

  async function discoverOtherAppleHealthWriters() {
    await run('apple-intake:other', async () => {
      if (await getAppleHealthConnectionStatus() !== 'connected') await connectAppleHealth();
      const writers = await discoverAppleHealthIntakeWriters();
      if (writers.length === 0) {
        throw new Error('No calorie data was found from an app using Apple Health.');
      }
      setDiscoveredIntakeWriters(writers);
    });
  }

  async function selectDiscoveredWriter(writer: AppleHealthIntakeWriter) {
    await run(`apple-intake:${writer.bundleIdentifier}`, () => selectAppleHealthIntakeWriter(writer));
  }

  async function retrySelectedSource(role: 'expenditure' | 'intake') {
    const selected = status?.[role];
    if (!selected) return;
    if (selected.provider === 'apple_health') {
      await run(role === 'expenditure' ? 'apple-burn' : 'apple-intake:retry', async () => {
        const outcome = await refreshAppleHealthForCurrentAccount({ trigger: 'manual_refresh', dayCount: 8 });
        if (!outcome || outcome.syncStatus === 'failure') throw new Error('Apple Health refresh failed.');
      });
      return;
    }
    await run(selected.provider === 'fatsecret' ? 'fatsecret' : 'fitbit', () =>
      selected.provider === 'fatsecret'
        ? syncFatSecret(Intl.DateTimeFormat().resolvedOptions().timeZone, true)
        : syncFitbit(Intl.DateTimeFormat().resolvedOptions().timeZone, true));
  }

  async function prepareBank() {
    await run('preparing', async () => {
      const providers = await fetchProviderSelection();
      const plan = initialImportPlan(providers);
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const requests: Promise<unknown>[] = [];
      if (plan.fitbit) {
        requests.push(syncFitbit(timezone, true, true));
      }
      if (plan.fatSecret) {
        requests.push(syncFatSecret(timezone, true, true));
      }
      if (plan.appleHealth) {
        requests.push(refreshAppleHealthForCurrentAccount({ trigger: 'manual_refresh', dayCount: 8 }).then((outcome) => {
          if (!outcome || outcome.syncStatus === 'failure') {
            throw new Error('Apple Health refresh failed.');
          }
          return outcome;
        }));
      }
      const results = await Promise.allSettled(requests);
      setPreparationAttempted(true);
      const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
      if (failed) throw failed.reason;
    });
  }

  useEffect(() => {
    if (status?.stage === 'preparing_bank' && busy === null && !preparationAttempted) void prepareBank();
    // Run once when the user enters preparation. Further attempts are explicit refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.stage, preparationAttempted]);

  if (!status || busy === 'loading') {
    return <CenteredState title="Loading setup…" detail="Checking your saved progress." />;
  }

  const activeStage = displayStage ?? status.stage;
  const progress = stageNumber[activeStage];
  const expenditureWaiting = sourceNeedsData(status.expenditure);
  const intakeWaiting = sourceNeedsData(status.intake);
  const stageContent = (() => {
    switch (activeStage) {
      case 'welcome':
        return <>
          <Text style={styles.eyebrow}>Welcome to CalorieBank</Text>
          <Text style={styles.title}>Eat what you love. Stay on track.</Text>
          <Text style={styles.detail}>CalorieBank turns calories you save into a balance you can use later.</Text>
          <PrimaryButton busy={busy !== null} label="Get started" onPress={() => void run('complete', completeOnboardingWelcome)} />
        </>;
      case 'calories_burned':
        return <>
          <Text style={styles.title}>What do you use to track your activity?</Text>
          <Text style={styles.detail}>Choose the device that tracks your daily calorie burn.</Text>
          {expenditureWaiting ? <WaitingForData
            busy={busy !== null}
            source={status.expenditure.provider === 'apple_health' ? 'Apple Health' : status.expenditure.displayName}
            detail="Your connection is saved. CalorieBank is waiting for a complete daily calorie-burn total."
            onRetry={() => void retrySelectedSource('expenditure')}
          /> : <>
          {Platform.OS === 'ios' ? <ProviderOption title="Apple Watch" detail="CalorieBank securely reads its activity data through Apple Health." busy={busy === 'apple-burn'} disabled={busy !== null} connected={status.expenditure.provider === 'apple_health' && status.expenditure.connected} onPress={() => void connectApple('expenditure')} /> : null}
          <ProviderOption title="Fitbit" detail="Uses your Fitbit calorie burn, steps, and workouts." busy={busy === 'fitbit'} disabled={busy !== null} connected={status.expenditure.provider === 'google_health_fitbit' && status.expenditure.connected} onPress={() => void connectFitbit()} />
          {providerState?.connectedProviders.some((provider) => provider.provider === 'google_health_fitbit' && provider.status === 'connected') && status.expenditure.provider !== 'google_health_fitbit' ? (
            <PrimaryButton busy={busy !== null} label="Use connected Fitbit" onPress={() => void run('fitbit', async () => {
              await selectProvider({ authoritativeExpenditureProvider: 'google_health_fitbit', authoritativeActivityProvider: 'google_health_fitbit' });
              await syncFitbit(Intl.DateTimeFormat().resolvedOptions().timeZone, true);
            })} />
          ) : null}
          <BackButton onPress={() => setDisplayStage(previousSetupStage(activeStage))} />
          </>}
        </>;
      case 'calories_eaten':
        return <>
          <Text style={styles.title}>Where do you track your food?</Text>
          <Text style={styles.detail}>Choose one source for your daily calorie total.</Text>
          {intakeWaiting ? <WaitingForData
            busy={busy !== null}
            source={status.intake.displayName}
            detail="Your connection is saved. CalorieBank is waiting for a daily calorie total from this source."
            onRetry={() => void retrySelectedSource('intake')}
          /> : <>
          {Platform.OS === 'ios' ? <>
            <Text style={styles.sectionLabel}>Apps that share through Apple Health</Text>
            <ProviderOption title="MyFitnessPal" detail="Connect through Apple Health." busy={busy === 'apple-intake:myfitnesspal'} disabled={busy !== null} connected={selectedAppleHealthWriter(providerState, 'MyFitnessPal')} onPress={() => void connectAppleIntakeTracker('myfitnesspal')} />
            <ProviderOption title="Cronometer" detail="Connect through Apple Health." busy={busy === 'apple-intake:cronometer'} disabled={busy !== null} connected={selectedAppleHealthWriter(providerState, 'Cronometer')} onPress={() => void connectAppleIntakeTracker('cronometer')} />
            <ProviderOption title="Lose It!" detail="Connect through Apple Health." busy={busy === 'apple-intake:lose_it'} disabled={busy !== null} connected={selectedAppleHealthWriter(providerState, 'Lose It!')} onPress={() => void connectAppleIntakeTracker('lose_it')} />
            <ProviderOption title="MacroFactor" detail="Connect through Apple Health." busy={busy === 'apple-intake:macrofactor'} disabled={busy !== null} connected={selectedAppleHealthWriter(providerState, 'MacroFactor')} onPress={() => void connectAppleIntakeTracker('macrofactor')} />
            <ProviderOption title="Another app using Apple Health" detail="Choose an app that shares your daily calories." busy={busy === 'apple-intake:other'} disabled={busy !== null} onPress={() => void discoverOtherAppleHealthWriters()} />
            {discoveredIntakeWriters.map((writer, index) => (
              <ProviderOption
                key={writer.bundleIdentifier}
                title={writer.displayName === 'Apple Health app' ? `Apple Health app ${index + 1}` : writer.displayName}
                detail="Use this app for calories eaten."
                busy={busy === `apple-intake:${writer.bundleIdentifier}`}
                disabled={busy !== null}
                connected={providerState?.intake.writerBundleIdentifier === writer.bundleIdentifier}
                onPress={() => void selectDiscoveredWriter(writer)}
              />
            ))}
          </> : null}
          <Text style={styles.sectionLabel}>Direct connection</Text>
          <ProviderOption title="FatSecret" detail="Connect your existing FatSecret food diary directly." busy={busy === 'fatsecret'} disabled={busy !== null} connected={status.intake.provider === 'fatsecret' && status.intake.connected} onPress={() => void connectFatSecret()} />
          {providerState?.connectedProviders.some((provider) => provider.provider === 'fatsecret' && provider.status === 'connected') && status.intake.provider !== 'fatsecret' ? (
            <PrimaryButton busy={busy !== null} label="Use connected FatSecret" onPress={() => void run('fatsecret', async () => {
              await selectProvider({ authoritativeIntakeProvider: 'fatsecret' });
              await syncFatSecret(Intl.DateTimeFormat().resolvedOptions().timeZone, true);
            })} />
          ) : null}
          <BackButton onPress={() => setDisplayStage(previousSetupStage(activeStage))} />
          </>}
        </>;
      case 'goal':
        return <>
          <Text style={styles.title}>Choose your goal</Text>
          <Text style={styles.detail}>Tell CalorieBank how you want completed days calculated.</Text>
          <GoalConfigurationForm mode="onboarding" onSaved={() => { setDisplayStage(null); void refresh(); }} />
          <BackButton onPress={() => setDisplayStage(previousSetupStage(activeStage))} />
        </>;
      case 'preparing_bank':
        return <>
          {busy === 'preparing' ? <ActivityIndicator accessibilityLabel="Preparing your bank" color={colors.primary} size="large" /> : null}
          <Text style={styles.title}>Preparing your bank</Text>
          <Text style={styles.detail}>{busy === 'preparing' ? 'Checking your recent activity and nutrition data.' : 'Finish the source below to continue.'}</Text>
          <PreparationRow label="Calories burned" source={status.expenditure.displayName} state={status.preparation.expenditure} waitingLabel={status.expenditure.provider === 'apple_health' ? 'Waiting for Apple Health data' : undefined} />
          <PreparationRow label="Calories eaten" source={status.intake.displayName} state={status.preparation.intake} waitingLabel={status.intake.provider === 'apple_health' ? 'Waiting for Apple Health data' : undefined} />
          <PrimaryButton busy={busy === 'preparing'} label={status.expenditure.provider === 'apple_health' || status.intake.provider === 'apple_health' ? 'Refresh Apple Health' : 'Try again'} onPress={() => void prepareBank()} />
          <Pressable accessibilityRole="button" accessibilityLabel="Check connections" onPress={() => router.push({ pathname: '/integrations', params: { returnTo: 'onboarding' } })}><Text style={styles.linkText}>Check connections</Text></Pressable>
          <BackButton label="Edit setup" onPress={() => setDisplayStage(preparationEditStage(status))} />
        </>;
      case 'ready':
        return <>
          <Text style={styles.eyebrow}>Setup complete</Text>
          <Text style={styles.title}>Your bank is ready.</Text>
          <View accessibilityRole="summary" style={styles.balancePanel}>
            <Text style={styles.balanceLabel}>Starting balance</Text>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.balanceValue}>{status.openingBankCalories.toLocaleString()} kcal</Text>
          </View>
          {status.preparation.history === 'no_history'
            ? <Text style={styles.detail}>You’re ready. Your bank will start with your first completed day.</Text>
            : status.openingBankCalories === 0 ? <Text style={styles.detail}>Today’s a fresh start.</Text> : null}
          <PrimaryButton busy={busy === 'complete'} label="Go to Today" onPress={() => void run('complete', completeOnboarding)} />
        </>;
      case 'complete':
        return null;
    }
  })();

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {progress > 0 && progress < 5 ? <Text accessibilityLabel={`Setup step ${progress} of 4`} style={styles.progress}>Step {progress} of 4</Text> : null}
          {stageContent}
          {message ? <Text accessibilityLiveRegion="assertive" style={messageTone === 'attention' ? styles.attention : styles.error}>{message}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function CenteredState({ title, detail }: { title: string; detail: string }) {
  return <SafeAreaView style={styles.safeArea}><View style={styles.centered}><ActivityIndicator color={colors.primary} size="large" /><Text style={styles.title}>{title}</Text><Text style={styles.detail}>{detail}</Text></View></SafeAreaView>;
}

function PrimaryButton({ label, busy, onPress }: { label: string; busy: boolean; onPress: () => void }) {
  return <Pressable accessibilityLabel={label} accessibilityRole="button" disabled={busy} onPress={onPress} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, busy && styles.disabled]}>{busy ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryButtonText}>{label}</Text>}</Pressable>;
}

function ProviderOption({ title, detail, busy, disabled, connected = false, onPress }: { title: string; detail: string; busy: boolean; disabled: boolean; connected?: boolean; onPress: () => void }) {
  return <View style={[styles.providerCard, connected && styles.connectedCard]}><View style={styles.providerCopy}><Text style={styles.providerTitle}>{title}</Text><Text style={styles.note}>{connected ? 'Connected' : detail}</Text></View><Pressable accessibilityLabel={connected ? `${title} connected` : `Connect ${title}`} accessibilityRole="button" disabled={disabled || connected} onPress={onPress} style={({ pressed }) => [styles.connectButton, connected && styles.connectedButton, pressed && styles.pressed, disabled && !busy && styles.disabled]}>{busy ? <ActivityIndicator color={colors.surface} /> : <Text style={[styles.connectButtonText, connected && styles.connectedButtonText]}>{connected ? 'Connected' : 'Connect'}</Text>}</Pressable></View>;
}

function WaitingForData({ source, detail, busy, onRetry }: { source: string; detail: string; busy: boolean; onRetry: () => void }) {
  return <View style={styles.waitingCard}><Text style={styles.connectedLabel}>Connected</Text><Text style={styles.providerTitle}>{source}</Text><Text style={styles.note}>{detail}</Text><PrimaryButton busy={busy} label="Check again" onPress={onRetry} /></View>;
}

function BackButton({ label = 'Back', onPress }: { label?: string; onPress: () => void }) {
  return <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress}><Text style={styles.linkText}>{label}</Text></Pressable>;
}

function PreparationRow({ label, source, state, waitingLabel }: {
  label: string;
  source: string;
  state: OnboardingStatusResponse['preparation']['expenditure'];
  waitingLabel?: string;
}) {
  const stateLabel = state === 'complete' ? 'Ready' : state === 'retry_needed' ? 'Needs attention' : waitingLabel ?? 'Waiting for data';
  return <View style={styles.preparationRow}><Text style={styles.providerTitle}>{label}</Text><Text style={styles.note}>{source} · {stateLabel}</Text></View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background }, fill: { flex: 1 },
  container: { flexGrow: 1, gap: spacing.md, justifyContent: 'center', padding: spacing.lg, paddingBottom: spacing.xxl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  progress: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '700' },
  sectionLabel: { color: colors.text, fontSize: typography.caption, fontWeight: '800', marginTop: spacing.sm, textTransform: 'uppercase' },
  eyebrow: { color: colors.primaryDark, fontSize: typography.caption, fontWeight: '800', textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: typography.title, fontWeight: '800', lineHeight: 38 },
  detail: { color: colors.textMuted, fontSize: typography.body, lineHeight: 24 },
  note: { color: colors.textMuted, flexShrink: 1, fontSize: typography.caption, lineHeight: 19 },
  providerCard: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: 88, padding: spacing.md },
  connectedCard: { borderColor: colors.primary },
  providerCopy: { flex: 1, gap: spacing.xs }, providerTitle: { color: colors.text, fontSize: typography.subheading, fontWeight: '800' },
  connectButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.sm, justifyContent: 'center', minHeight: 48, minWidth: 92, paddingHorizontal: spacing.md },
  connectButtonText: { color: colors.surface, fontSize: typography.body, fontWeight: '700' },
  connectedButton: { backgroundColor: colors.background, borderColor: colors.primary, borderWidth: 1 },
  connectedButtonText: { color: colors.primaryDark },
  primaryButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.sm, justifyContent: 'center', marginTop: spacing.sm, minHeight: 52, paddingHorizontal: spacing.lg },
  primaryButtonText: { color: colors.surface, fontSize: typography.body, fontWeight: '800' },
  balancePanel: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, gap: spacing.xs, padding: spacing.lg },
  balanceLabel: { color: colors.textMuted, fontSize: typography.body, fontWeight: '700' }, balanceValue: { color: colors.text, fontSize: 38, fontWeight: '800' },
  preparationRow: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.sm, borderWidth: 1, gap: spacing.xs, padding: spacing.md },
  waitingCard: { backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: radii.md, borderWidth: 1, gap: spacing.sm, padding: spacing.lg },
  connectedLabel: { color: colors.primaryDark, fontSize: typography.caption, fontWeight: '800', textTransform: 'uppercase' },
  attention: { color: colors.accent, fontSize: typography.body, lineHeight: 22 }, error: { color: colors.danger, fontSize: typography.body, lineHeight: 22 }, pressed: { opacity: 0.72 }, disabled: { opacity: 0.65 },
  linkText: { color: colors.primaryDark, fontSize: typography.body, fontWeight: '700', textAlign: 'center' },
});
