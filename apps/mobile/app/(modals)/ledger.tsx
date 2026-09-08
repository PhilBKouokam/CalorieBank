import { Redirect } from 'expo-router';

export default function LedgerScreen() {
  // Preserve old links without exposing the obsolete development placeholder.
  return <Redirect href="/history" />;
}
