import { useState } from 'react';
import { Button, NativeModules, Text, View } from 'react-native';
export default function DiagnosticHeader() {
  const [message, setMessage] = useState('Inspect the Back chevron. Geometry is captured automatically while the header settles.');
  async function exportGeometry() {
    try {
      const module = NativeModules.CBBackGeometry as { exportGeometry: () => Promise<boolean> } | undefined;
      if (!module) throw new Error('Native geometry module is missing.');
      await module.exportGeometry();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Geometry export failed.'); }
  }
  return <View style={{ padding: 24, gap: 20 }}><Text>{message}</Text>
    <Button title="Export geometry" onPress={() => { void exportGeometry(); }} />
  </View>;
}
