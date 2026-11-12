import { Platform } from 'react-native';
import { supportsScreenshotPrompt } from './screenshot-policy';

export type ScreenshotTools = {
  listen: (callback: () => void) => { remove: () => void };
  capture: () => Promise<string>;
  release: (uri: string) => void;
  share: (uri: string) => Promise<void>;
};

/** Lazy imports keep old development binaries safe until their native rebuild. */
export async function loadScreenshotTools(): Promise<ScreenshotTools | null> {
  if (!supportsScreenshotPrompt(Platform.OS, Platform.Version)) return null;
  try {
    const [detection, image, sharing] = await Promise.all([
      import('expo-screen-capture'), import('react-native-view-shot'), import('expo-sharing'),
    ]);
    if (!(await sharing.isAvailableAsync())) return null;
    return {
      listen: detection.addScreenshotListener,
      capture: () => image.captureScreen({ format: 'png', result: 'tmpfile', quality: 1 }),
      release: image.releaseCapture,
      share: uri => sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share from CalorieBank' }),
    };
  } catch { return null; }
}
