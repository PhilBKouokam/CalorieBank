import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export async function ensureMorningUpdateChannel() {
  if (Platform.OS !== 'android') return;
  // Matches the unchanged server payload's default channel; no permission prompt.
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Morning Bank Update', importance: Notifications.AndroidImportance.DEFAULT,
  });
}
