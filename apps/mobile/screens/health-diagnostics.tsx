import { Redirect } from 'expo-router';

// B1 has no device-health diagnostics. Direct-provider controls stay in Connections.
export default function HealthDiagnosticsScreen() {
  return <Redirect href="/integrations" />;
}
