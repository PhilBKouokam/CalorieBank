import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

import { colors, radii, spacing, typography } from '@/constants/caloriebank-theme';
import { connectAppleHealth, getAppleHealthDiagnostics, getAppleHealthConnectionStatus, refreshAppleHealthForCurrentAccount, syncAppleHealthToday } from '@/lib/healthkit/healthkit-connection';
import { deriveAppleHealthBurnState, deriveAppleHealthPresentationState, type AppleHealthBurnState, type AppleHealthPresentationState } from '@/lib/healthkit/healthkit-diagnostics';
import { composeAppleHealthConnections } from '@/lib/healthkit/health-connections-presentation';
import { ApiHttpError, disconnectFatSecret, disconnectFitbit, fetchHealthConnections, fetchProviderSelection, saveProviderSelection, selectHealthConnectionRole, startFatSecretAuthorization, startFitbitAuthorization, syncFatSecret, syncFitbit } from '@/lib/api/client';
import { discoverAppleHealthIntakeWriters, type AppleHealthIntakeWriter } from '@/lib/healthkit/apple-health-intake-writers';
import type { HealthConnectionOption, HealthConnectionsResponse } from '@caloriebank/schemas';

type Role = 'burned' | 'eaten';
type ServiceName = 'Apple Health' | 'Fitbit' | 'FatSecret';
type AppleState = AppleHealthPresentationState | 'loading' | 'requesting' | 'syncing';
type InventoryItem = HealthConnectionOption & { selected: boolean; serviceName: ServiceName };
const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

function statusCopy(status: HealthConnectionOption['status']) {
  if (status === 'connected') return 'Connected';
  if (status === 'needs_attention') return 'Needs attention';
  if (status === 'no_data') return 'No data yet';
  return 'Not connected';
}

function roleError(option?: HealthConnectionOption) {
  if (option?.label === 'Fitbit') return 'Fitbit needs to be reconnected before you can use it.';
  if (option?.label === 'FatSecret') return 'FatSecret needs to be reconnected before you can use it.';
  if (option?.transportLabel === 'Apple Health') return `${option.label} data is no longer available from Apple Health.`;
  if (option?.label === 'Apple Health') return 'Apple Health data is unavailable right now.';
  return 'Couldn’t change the source. Try again.';
}

