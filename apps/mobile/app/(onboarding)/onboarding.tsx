import type { OnboardingStage, OnboardingStatusResponse, ProviderSelectionInput, ProviderSelectionResponse } from '@caloriebank/schemas';
import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  createOnboardingActionGate,
  onboardingRecoveryMessage,
  nextStageAfterSource,
  onboardingSourceState,
  preparationEditStage,
  previousSetupStage,
  providerIsConnected,
  selectedAppleHealthWriter,
  sourceActionIsPending,
  sourceSelectionSatisfiesOnboarding,
  withOnboardingTimeout,
} from '@/lib/onboarding/onboarding-recovery';

type AppleIntakeAction = `apple-intake:${KnownFoodTracker | 'other' | string}`;
type BusyAction = 'loading' | 'fitbit' | 'fatsecret' | 'apple-burn' | AppleIntakeAction | 'preparing' | 'complete' | null;
type SourceRole = 'expenditure' | 'intake';
type ActionOutcome = {
  message?: string;
  tone?: 'attention' | 'error';
  stayOnStage?: OnboardingStage;
} | void;

class OnboardingConsumerError extends Error {
  constructor(readonly consumerMessage: string) {
    super(consumerMessage);
    this.name = 'OnboardingConsumerError';
  }
}

function cancelledConnectionError() {
  const error = new Error('Connection cancelled');
  error.name = 'AbortError';
  return error;
}

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
  const [initialLoadFailed, setInitialLoadFailed] = useState(false);
  const [preparationAttempted, setPreparationAttempted] = useState(false);
  const [displayStage, setDisplayStage] = useState<OnboardingStage | null>(null);
  const [editingRole, setEditingRole] = useState<SourceRole | null>(null);
  const [discoveredIntakeWriters, setDiscoveredIntakeWriters] =
    useState<AppleHealthIntakeWriter[]>([]);
  const actionGate = useRef(createOnboardingActionGate());

  const refresh = useCallback(async () => {
    try {
      const [next, providers] = await Promise.all([
        fetchOnboardingStatus(),
        fetchProviderSelection(),
      ]);
      setStatus(next);
      setProviderState(providers);
      setInitialLoadFailed(false);
      if (next.completed) router.replace('/today');
      return next;
    } catch {
      setInitialLoadFailed(true);
      setMessage('Setup could not refresh. Check your connection and try again.');
      return null;
    }
  }, [router]);

  useFocusEffect(useCallback(() => {
    if (actionGate.current.isActive()) return;
    setBusy((current) => current ?? 'loading');
    void refresh().finally(() => setBusy(null));
  }, [refresh]));

  async function run(action: Exclude<BusyAction, 'loading' | null>, work: () => Promise<ActionOutcome>) {
    if (!actionGate.current.begin(action)) return;
    setBusy(action);
    setMessage(null);
    setMessageTone('error');
    try {
      const outcome = await work();
      if (action !== 'preparing') setPreparationAttempted(false);
      await refresh();
      setDisplayStage(outcome?.stayOnStage ?? null);
      setEditingRole(null);
      if (outcome?.message) {
        setMessageTone(outcome.tone ?? 'attention');
        setMessage(outcome.message);
      }
    } catch (error) {
      // OAuth or provider sync can persist a connection before a later refresh fails.
      // Reload server truth before presenting recovery so connected sources never look lost.
      await refresh().catch(() => null);
      setEditingRole(null);
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
        error instanceof Error && error.message === 'ONBOARDING_OPERATION_TIMEOUT'
          ? 'This is taking longer than expected. Try again; your saved connection will not be lost.'
          : error instanceof OnboardingConsumerError
          ? error.consumerMessage
          : error instanceof ProviderAuthorizationError && error.code === 'INVALID_REDIRECT'
          ? `${action === 'fatsecret' ? 'FatSecret' : 'Fitbit'} could not start because its return address is invalid. Try again.`
          : error instanceof ProviderAuthorizationError && error.code === 'CONFIGURATION_ERROR'
            ? `${action === 'fatsecret' ? 'FatSecret' : 'Fitbit'} is temporarily unavailable. Try again later.`
            : error instanceof ProviderAuthorizationError && error.code === 'ALREADY_CONNECTED'
              ? `${action === 'fatsecret' ? 'FatSecret' : 'Fitbit'} is already connected. Use the saved connection instead of reconnecting.`
            : error instanceof Error && (
              error.message.startsWith('Fitbit is connected') ||
              error.message.startsWith('FatSecret is connected')
            )
              ? error.message
            : recoveryMessage,
      );
    } finally {
      actionGate.current.end(action);
      setBusy(null);
    }
  }

  function showStage(stage: OnboardingStage | null, editRole: SourceRole | null = null) {
    setMessage(null);
    setDisplayStage(stage);
    setEditingRole(editRole);
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
      if (result.type !== 'success') throw cancelledConnectionError();
      await selectProvider({
        authoritativeExpenditureProvider: 'google_health_fitbit',
        authoritativeActivityProvider: 'google_health_fitbit',
      });
      try {
        await syncFitbit(Intl.DateTimeFormat().resolvedOptions().timeZone, true);
      } catch {
        return {
          stayOnStage: 'calories_burned',
          tone: 'attention',
          message: 'Fitbit is connected. Calorie-burn data is not ready yet, but you can continue setup.',
        };
      }
    });
  }

  async function connectFatSecret() {
    await run('fatsecret', async () => {
      const redirect = MOBILE_INTEGRATION_REDIRECT_URI;
      const { authorizationUrl } = await startFatSecretAuthorization(redirect);
      const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, redirect);
      if (result.type !== 'success') throw cancelledConnectionError();
      await selectProvider({ authoritativeIntakeProvider: 'fatsecret' });
      try {
        await syncFatSecret(Intl.DateTimeFormat().resolvedOptions().timeZone, true);
      } catch {
        return {
          stayOnStage: 'calories_eaten',
          tone: 'attention',
          message: 'FatSecret is connected. Food data is not ready yet, but you can continue setup.',
        };
      }
    });
  }

  async function connectApple(role: 'expenditure') {
    await run('apple-burn', async () => {
      if (await getAppleHealthConnectionStatus() !== 'connected') {
        const connection = await connectAppleHealth();
        if (connection !== 'connected') {
          throw new OnboardingConsumerError('Apple Health is not available on this device. Choose Fitbit or try again later.');
        }
      }
      await selectProvider({
        authoritativeExpenditureProvider: 'apple_health',
        authoritativeActivityProvider: 'apple_health',
      });
      await withOnboardingTimeout(
        refreshAppleHealthForCurrentAccount({ trigger: 'provider_reconnect', dayCount: 8 }),
      );
      const providers = await fetchProviderSelection();
      if (role === 'expenditure' && providers.expenditure.status !== 'ready') {
        return {
          stayOnStage: 'calories_burned',
          tone: 'attention',
          message: 'Apple Health is connected. CalorieBank hasn’t found a complete calorie-burn total yet, but you can continue setup.',
        };
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
    await withOnboardingTimeout(
      refreshAppleHealthForCurrentAccount({ trigger: 'provider_reconnect', dayCount: 8 }),
    );
    const providers = await fetchProviderSelection();
    if (providers.intake.status !== 'ready') {
      return {
        stayOnStage: 'calories_eaten' as const,
        tone: 'attention' as const,
        message: `${writer.displayName} is connected. CalorieBank will use its calories when they appear in Apple Health.`,
      };
    }
  }

  async function connectAppleIntakeTracker(tracker: KnownFoodTracker) {
    await run(`apple-intake:${tracker}`, async () => {
      if (await getAppleHealthConnectionStatus() !== 'connected') {
        const connection = await connectAppleHealth();
        if (connection !== 'connected') {
          throw new OnboardingConsumerError('Apple Health is not available on this device. Choose FatSecret or try again later.');
        }
      }
      await withOnboardingTimeout(
        refreshAppleHealthForCurrentAccount({ trigger: 'provider_reconnect', dayCount: 8 }),
      );
      const writers = await withOnboardingTimeout(discoverAppleHealthIntakeWriters());
      const writer = resolveKnownFoodTracker(tracker, writers);
      const trackerName = {
        cronometer: 'Cronometer', myfitnesspal: 'MyFitnessPal',
        lose_it: 'Lose It!', macrofactor: 'MacroFactor',
      }[tracker];
      if (!writer) {
        return {
          stayOnStage: 'calories_eaten',
          tone: 'attention',
          message: `No calories from ${trackerName} were found in Apple Health yet. Check again after ${trackerName} has shared food data, or choose another source.`,
        };
      }
      return selectAppleHealthIntakeWriter(writer);
    });
  }

  async function discoverOtherAppleHealthWriters() {
    await run('apple-intake:other', async () => {
      if (await getAppleHealthConnectionStatus() !== 'connected') {
        const connection = await connectAppleHealth();
        if (connection !== 'connected') {
          throw new OnboardingConsumerError('Apple Health is not available on this device. Choose FatSecret or try again later.');
        }
      }
      const writers = await withOnboardingTimeout(discoverAppleHealthIntakeWriters());
      if (writers.length === 0) {
        return {
          stayOnStage: 'calories_eaten',
          tone: 'attention',
          message: 'No food apps with calorie data were found in Apple Health yet. Check again later or choose FatSecret.',
        };
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
        const outcome = await withOnboardingTimeout(
          refreshAppleHealthForCurrentAccount({ trigger: 'manual_refresh', dayCount: 8 }),
        );
        if (!outcome || outcome.syncStatus === 'failure') throw new Error('Apple Health refresh failed.');
        const providers = await fetchProviderSelection();
        const selectedRole = role === 'expenditure' ? providers.expenditure : providers.intake;
        if (selectedRole.status !== 'ready') {
          return {
            stayOnStage: role === 'expenditure' ? 'calories_burned' : 'calories_eaten',
            tone: 'attention',
            message: role === 'expenditure'
              ? 'No complete calorie-burn total was found yet. Apple Health is still connected, and you can continue setup.'
              : `No new calorie total was found yet. ${status?.intake.displayName ?? 'Your food source'} is still connected, and you can continue setup.`,
          };
        }
      });
      return;
    }
    await run(selected.provider === 'fatsecret' ? 'fatsecret' : 'fitbit', async () => {
      if (selected.provider === 'fatsecret') {
        await syncFatSecret(Intl.DateTimeFormat().resolvedOptions().timeZone, true);
      } else {
        await syncFitbit(Intl.DateTimeFormat().resolvedOptions().timeZone, true);
      }
      const providers = await fetchProviderSelection();
      const selectedRole = role === 'expenditure' ? providers.expenditure : providers.intake;
      if (selectedRole.status !== 'ready') {
        return {
          stayOnStage: role === 'expenditure' ? 'calories_burned' : 'calories_eaten',
          tone: 'attention',
          message: `${selected.displayName} is connected. No new calorie data was found yet, and you can continue setup.`,
        };
      }
    });
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
        requests.push(withOnboardingTimeout(
          refreshAppleHealthForCurrentAccount({ trigger: 'manual_refresh', dayCount: 8 }),
        ).then((outcome) => {
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

  if (!status && initialLoadFailed && busy !== 'loading') {
    return <SetupLoadError onRetry={() => {
      setBusy('loading');
      void refresh().finally(() => setBusy(null));
    }} />;
  }

  if (!status || busy === 'loading') {
    return <CenteredState title="Loading setup…" detail="Checking your saved progress." />;
  }

  const activeStage = displayStage ?? status.stage;
  const progress = stageNumber[activeStage];
  const fitbitConnected = providerIsConnected(providerState, 'google_health_fitbit');
  const fatSecretConnected = providerIsConnected(providerState, 'fatsecret');
  const expenditureActionActive = busy === 'apple-burn' || busy === 'fitbit';
  const intakeActionActive = busy === 'fatsecret' || busy?.startsWith('apple-intake:') === true;
  const expenditureState = onboardingSourceState({
    source: status.expenditure,
    operation: expenditureActionActive
      ? status.expenditure.connected ? 'refreshing' : 'connecting'
      : null,
    recoverableError: false,
  });
  const intakeState = onboardingSourceState({
    source: status.intake,
    operation: intakeActionActive
      ? status.intake.connected ? 'refreshing' : 'connecting'
      : null,
    recoverableError: false,
  });
  const stageContent = (() => {
    switch (activeStage) {
      case 'welcome':
        return <>
          <Text style={styles.eyebrow}>Welcome to CalorieBank</Text>
          <Text style={styles.title}>Eat what you love. Stay on track.</Text>
          <Text style={styles.detail}>CalorieBank turns calories you save into a balance you can use later.</Text>
          <PrimaryButton busy={busy === 'complete'} label="Get started" onPress={() => void run('complete', async () => { await completeOnboardingWelcome(); })} />
        </>;
      case 'calories_burned':
        return <>
          <Text style={styles.title}>What do you use to track your activity?</Text>
          <Text style={styles.detail}>Choose the device that tracks your daily calorie burn.</Text>
          {status.expenditure.connected && editingRole !== 'expenditure' ? <ConnectedSource
            busy={expenditureActionActive}
            canContinue={sourceSelectionSatisfiesOnboarding(status.expenditure)}
            source={status.expenditure.provider === 'apple_health' ? 'Apple Health' : status.expenditure.displayName}
            state={expenditureState}
            waitingDetail="CalorieBank will use this source when a complete calorie-burn total is available."
            onBack={() => showStage(previousSetupStage(activeStage))}
            onChange={() => showStage('calories_burned', 'expenditure')}
            onContinue={() => showStage(nextStageAfterSource('expenditure'))}
            onRetry={() => void retrySelectedSource('expenditure')}
          /> : <>
          {Platform.OS === 'ios' ? <ProviderOption title="Apple Watch" detail="CalorieBank securely reads its activity data through Apple Health." busy={sourceActionIsPending(busy, 'apple-burn')} disabled={busy !== null} connected={status.expenditure.provider === 'apple_health' && status.expenditure.connected} onPress={() => void connectApple('expenditure')} /> : null}
          <ProviderOption title="Fitbit" detail="Uses your Fitbit calorie burn, steps, and workouts." busy={sourceActionIsPending(busy, 'fitbit')} disabled={busy !== null} connected={fitbitConnected} onPress={() => void connectFitbit()} />
          {fitbitConnected && status.expenditure.provider !== 'google_health_fitbit' ? (
            <PrimaryButton busy={busy !== null} label="Use connected Fitbit" onPress={() => void run('fitbit', async () => {
              await selectProvider({ authoritativeExpenditureProvider: 'google_health_fitbit', authoritativeActivityProvider: 'google_health_fitbit' });
              await syncFitbit(Intl.DateTimeFormat().resolvedOptions().timeZone, true);
            })} />
          ) : null}
          <BackButton onPress={() => showStage(previousSetupStage(activeStage))} />
          </>}
        </>;
      case 'calories_eaten':
        return <>
          <Text style={styles.title}>Where do you track your food?</Text>
          <Text style={styles.detail}>Choose one source for your daily calorie total.</Text>
          {status.intake.connected && editingRole !== 'intake' ? <ConnectedSource
            busy={intakeActionActive}
            canContinue={sourceSelectionSatisfiesOnboarding(status.intake)}
            source={status.intake.displayName}
            state={intakeState}
            waitingDetail={`CalorieBank will use calories from ${status.intake.displayName} when they appear${status.intake.provider === 'apple_health' ? ' in Apple Health' : ''}.`}
            onBack={() => showStage(previousSetupStage(activeStage))}
            onChange={() => showStage('calories_eaten', 'intake')}
            onContinue={() => showStage(nextStageAfterSource('intake'))}
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
          <ProviderOption title="FatSecret" detail="Connect your existing FatSecret food diary directly." busy={busy === 'fatsecret'} disabled={busy !== null} connected={fatSecretConnected} onPress={() => void connectFatSecret()} />
          {fatSecretConnected && status.intake.provider !== 'fatsecret' ? (
            <PrimaryButton busy={busy !== null} label="Use connected FatSecret" onPress={() => void run('fatsecret', async () => {
              await selectProvider({ authoritativeIntakeProvider: 'fatsecret' });
              await syncFatSecret(Intl.DateTimeFormat().resolvedOptions().timeZone, true);
            })} />
          ) : null}
          <BackButton onPress={() => showStage(previousSetupStage(activeStage))} />
          </>}
        </>;
      case 'goal':
        return <>
          <Text style={styles.title}>Choose your goal</Text>
          <Text style={styles.detail}>Tell CalorieBank how you want completed days calculated.</Text>
          <GoalConfigurationForm mode="onboarding" onSaved={() => { setDisplayStage(null); void refresh(); }} />
          <BackButton onPress={() => showStage(previousSetupStage(activeStage))} />
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
          <BackButton label="Edit setup" onPress={() => showStage(preparationEditStage(status))} />
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
          <PrimaryButton busy={busy === 'complete'} label="Go to Today" onPress={() => void run('complete', async () => { await completeOnboarding(); })} />
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

function SetupLoadError({ onRetry }: { onRetry: () => void }) {
  return <SafeAreaView style={styles.safeArea}><View style={styles.centered}><Text style={styles.title}>Unable to load setup</Text><Text style={styles.detail}>Check your internet connection and try again.</Text><PrimaryButton busy={false} label="Try again" onPress={onRetry} /></View></SafeAreaView>;
}

function PrimaryButton({ label, busy, onPress }: { label: string; busy: boolean; onPress: () => void }) {
  return <Pressable accessibilityLabel={label} accessibilityRole="button" disabled={busy} onPress={onPress} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, busy && styles.disabled]}>{busy ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryButtonText}>{label}</Text>}</Pressable>;
}

function ProviderOption({ title, detail, busy, disabled, connected = false, onPress }: { title: string; detail: string; busy: boolean; disabled: boolean; connected?: boolean; onPress: () => void }) {
  return <View style={[styles.providerCard, connected && styles.connectedCard]}><View style={styles.providerCopy}><Text style={styles.providerTitle}>{title}</Text><Text style={styles.note}>{connected ? 'Connected' : detail}</Text></View><Pressable accessibilityLabel={connected ? `${title} connected` : `Connect ${title}`} accessibilityRole="button" disabled={disabled || connected} onPress={onPress} style={({ pressed }) => [styles.connectButton, connected && styles.connectedButton, pressed && styles.pressed, disabled && !busy && styles.disabled]}>{busy ? <ActivityIndicator color={colors.surface} /> : <Text style={[styles.connectButtonText, connected && styles.connectedButtonText]}>{connected ? 'Connected' : 'Connect'}</Text>}</Pressable></View>;
}

function ConnectedSource({
  source,
  state,
  waitingDetail,
  busy,
  canContinue,
  onContinue,
  onRetry,
  onChange,
  onBack,
}: {
  source: string;
  state: ReturnType<typeof onboardingSourceState>;
  waitingDetail: string;
  busy: boolean;
  canContinue: boolean;
  onContinue: () => void;
  onRetry: () => void;
  onChange: () => void;
  onBack: () => void;
}) {
  const needsAttention = state === 'needs_attention' || state === 'recoverable_error';
  const detail = busy
    ? `Checking ${source}…`
    : state === 'connected_ready'
      ? 'Connected and ready.'
      : needsAttention
        ? `${source} needs attention before it can be used.`
        : waitingDetail;
  return <>
    <View style={styles.waitingCard}>
      <Text style={styles.connectedLabel}>Connected</Text>
      <Text style={styles.providerTitle}>{source}</Text>
      <Text accessibilityLiveRegion="polite" style={styles.note}>{detail}</Text>
      {canContinue && !busy ? <PrimaryButton busy={false} label="Continue" onPress={onContinue} /> : null}
      <SecondaryButton busy={busy} label={needsAttention ? 'Try again' : 'Check again'} onPress={onRetry} />
      <Pressable accessibilityLabel="Choose a different source" accessibilityRole="button" disabled={busy} onPress={onChange} style={({ pressed }) => [styles.linkButton, pressed && styles.pressed, busy && styles.disabled]}>
        <Text style={styles.linkText}>Choose a different source</Text>
      </Pressable>
    </View>
    <BackButton onPress={onBack} />
  </>;
}

function SecondaryButton({ label, busy, onPress }: { label: string; busy: boolean; onPress: () => void }) {
  return <Pressable accessibilityLabel={label} accessibilityRole="button" disabled={busy} onPress={onPress} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed, busy && styles.disabled]}>{busy ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.secondaryButtonText}>{label}</Text>}</Pressable>;
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
  secondaryButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: radii.sm, borderWidth: 1, justifyContent: 'center', minHeight: 52, paddingHorizontal: spacing.lg },
  secondaryButtonText: { color: colors.primaryDark, fontSize: typography.body, fontWeight: '800' },
  balancePanel: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, gap: spacing.xs, padding: spacing.lg },
  balanceLabel: { color: colors.textMuted, fontSize: typography.body, fontWeight: '700' }, balanceValue: { color: colors.text, fontSize: 38, fontWeight: '800' },
  preparationRow: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.sm, borderWidth: 1, gap: spacing.xs, padding: spacing.md },
  waitingCard: { backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: radii.md, borderWidth: 1, gap: spacing.sm, padding: spacing.lg },
  linkButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  connectedLabel: { color: colors.primaryDark, fontSize: typography.caption, fontWeight: '800', textTransform: 'uppercase' },
  attention: { color: colors.accent, fontSize: typography.body, lineHeight: 22 }, error: { color: colors.danger, fontSize: typography.body, lineHeight: 22 }, pressed: { opacity: 0.72 }, disabled: { opacity: 0.65 },
  linkText: { color: colors.primaryDark, fontSize: typography.body, fontWeight: '700', textAlign: 'center' },
});
