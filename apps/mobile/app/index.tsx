import { Redirect } from 'expo-router';

const DEV_ROUTE_TARGET: '/onboarding' | '/today' = '/onboarding';

export default function IndexRoute() {
  // Temporary gate until auth and onboarding state exist.
  // Switch DEV_ROUTE_TARGET to "/today" for local shell iteration.
  return <Redirect href={DEV_ROUTE_TARGET} />;
}