export default function IntegrationsScreen() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const [connections, setConnections] = useState<HealthConnectionsResponse | null>(null);
  const [appleState, setAppleState] = useState<AppleState>('loading');
  const [appleBurnState, setAppleBurnState] = useState<AppleHealthBurnState>('needs_refresh');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<'attention' | 'error' | 'success'>('error');
  const [roleSheet, setRoleSheet] = useState<Role | null>(null);
  const [addRole, setAddRole] = useState<Role | null>(null);
  const [service, setService] = useState<ServiceName | null>(null);
  const [intakeWriters, setIntakeWriters] = useState<AppleHealthIntakeWriter[]>([]);
  const diagnosticsOpening = useRef(false);
  const reopenAppleHealthDetails = useRef(false);

  useFocusEffect(useCallback(() => {
    diagnosticsOpening.current = false;
    if (reopenAppleHealthDetails.current) {
      reopenAppleHealthDetails.current = false;
      setService('Apple Health');
    }
  }, []));

  const load = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    const [healthConnections, localStatus, diagnostics] = await Promise.all([
      fetchHealthConnections(), getAppleHealthConnectionStatus(), getAppleHealthDiagnostics(),
    ]);
    setConnections(healthConnections);
    setAppleState(deriveAppleHealthPresentationState(localStatus, diagnostics));
    setAppleBurnState(deriveAppleHealthBurnState(localStatus, diagnostics));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(true).catch(() => { setMessage('Health connections couldn’t load. Try again.'); setLoading(false); });
  }, [load]);

  const appleUsable = appleState === 'connected' || appleState === 'connected_partial' || appleState === 'syncing';
  const displayConnections = useMemo(() => {
    return connections ? composeAppleHealthConnections(connections, appleState, appleBurnState) : null;
  }, [appleBurnState, appleState, connections]);
  const burnSources = useMemo(() => buildInventory('burned', displayConnections), [displayConnections]);
  const intakeSources = useMemo(() => buildInventory('eaten', displayConnections), [displayConnections]);

  function closeSheets() { setRoleSheet(null); setAddRole(null); setIntakeWriters([]); setMessage(null); }

  async function selectRole(role: Role, option: HealthConnectionOption) {
    if (connections?.[role].selected?.optionId === option.optionId) return;
    setBusy(`select-${role}`); setMessage(null);
    try {
      const result = await selectHealthConnectionRole(role, option.optionId);
      setConnections(result);
      closeSheets();
      void load().catch(() => undefined);
    } catch { setMessage(roleError(option)); }
    finally { setBusy(null); }
  }

  async function selectConnectedLabel(role: Role, label: string) {
    const next = await fetchHealthConnections();
    setConnections(next);
    const option = [next[role].selected, ...next[role].alternatives].find((item) => item?.label === label);
    if (!option) throw new Error('Connected source was not selectable.');
    if (next[role].selected?.optionId !== option.optionId) setConnections(await selectHealthConnectionRole(role, option.optionId));
  }

  async function connectFitbitForBurn() {
    setBusy('connect-fitbit'); setMessage(null);
    try {
      const { authorizationUrl } = await startFitbitAuthorization();
      const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, 'caloriebank://integrations');
      if (result.type !== 'success') { setMessage('Fitbit connection was not completed.'); return; }
      await syncFitbit(timezone(), true);
      await selectConnectedLabel('burned', 'Fitbit');
      closeSheets(); void load().catch(() => undefined);
    } catch { setMessage('Fitbit couldn’t connect. Try again.'); }
    finally { setBusy(null); }
  }

  async function connectFatSecretForEaten() {
    setBusy('connect-fatsecret'); setMessage(null);
    try {
      const { authorizationUrl } = await startFatSecretAuthorization();
      const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, 'caloriebank://integrations');
      if (result.type !== 'success') { setMessage('FatSecret connection was not completed.'); return; }
      await syncFatSecret(timezone(), true);
      await selectConnectedLabel('eaten', 'FatSecret');
      closeSheets(); void load().catch(() => undefined);
    } catch { setMessage('FatSecret couldn’t connect. Try again.'); }
    finally { setBusy(null); }
  }

  async function connectAppleHealthForBurn() {
    setBusy('connect-apple-burned'); setAppleState('syncing'); setMessage(null);
    try {
      const outcome = await refreshAppleHealthForCurrentAccount({ trigger: 'provider_reconnect' });
      if (!outcome) throw new Error('Health access unavailable.');
      const [localStatus, diagnostics] = await Promise.all([
        getAppleHealthConnectionStatus(), getAppleHealthDiagnostics(),
      ]);
      const burnState = deriveAppleHealthBurnState(localStatus, diagnostics);
      setAppleBurnState(burnState);
      if (burnState === 'refresh_failed' || burnState === 'needs_attention') {
        throw new Error('Apple Health burn refresh failed.');
      }
      if (burnState !== 'ready') {
        setMessageTone('attention');
        setMessage('Apple Health refreshed. No calorie-burn data was found.');
        await load();
        return;
      }
      await selectConnectedLabel('burned', 'Apple Health');
      closeSheets(); void load().catch(() => undefined);
    } catch { setMessageTone('error'); setMessage('Apple Health couldn’t refresh. Try again.'); }
    finally { setBusy(null); }
  }

  async function discoverFoodTrackers() {
    setBusy('discover-writers'); setMessage(null);
    try {
      if (!appleUsable) {
        const next = await connectAppleHealth();
        if (next !== 'connected') throw new Error('Health access unavailable.');
      }
      const writers = await discoverAppleHealthIntakeWriters();
      setIntakeWriters(writers);
      if (writers.length === 0) setMessage('No food-tracking data was found in Apple Health.');
    } catch { setMessage('Food trackers couldn’t be read from Apple Health. Refresh and try again.'); }
    finally { setBusy(null); }
  }

  async function selectFoodTracker(writer: AppleHealthIntakeWriter) {
    setBusy('select-writer'); setMessage(null);
    try {
      const providers = await fetchProviderSelection();
      await saveProviderSelection({
        authoritativeExpenditureProvider: providers.expenditure.authoritativeProvider,
        authoritativeActivityProvider: providers.activityContext.authoritativeProvider,
        authoritativeIntakeProvider: 'apple_health',
        appleHealthIntakeWriter: { bundleIdentifier: writer.bundleIdentifier, displayName: writer.displayName },
      });
      await syncAppleHealthToday({ force: true, trigger: 'provider_reconnect' });
      setConnections(await fetchHealthConnections());
      closeSheets(); void load().catch(() => undefined);
    } catch { setMessage(`${writer.displayName} couldn’t be selected. Refresh Apple Health and try again.`); }
    finally { setBusy(null); }
  }

  async function refreshService(name: ServiceName) {
    setBusy(`refresh-${name}`); setMessage(null);
    try {
      if (name === 'Fitbit') await syncFitbit(timezone(), true);
      if (name === 'FatSecret') await syncFatSecret(timezone(), true);
      if (name === 'Apple Health') {
        const outcome = await refreshAppleHealthForCurrentAccount({ trigger: 'manual_refresh' });
        if (!outcome || outcome.syncStatus === 'failure') throw new Error('Apple Health refresh failed.');
        const [localStatus, diagnostics] = await Promise.all([
          getAppleHealthConnectionStatus(), getAppleHealthDiagnostics(),
        ]);
        const burnState = deriveAppleHealthBurnState(localStatus, diagnostics);
        setAppleBurnState(burnState);
        if (burnState === 'refresh_failed' || burnState === 'needs_attention') {
          throw new Error('Apple Health burn refresh failed.');
        }
        if (burnState === 'no_burn_data') {
          setMessageTone('attention');
          setMessage('Apple Health refreshed. No calorie-burn data was found.');
          void load().catch(() => undefined);
          return;
        }
      }
      setMessageTone('success'); setMessage(`${name} refreshed.`); void load().catch(() => undefined);
    } catch { setMessageTone('error'); setMessage(`${name} couldn’t refresh. Try again.`); }
    finally { setBusy(null); }
  }

  async function reconnectService(name: 'Fitbit' | 'FatSecret') {
    setBusy(`reconnect-${name}`); setMessage(null);
    try {
      const { authorizationUrl } = name === 'Fitbit'
        ? await startFitbitAuthorization()
        : await startFatSecretAuthorization();
      const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, 'caloriebank://integrations');
      if (result.type !== 'success') { setMessage(`${name} connection was not completed.`); return; }
      if (name === 'Fitbit') await syncFitbit(timezone(), true); else await syncFatSecret(timezone(), true);
      setConnections(await fetchHealthConnections());
      setMessage(`${name} reconnected.`);
      void load().catch(() => undefined);
    } catch { setMessage(`${name} couldn’t reconnect. Try again.`); }
    finally { setBusy(null); }
  }

  async function disconnectService(name: 'Fitbit' | 'FatSecret') {
    setBusy(`disconnect-${name}`); setMessage(null);
    try {
      if (name === 'Fitbit') await disconnectFitbit(); else await disconnectFatSecret();
      setService(null);
      setConnections((current) => current ? {
        ...current,
        burned: { ...current.burned, alternatives: current.burned.alternatives.filter((item) => item.label !== name) },
        eaten: { ...current.eaten, alternatives: current.eaten.alternatives.filter((item) => item.label !== name) },
        connectedServices: current.connectedServices.filter((item) => item.label !== name),
      } : current);
      void load().catch(() => undefined);
    } catch (error) {
      setMessage(error instanceof ApiHttpError && error.code === 'SELECTED_SOURCE_MUST_CHANGE_FIRST'
        ? `Choose another calories ${name === 'Fitbit' ? 'burned' : 'eaten'} source before disconnecting ${name}.`
        : `${name} couldn’t be disconnected. Try again.`);
    } finally { setBusy(null); }
  }

  function openRole(role: Role) {
    setMessage(null);
    const selected = displayConnections?.[role].selected;
    if (selected?.primaryAction === 'reconnect') {
      if (role === 'burned') void connectFitbitForBurn(); else void connectFatSecretForEaten();
      return;
    }
    if (selected?.primaryAction === 'check_apple_health' || selected?.primaryAction === 'refresh_apple_health') {
      setService('Apple Health');
      return;
    }
    setRoleSheet(role);
  }

  function removeFromInventory(item: InventoryItem) {
    setMessage(null);
    if (item.serviceName !== 'Fitbit' && item.serviceName !== 'FatSecret') return;
    if (item.selected) {
      setService(item.serviceName);
      return;
    }
    void disconnectService(item.serviceName);
  }

  function openAppleHealthDiagnostics() {
    if (diagnosticsOpening.current) return;
    diagnosticsOpening.current = true;
    reopenAppleHealthDetails.current = true;
    setService(null);
    requestAnimationFrame(() => router.push('/health-diagnostics'));
  }

  if (loading && !connections) return <SafeAreaView edges={['bottom']} style={styles.safeArea}><View style={styles.loading}><ActivityIndicator color={colors.primary} /></View></SafeAreaView>;

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {returnTo === 'onboarding' ? <Pressable accessibilityLabel="Back to setup" accessibilityRole="button" onPress={() => router.replace('/onboarding')} style={({ pressed }) => [styles.returnButton, pressed && styles.pressed]}><Ionicons color={colors.primary} name="chevron-back" size={20} /><Text style={styles.returnText}>Back to setup</Text></Pressable> : null}
        <View style={styles.intro}>
          <Text style={styles.screenTitle}>Health Connections</Text>
          <Text style={styles.body}>Choose where CalorieBank gets your calories.</Text>
        </View>
        <RoleCard data={displayConnections?.burned ?? null} onPress={() => openRole('burned')} role="burned" />
        <RoleCard data={displayConnections?.eaten ?? null} onPress={() => openRole('eaten')} role="eaten" />
        <InventorySection
          addLabel="Add burn source"
          appleBurnState={appleBurnState}
          items={burnSources}
          onAdd={() => { setMessage(null); setAddRole('burned'); }}
          onManage={(item) => { setMessage(null); setService(item.serviceName); }}
          onRemove={removeFromInventory}
          role="burned"
          title="Calorie Burn Sources"
        />
        <InventorySection
          addLabel="Add food source"
          appleBurnState={appleBurnState}
          items={intakeSources}
          onAdd={() => { setMessage(null); setAddRole('eaten'); }}
          onManage={(item) => { setMessage(null); setService(item.serviceName); }}
          onRemove={removeFromInventory}
          role="eaten"
          title="Calorie Intake Sources"
        />
        {message && !roleSheet && !addRole && !service ? <Text style={messageTone === 'success' ? styles.successText : messageTone === 'attention' ? styles.attentionText : styles.errorText}>{message}</Text> : null}
      </ScrollView>
      <RoleSelector appleBurnState={appleBurnState} busy={busy !== null} data={roleSheet ? displayConnections?.[roleSheet] ?? null : null} message={message} messageTone={messageTone} onAdd={() => { setAddRole(roleSheet); setRoleSheet(null); setMessage(null); }} onAppleDetails={() => { setRoleSheet(null); setService('Apple Health'); }} onClose={closeSheets} onRefreshApple={() => void refreshService('Apple Health')} onSelect={(option) => roleSheet ? void selectRole(roleSheet, option) : undefined} role={roleSheet} />
      <AddSourceSheet busy={busy} connections={displayConnections} intakeWriters={intakeWriters} message={message} messageTone={messageTone} onAppleBurn={() => void connectAppleHealthForBurn()} onAppleIntake={() => void discoverFoodTrackers()} onClose={closeSheets} onFatSecret={() => void connectFatSecretForEaten()} onFitbit={() => void connectFitbitForBurn()} onWriter={(writer) => void selectFoodTracker(writer)} role={addRole} />
      <ServiceSheet appleBurnState={appleBurnState} busy={busy} connections={displayConnections} message={message} messageTone={messageTone} name={service} onChange={(role) => { setService(null); openRole(role); }} onClose={() => { setService(null); setMessage(null); }} onDiagnostics={openAppleHealthDiagnostics} onDisconnect={(name) => void disconnectService(name)} onReconnect={(name) => void reconnectService(name)} onRefresh={(name) => void refreshService(name)} />
    </SafeAreaView>
  );
}

