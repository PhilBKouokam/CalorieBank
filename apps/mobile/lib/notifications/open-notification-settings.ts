import { requireOptionalNativeModule } from 'expo';
import { Linking, Platform } from 'react-native';

export async function openNotificationSettings(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    try {
      const settings = requireOptionalNativeModule<{ openAsync(): Promise<boolean> }>('CalorieBankNotificationSettings');
      if (await settings?.openAsync()) return true;
    } catch {
      // Older binaries or unavailable notification settings use the app settings fallback.
    }
  }
  try {
    await Linking.openSettings();
    return true;
  } catch {
    return false;
  }
}
