import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

import {
  fetchMorningBankUpdateSettings,
  registerMorningBankUpdateDevice,
  unregisterMorningBankUpdateDevice,
  updateMorningBankUpdatePreference,
} from '@/lib/api/client';

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
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error('EAS project ID is unavailable.');
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

async function registerCurrentDevice() {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') throw new Error('Push notifications require a mobile device.');
  const token = await expoPushToken();
  return registerMorningBankUpdateDevice({ expoPushToken: token, platform: Platform.OS });
}

export async function enableMorningBankUpdate() {
  const existing = await Notifications.getPermissionsAsync();
  const permission = notificationPermissionState(existing) === 'not_determined'
    ? notificationPermissionState(await Notifications.requestPermissionsAsync())
    : notificationPermissionState(existing);
  if (permission !== 'granted') {
    await updateMorningBankUpdatePreference(false);
    return { permission, settings: await fetchMorningBankUpdateSettings() };
  }
  await registerCurrentDevice();
  return { permission, settings: await updateMorningBankUpdatePreference(true) };
}

export async function disableMorningBankUpdate() {
  return updateMorningBankUpdatePreference(false);
}

export async function syncMorningBankUpdateDevice() {
  const permission = notificationPermissionState(await Notifications.getPermissionsAsync());
  if (permission === 'granted') await registerCurrentDevice();
  return { permission, settings: await fetchMorningBankUpdateSettings() };
}

export async function detachMorningBankUpdateDevice() {
  await unregisterMorningBankUpdateDevice();
}

export function openNotificationSettings() {
  return Linking.openSettings();
}
