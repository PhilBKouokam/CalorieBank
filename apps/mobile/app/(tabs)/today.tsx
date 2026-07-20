import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { PlaceholderScreen } from '@/components/caloriebank/PlaceholderScreen';
import { ApiHealthState, fetchApiHealth, getApiBaseUrl } from '@/lib/api/client';

const initialApiState: ApiHealthState = {
  status: 'loading',
  label: 'Checking API',
  detail: 'Checking the configured API health endpoint.',
};

export default function TodayScreen() {
  const [apiState, setApiState] = useState<ApiHealthState>(initialApiState);

  useEffect(() => {
    let isMounted = true;

    async function checkApiHealth() {
      const apiBaseUrl = getApiBaseUrl();

      if (!apiBaseUrl) {
        if (isMounted) {
          setApiState({
            status: 'unavailable',
            label: 'API unavailable',
            detail: 'Set EXPO_PUBLIC_API_URL to your API server URL.',
          });
        }
        return;
      }

      try {
        const health = await fetchApiHealth();

        if (isMounted) {
          setApiState({
            status: 'connected',
            label: 'API connected',
            detail: `${health.service} responded ok.`,
          });
        }
      } catch (error) {
        if (isMounted) {
          setApiState({
            status: 'unavailable',
            label: 'API unavailable',
            detail: error instanceof Error ? error.message : 'Unable to reach the API health endpoint.',
          });
        }
      }
    }

    void checkApiHealth();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <PlaceholderScreen
      eyebrow="Mobile V1 Foundation"
      title="Today"
      description="A placeholder for the current bank, latest sync state, projected progress, setup state, and planning access."
      metrics={[
        { label: 'Available Bank', value: '0 cal' },
        { label: 'API Status', value: apiState.label },
        { label: 'Projected Progress', value: '0 cal' },
        { label: 'Setup State', value: 'Not connected' },
      ]}
      links={[
        { href: '/ledger', label: 'View Ledger Placeholder' },
        { href: '/onboarding', label: 'Open Setup Placeholder', variant: 'secondary' },
      ]}
    >
      <Text>{apiState.detail}</Text>
      <Text>
        Planning access will compare future meal estimates against the bank later. Business logic stays out of the
        mobile shell until the domain and API contracts are ready.
      </Text>
    </PlaceholderScreen>
  );
}
