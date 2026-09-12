import { ensureMorningUpdateChannel } from './android-channel';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export { openNotificationSettings } from './open-notification-settings';

import {
  fetchMorningBankUpdateSettings,
  registerMorningBankUpdateDevice,
  unregisterMorningBankUpdateDevice,
  updateMorningBankUpdatePreference,
  ApiHttpError,
  getApiRequestFailureKind,
} from '@/lib/api/client';
import { createNotificationOperations, retryDeviceRelease, withNotificationTokenTimeout } from './notification-operations';
import { pauseAccountLifecycle, resumeAccountLifecycle } from '@/lib/lifecycle/account-lifecycle';

const operations = createNotificationOperations();
export const setNotificationAccountScope = operations.setScope;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type MorningUpdatePermission = 'granted' | 'denied' | 'not_determined';

export function notificationPermissionState(settings: Notifications.NotificationPermissionsStatus): MorningUpdatePermission {
  if (settings.granted) return 'granted';
  if (Platform.OS === 'ios') {
    const status = settings.ios?.status;
    if (
      status === Notifications.IosAuthorizationStatus.AUTHORIZED
      || status === Notifications.IosAuthorizationStatus.PROVISIONAL
      || status === Notifications.IosAuthorizationStatus.EPHEMERAL
    ) return 'granted';
    if (status === Notifications.IosAuthorizationStatus.DENIED) return 'denied';
  }
  return settings.canAskAgain ? 'not_determined' : 'denied';
}

async function expoPushToken() {
  await ensureMorningUpdateChannel();
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error('EAS project ID is unavailable.');
  return (await withNotificationTokenTimeout(Notifications.getExpoPushTokenAsync({ projectId }))).data;
}

async function registerCurrentDevice(check: () => void) {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') throw new Error('Push notifications require a mobile device.');
  const token = await expoPushToken();
  check();
  return registerMorningBankUpdateDevice({ expoPushToken: token, platform: Platform.OS });
}

export async function enableMorningBankUpdate() {
  return operations.run(async (check) => {
    await ensureMorningUpdateChannel();
    check();
    const existing = await Notifications.getPermissionsAsync();
    const permission = notificationPermissionState(existing) === 'not_determined'
      ? notificationPermissionState(await Notifications.requestPermissionsAsync())
      : notificationPermissionState(existing);
    check();
    if (permission !== 'granted') {
      await updateMorningBankUpdatePreference(false);
      check();
      return { permission, settings: await fetchMorningBankUpdateSettings() };
    }
    await registerCurrentDevice(check);
    check();
    return { permission, settings: await updateMorningBankUpdatePreference(true) };
  });
}

export async function disableMorningBankUpdate() {
  return operations.run(() => updateMorningBankUpdatePreference(false));
}

export async function loadMorningBankUpdateSettings() {
  const permission = notificationPermissionState(await Notifications.getPermissionsAsync());
  return { permission, settings: await fetchMorningBankUpdateSettings() };
}

export async function syncMorningBankUpdateDevice() {
  return operations.run(async (check) => {
    const permission = notificationPermissionState(await Notifications.getPermissionsAsync());
    check();
    if (permission === 'granted') await registerCurrentDevice(check);
    check();
    return { permission, settings: await fetchMorningBankUpdateSettings() };
  });
}

export async function detachMorningBankUpdateDevice() {
  pauseAccountLifecycle();
  try { await operations.release((check) => retryDeviceRelease(async () => {
    check();
    await unregisterMorningBankUpdateDevice();
  }, (error) => error instanceof ApiHttpError
    ? error.status >= 500
    : ['network', 'timeout'].includes(getApiRequestFailureKind(error)))); }
  catch (error) { resumeAccountLifecycle(); throw error; }
}

export async function prepareMorningBankUpdateAccountDeletion() {
  pauseAccountLifecycle();
  await operations.pause();
}