function buildInventory(role: Role, connections: HealthConnectionsResponse | null): InventoryItem[] {
  if (!connections) return [];
  const roleState = connections[role];
  const roleOptions = [roleState.selected, ...roleState.alternatives]
    .filter((option): option is HealthConnectionOption => option !== null);
  const serviceLabels = role === 'burned' ? ['Apple Health', 'Fitbit'] : ['FatSecret'];
  for (const label of serviceLabels) {
    const serviceOption = connections.connectedServices.find((option) => option.label === label);
    if (serviceOption && !roleOptions.some((option) => option.label === label)) roleOptions.push(serviceOption);
  }
  const seen = new Set<string>();
  return roleOptions.flatMap((option) => {
    const key = `${option.label}|${option.transportLabel ?? ''}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const serviceName: ServiceName = option.label === 'Fitbit'
      ? 'Fitbit'
      : option.label === 'FatSecret'
        ? 'FatSecret'
        : 'Apple Health';
    return [{
      ...option,
      selected: option.optionId === roleState.selected?.optionId,
      serviceName,
    }];
  });
}

function InventorySection({ addLabel, appleBurnState, items, onAdd, onManage, onRemove, role, title }: {
  addLabel: string;
  appleBurnState: AppleHealthBurnState;
  items: InventoryItem[];
  onAdd: () => void;
  onManage: (item: InventoryItem) => void;
  onRemove: (item: InventoryItem) => void;
  role: Role;
  title: string;
}) {
  return <View style={styles.section}>
    <Text style={styles.sectionLabel}>{title}</Text>
    <View style={styles.serviceList}>
      {items.length ? items.map((item, index) => {
        const direct = item.serviceName === 'Fitbit' || item.serviceName === 'FatSecret';
        const burnCopy = role === 'burned' && item.deviceManaged
          ? appleBurnState === 'no_burn_data'
            ? 'No burn data yet'
            : appleBurnState === 'refresh_failed'
              ? 'Refresh failed'
              : appleBurnState === 'refreshing'
                ? 'Refreshing…'
                : null
          : null;
        return <View key={`${item.label}-${item.transportLabel ?? ''}`} style={[styles.serviceRow, index < items.length - 1 && styles.serviceRowBorder]}>
          <Pressable accessibilityHint={`Manage ${item.label}`} accessibilityRole="button" onPress={() => onManage(item)} style={({ pressed }) => [styles.inventoryMain, pressed && styles.pressed]}>
            <View style={styles.inventoryText}>
              <Text style={styles.serviceName}>{item.label}</Text>
              {item.transportLabel ? <Text style={styles.optionDetail}>via {item.transportLabel}</Text> : null}
              <Text style={[styles.inventoryStatus, item.status === 'needs_attention' && styles.attention]}>
                {item.selected
                  ? item.status === 'connected' ? 'Selected' : `Selected · ${burnCopy ?? statusCopy(item.status)}`
                  : burnCopy ?? statusCopy(item.status)}
              </Text>
            </View>
          </Pressable>
          {direct ? <Pressable accessibilityLabel={`Remove ${item.label}`} accessibilityRole="button" hitSlop={8} onPress={() => onRemove(item)} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><Ionicons color={colors.textMuted} name="trash-outline" size={20} /></Pressable> : <Pressable accessibilityLabel={`Manage ${item.label}`} accessibilityRole="button" hitSlop={8} onPress={() => onManage(item)} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><Ionicons color={colors.textMuted} name="chevron-forward" size={20} /></Pressable>}
        </View>;
      }) : <Text style={styles.emptyText}>No sources connected</Text>}
    </View>
    <Pressable accessibilityRole="button" onPress={onAdd} style={({ pressed }) => [styles.inventoryAdd, pressed && styles.pressed]}><Ionicons color={colors.primary} name="add" size={20} /><Text style={styles.addText}>{addLabel}</Text></Pressable>
  </View>;
}

function RoleCard({ role, data, onPress }: { role: Role; data: HealthConnectionsResponse[Role] | null; onPress: () => void }) {
  const selected = data?.selected;
  const action = selected?.primaryAction === 'reconnect'
    ? 'Reconnect'
    : selected?.primaryAction === 'refresh_apple_health'
      ? 'Refresh'
      : selected?.primaryAction === 'check_apple_health'
        ? 'Check Apple Health'
        : selected
          ? 'Change'
          : 'Connect source';
  return <View style={styles.roleCard}>
    <Text style={styles.roleLabel}>{role === 'burned' ? 'Calories Burned' : 'Calories Eaten'}</Text>
    <Text style={styles.roleValue}>{selected?.label ?? 'Not connected'}</Text>
    {selected?.transportLabel ? <Text style={styles.transport}>via {selected.transportLabel}</Text> : null}
    <Text style={[styles.status, selected?.status === 'needs_attention' && styles.attention]}>{selected ? statusCopy(selected.status) : 'Not connected'}</Text>
    <Pressable accessibilityLabel={`${action} for calories ${role}`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}><Text style={styles.actionText}>{action}</Text></Pressable>
  </View>;
}

function Sheet({ children, onClose, visible }: { children: ReactNode; onClose: () => void; visible: boolean }) {
  return <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}><Pressable accessibilityRole="button" onPress={onClose} style={styles.backdrop}><Pressable accessibilityRole="none" onPress={(event) => event.stopPropagation()} style={styles.sheet}>{children}</Pressable></Pressable></Modal>;
}

function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>{title}</Text><Pressable accessibilityLabel="Close" accessibilityRole="button" hitSlop={12} onPress={onClose}><Ionicons color={colors.text} name="close" size={24} /></Pressable></View>;
}

function RoleSelector({ appleBurnState, busy, data, message, messageTone, onAdd, onAppleDetails, onClose, onRefreshApple, onSelect, role }: { appleBurnState: AppleHealthBurnState; busy: boolean; data: HealthConnectionsResponse[Role] | null; message: string | null; messageTone: 'attention' | 'error' | 'success'; onAdd: () => void; onAppleDetails: () => void; onClose: () => void; onRefreshApple: () => void; onSelect: (option: HealthConnectionOption) => void; role: Role | null }) {
  const options = data ? [data.selected, ...data.alternatives].filter((item): item is HealthConnectionOption => item !== null) : [];
  return <Sheet onClose={onClose} visible={role !== null}>
    <SheetHeader onClose={onClose} title={role === 'burned' ? 'Calories burned' : 'Calories eaten'} />
    {options.map((option) => {
      const selected = option.optionId === data?.selected?.optionId;
      const usable = option.status === 'connected';
      const noBurnData = role === 'burned' && option.deviceManaged && appleBurnState === 'no_burn_data';
      const unavailableCopy = noBurnData
        ? 'No burn data yet'
        : appleBurnState === 'refresh_failed' && role === 'burned' && option.deviceManaged
          ? 'Refresh failed'
          : 'Needs refresh';
      return <View key={option.optionId} style={styles.optionRow}><Ionicons color={selected ? colors.primary : 'transparent'} name="checkmark" size={22} /><Pressable accessibilityRole="button" accessibilityState={{ selected, disabled: selected || busy || !usable }} disabled={selected || busy || !usable} onPress={() => onSelect(option)} style={styles.optionText}><Text style={styles.optionLabel}>{option.label}</Text>{option.transportLabel ? <Text style={styles.optionDetail}>via {option.transportLabel}</Text> : null}{!usable ? <Text style={styles.optionDetail}>{unavailableCopy}</Text> : null}</Pressable>{noBurnData ? <Pressable accessibilityRole="button" disabled={busy} onPress={onAppleDetails} style={styles.inlineAction}><Text style={styles.actionText}>Details</Text></Pressable> : option.deviceManaged && !usable && option.primaryAction === 'refresh_apple_health' ? <Pressable accessibilityRole="button" disabled={busy} onPress={onRefreshApple} style={styles.inlineAction}><Text style={styles.actionText}>Refresh</Text></Pressable> : busy && !selected ? <ActivityIndicator color={colors.primary} /> : null}</View>;
    })}
    {data?.canAddSource || options.length === 0 ? <Pressable accessibilityRole="button" disabled={busy} onPress={onAdd} style={styles.addRow}><Ionicons color={colors.primary} name="add" size={22} /><Text style={styles.addText}>{options.length === 0 ? 'Choose a source' : 'Add another source'}</Text></Pressable> : null}
    {message ? <Text style={messageTone === 'success' ? styles.successText : messageTone === 'attention' ? styles.attentionText : styles.errorText}>{message}</Text> : null}<Pressable accessibilityRole="button" onPress={onClose} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable>
  </Sheet>;
}

function AddSourceSheet({ busy, connections, intakeWriters, message, messageTone, onAppleBurn, onAppleIntake, onClose, onFatSecret, onFitbit, onWriter, role }: { busy: string | null; connections: HealthConnectionsResponse | null; intakeWriters: AppleHealthIntakeWriter[]; message: string | null; messageTone: 'attention' | 'error' | 'success'; onAppleBurn: () => void; onAppleIntake: () => void; onClose: () => void; onFatSecret: () => void; onFitbit: () => void; onWriter: (writer: AppleHealthIntakeWriter) => void; role: Role | null }) {
  const fitbitConnected = connections?.connectedServices.some((option) => option.label === 'Fitbit' && option.status === 'connected') ?? false;
  const fatSecretConnected = connections?.connectedServices.some((option) => option.label === 'FatSecret' && option.status === 'connected') ?? false;
  const appleAvailable = role ? [connections?.[role].selected, ...(connections?.[role].alternatives ?? [])]
    .some((option) => option?.deviceManaged) : false;
  const choosingWriters = intakeWriters.length > 0;
  const hasAddChoice = role === 'burned' ? !fitbitConnected || !appleAvailable : !fatSecretConnected || !appleAvailable;
  return <Sheet onClose={onClose} visible={role !== null}>
    <SheetHeader onClose={onClose} title={choosingWriters ? 'Choose your food tracker' : role === 'burned' ? 'Add calories burned source' : 'Add calories eaten source'} />
    {choosingWriters ? intakeWriters.map((writer) => <SourceAction disabled={busy !== null} key={writer.bundleIdentifier} label={writer.displayName} onPress={() => onWriter(writer)} />) : role === 'burned' ? <>{!fitbitConnected ? <SourceAction disabled={busy !== null} label="Fitbit" onPress={onFitbit} /> : null}{!appleAvailable ? <SourceAction disabled={busy !== null} label="Apple Health" onPress={onAppleBurn} /> : null}</> : <>{!fatSecretConnected ? <SourceAction disabled={busy !== null} label="FatSecret" onPress={onFatSecret} /> : null}{!appleAvailable ? <SourceAction detail="Use a food tracker connected to Apple Health" disabled={busy !== null} label="Apple Health" onPress={onAppleIntake} /> : null}</>}
    {!choosingWriters && !hasAddChoice ? <Text style={styles.emptyText}>All supported sources are connected.</Text> : null}
    {busy ? <ActivityIndicator color={colors.primary} style={styles.sheetSpinner} /> : null}{message ? <Text style={messageTone === 'success' ? styles.successText : messageTone === 'attention' ? styles.attentionText : styles.errorText}>{message}</Text> : null}<Pressable accessibilityRole="button" onPress={onClose} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable>
  </Sheet>;
}

function SourceAction({ disabled, label, detail, onPress }: { disabled: boolean; label: string; detail?: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.optionRow, pressed && styles.pressed]}><View style={styles.optionText}><Text style={styles.optionLabel}>{label}</Text>{detail ? <Text style={styles.optionDetail}>{detail}</Text> : null}</View><Ionicons color={colors.textMuted} name="chevron-forward" size={20} /></Pressable>;
}

function ServiceSheet({ appleBurnState, busy, connections, message, messageTone, name, onChange, onClose, onDiagnostics, onDisconnect, onReconnect, onRefresh }: { appleBurnState: AppleHealthBurnState; busy: string | null; connections: HealthConnectionsResponse | null; message: string | null; messageTone: 'attention' | 'error' | 'success'; name: ServiceName | null; onChange: (role: Role) => void; onClose: () => void; onDiagnostics: () => void; onDisconnect: (name: 'Fitbit' | 'FatSecret') => void; onReconnect: (name: 'Fitbit' | 'FatSecret') => void; onRefresh: (name: ServiceName) => void }) {
  const usedForBurn = connections?.burned.selected?.label === name;
  const usedForEaten = connections?.eaten.selected?.label === name || (name === 'Apple Health' && connections?.eaten.selected?.transportLabel === 'Apple Health');
  const usage = [usedForBurn ? 'Calories Burned' : null, usedForEaten ? 'Calories Eaten' : null].filter(Boolean).join(', ');
  const serviceOption = connections?.connectedServices.find((option) => option.label === name);
  const needsAttention = serviceOption?.status === 'needs_attention';
  const guardedRole: Role = name === 'Fitbit' ? 'burned' : 'eaten';
  const hasAlternative = connections?.[guardedRole].alternatives.length ? true : false;
  return <Sheet onClose={onClose} visible={name !== null}><SheetHeader onClose={onClose} title={name ?? ''} /><Text style={[styles.serviceStatus, needsAttention && styles.attention]}>{name === 'Apple Health' ? 'Managed by iOS' : needsAttention ? 'Needs attention' : 'Connected'}</Text><View style={styles.detailBlock}><Text style={styles.detailLabel}>Used for</Text><Text style={styles.detailValue}>{usage || 'Not currently used'}</Text></View>
    {name === 'Apple Health' ? <>
      <View style={styles.detailBlock}><Text style={styles.detailLabel}>Burn data</Text><Text style={styles.detailValue}>{appleBurnState === 'ready' ? 'Available' : appleBurnState === 'refreshing' ? 'Refreshing…' : appleBurnState === 'refresh_failed' ? 'Refresh failed' : appleBurnState === 'no_burn_data' ? 'Not available yet' : 'Needs refresh'}</Text></View>
      {appleBurnState === 'no_burn_data' ? <Text style={styles.body}>CalorieBank can access Apple Health, but no complete calorie-burn data was found.</Text> : null}
      <Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => onRefresh(name)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Refresh</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Manage Apple Health permissions</Text></Pressable>
    </> : needsAttention && (name === 'Fitbit' || name === 'FatSecret') ? <Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => onReconnect(name)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Reconnect</Text></Pressable> : <Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => name && onRefresh(name)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Refresh</Text></Pressable>}
    {name === 'Fitbit' || name === 'FatSecret' ? usedForBurn || usedForEaten ? <View style={styles.guardBlock}><Text style={styles.body}>{hasAlternative ? 'Choose another' : 'Add or choose another'} calories {name === 'Fitbit' ? 'burned' : 'eaten'} source before disconnecting {name}.</Text><Pressable accessibilityRole="button" onPress={() => onChange(guardedRole)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{hasAlternative ? 'Change source' : 'Add another source'}</Text></Pressable></View> : <Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => onDisconnect(name)} style={styles.dangerButton}><Text style={styles.dangerText}>Disconnect {name}</Text></Pressable> : null}
    {(__DEV__ || process.env.EXPO_PUBLIC_APP_ENV === 'beta') && name === 'Apple Health' ? <Pressable accessibilityRole="button" disabled={busy !== null} onPress={onDiagnostics} style={styles.devButton}><Text style={styles.devText}>Diagnostics</Text></Pressable> : null}
    {busy ? <ActivityIndicator color={colors.primary} style={styles.sheetSpinner} /> : null}{message ? <Text style={messageTone === 'success' ? styles.successText : messageTone === 'attention' ? styles.attentionText : styles.errorText}>{message}</Text> : null}
  </Sheet>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center' }, container: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxl }, returnButton: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', minHeight: 44 }, returnText: { color: colors.primary, fontSize: typography.body, fontWeight: '700' }, intro: { gap: spacing.xs }, screenTitle: { color: colors.text, fontSize: typography.title, fontWeight: '800' }, body: { color: colors.textMuted, fontSize: typography.body, lineHeight: 23 },
  roleCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, padding: spacing.lg }, roleLabel: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '800', textTransform: 'uppercase' }, roleValue: { color: colors.text, fontSize: typography.heading, fontWeight: '800', marginTop: spacing.md }, transport: { color: colors.textMuted, fontSize: typography.body, marginTop: spacing.xs }, status: { color: colors.primaryDark, fontSize: typography.body, fontWeight: '700', marginTop: spacing.md }, attention: { color: colors.accent }, actionButton: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44, marginTop: spacing.sm }, actionText: { color: colors.primary, fontSize: typography.body, fontWeight: '800' },
  section: { gap: spacing.sm }, sectionLabel: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '800', textTransform: 'uppercase' }, serviceList: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, overflow: 'hidden' }, serviceRow: { alignItems: 'center', flexDirection: 'row', minHeight: 68, paddingLeft: spacing.md }, serviceRowBorder: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }, inventoryMain: { flex: 1, justifyContent: 'center', minHeight: 68, paddingVertical: spacing.sm }, inventoryText: { gap: 2 }, inventoryStatus: { color: colors.primaryDark, fontSize: typography.caption, fontWeight: '700', marginTop: spacing.xs }, iconButton: { alignItems: 'center', justifyContent: 'center', minHeight: 48, minWidth: 48 }, inventoryAdd: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: spacing.sm, minHeight: 44 }, serviceName: { color: colors.text, fontSize: typography.body, fontWeight: '700' }, emptyText: { color: colors.textMuted, fontSize: typography.body, padding: spacing.md },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.34)', justifyContent: 'flex-end', padding: spacing.md }, sheet: { backgroundColor: colors.surface, borderRadius: radii.lg, gap: spacing.sm, maxHeight: '82%', padding: spacing.lg }, sheetHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }, sheetTitle: { color: colors.text, flex: 1, fontSize: typography.heading, fontWeight: '800' }, optionRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 56, paddingVertical: spacing.sm }, optionText: { flex: 1 }, optionLabel: { color: colors.text, fontSize: typography.body, fontWeight: '700' }, optionDetail: { color: colors.textMuted, fontSize: typography.caption, marginTop: spacing.xs }, inlineAction: { alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.sm }, addRow: { alignItems: 'center', borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.md, minHeight: 56, marginTop: spacing.xs }, addText: { color: colors.primary, fontSize: typography.body, fontWeight: '800' }, cancelButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44 }, cancelText: { color: colors.textMuted, fontSize: typography.body, fontWeight: '700' }, attentionText: { color: colors.accent, fontSize: typography.body, lineHeight: 22 }, errorText: { color: colors.danger, fontSize: typography.body, lineHeight: 22 }, successText: { color: colors.primaryDark, fontSize: typography.body, lineHeight: 22 }, sheetSpinner: { marginVertical: spacing.sm },
  serviceStatus: { color: colors.primaryDark, fontSize: typography.body, fontWeight: '700' }, detailBlock: { gap: spacing.xs, marginVertical: spacing.sm }, detailLabel: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '800', textTransform: 'uppercase' }, detailValue: { color: colors.text, fontSize: typography.body, fontWeight: '700' }, primaryButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.md, justifyContent: 'center', minHeight: 48, paddingHorizontal: spacing.md }, primaryButtonText: { color: colors.surface, fontSize: typography.body, fontWeight: '700', textAlign: 'center' }, secondaryButton: { alignItems: 'center', borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: spacing.md }, secondaryButtonText: { color: colors.text, fontSize: typography.body, fontWeight: '700', textAlign: 'center' }, guardBlock: { gap: spacing.sm }, dangerButton: { alignItems: 'center', justifyContent: 'center', minHeight: 48 }, dangerText: { color: colors.danger, fontSize: typography.body, fontWeight: '700' }, devButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44 }, devText: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '700' }, pressed: { opacity: 0.7 },
});
