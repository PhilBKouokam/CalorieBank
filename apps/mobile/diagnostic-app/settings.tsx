import { router } from 'expo-router';
import { Button, Text, View } from 'react-native';
export default function DiagnosticHome() {
  return <View style={{ padding: 24, gap: 20 }}><Text>This isolated app captures Back-button geometry. It does not connect to your account.</Text>
    <Button title="Open Health Connections header" onPress={() => router.push('/integrations')} />
  </View>;
}
