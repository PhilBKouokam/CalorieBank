import { useEffect, useRef, useState } from 'react';
import { AppState, Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { usePathname } from 'expo-router';
import { Text } from './ScaleAwareText';
import { colors } from '@/constants/caloriebank-theme';
import { canOfferScreenshotShare } from '@/lib/sharing/screenshot-policy';
import { loadScreenshotTools, type ScreenshotTools } from '@/lib/sharing/native-screenshot';

export function ScreenshotShareSheet({ uri, busy, error, onShare, onClose }: {
  uri: string; busy: boolean; error: boolean; onShare: () => void; onClose: () => void;
}) {
  return <Modal transparent animationType="fade" visible onRequestClose={onClose}>
    <View style={styles.backdrop}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.sheet} accessibilityViewIsModal>
          <Text accessibilityRole="header" style={styles.title}>Share this moment?</Text>
          <Text style={styles.description}>A fresh snapshot of this screen. Check what’s visible before sharing.</Text>
          <Image source={{ uri }} resizeMode="contain" style={styles.preview} accessible accessibilityLabel="Preview of the CalorieBank screen you are about to share" />
          <Text style={styles.privacy}>Only share details you’re comfortable making public. You choose the app and audience next.</Text>
          {error ? <Text accessibilityRole="alert" style={styles.error}>Couldn’t open sharing. Try again, or share your original screenshot from Photos.</Text> : null}
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={onShare} style={[styles.button, busy && { opacity: 0.6 }]}>
            <Text style={styles.buttonText}>{busy ? 'Opening sharing…' : 'Choose where to share'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={busy} accessibilityState={{ disabled: busy }} onPress={onClose} style={styles.dismiss}><Text style={styles.dismissText}>Not now</Text></Pressable>
        </View>
      </ScrollView>
    </View>
  </Modal>;
}

export function ScreenshotSharePrompt({ ready }: { ready: boolean }) {
  const path = usePathname();
  const [uri, setUri] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState(false);
  const closeRef = useRef<() => void>(() => {});
  const shareRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    let alive = true;
    let busy = false;
    let generation = 0;
    let lastCapture = -Infinity;
    let imageUri: string | null = null;
    let sharingUri: string | null = null;
    let tools: ScreenshotTools | null = null;
    let listener: { remove: () => void } | undefined;
    const clear = () => {
      generation += 1;
      if (imageUri && imageUri !== sharingUri) tools?.release(imageUri);
      imageUri = null;
      busy = false;
      if (alive) { setUri(null); setSharing(false); setError(false); }
    };
    closeRef.current = clear;
    shareRef.current = async () => {
      if (!alive || !imageUri || !tools || sharingUri) return;
      const shared = imageUri;
      sharingUri = shared;
      const current = generation;
      setSharing(true); setError(false);
      try {
        await tools.share(shared);
        // A resolved share sheet can mean Cancel. Never claim a post was sent.
        if (alive && current === generation) clear();
      } catch {
        if (alive && current === generation) { setSharing(false); setError(true); }
      } finally {
        sharingUri = null;
        if (imageUri !== shared) tools.release(shared);
      }
    };
    const state = AppState.addEventListener('change', value => {
      // Inactive is also used by the iOS share sheet. Background clears private preview.
      if (value === 'background') clear();
    });
    void loadScreenshotTools().then(value => {
      if (!alive || !value) return;
      tools = value;
      if (!canOfferScreenshotShare({ ready, path, appState: 'active', busy: false })) return;
      try {
        listener = tools.listen(() => {
          if (!alive || !canOfferScreenshotShare({ ready, path, appState: AppState.currentState, busy }) || Date.now() - lastCapture < 10000) return;
          busy = true; lastCapture = Date.now();
          const current = ++generation;
          void value.capture().then(captured => {
            if (!alive || current !== generation || AppState.currentState !== 'active') { value.release(captured); return; }
            imageUri = captured; setUri(captured);
          }).catch(() => { if (alive && current === generation) busy = false; });
        });
      } catch { /* Unsupported native binary: preserve normal OS screenshot behavior. */ }
    });
    return () => { alive = false; listener?.remove(); state.remove(); clear(); };
  }, [path, ready]);
  if (!uri) return null;
  return <ScreenshotShareSheet uri={uri} busy={sharing} error={error} onClose={() => closeRef.current()} onShare={() => { void shareRef.current(); }} />;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(16,35,28,0.5)', justifyContent: 'center', padding: 16 },
  scroll: { flexGrow: 0, maxHeight: '90%' }, scrollContent: { flexGrow: 1 },
  sheet: { backgroundColor: '#F3F8F5', borderRadius: 28, borderWidth: 1, borderColor: '#FFFFFF', padding: 20, gap: 12, width: '100%', maxWidth: 480, alignSelf: 'center' },
  title: { fontSize: 25, fontWeight: '700', color: colors.text },
  description: { fontSize: 16, lineHeight: 23, color: colors.textMuted },
  preview: { height: 260, width: '100%', borderRadius: 16, backgroundColor: '#DFE9E3' },
  privacy: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
  error: { fontSize: 14, lineHeight: 20, color: colors.danger },
  button: { minHeight: 48, padding: 14, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  dismiss: { minHeight: 44, alignItems: 'center', justifyContent: 'center', padding: 8 },
  dismissText: { color: colors.primaryDark, fontSize: 16, fontWeight: '600' },
});
