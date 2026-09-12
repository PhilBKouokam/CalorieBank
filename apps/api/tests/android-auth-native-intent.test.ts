import { describe, expect, it, vi } from 'vitest';
import { normalizeAuthSystemPath } from '../../mobile/lib/auth/native-intent';
import { extractExpoPathFromURL } from 'expo-router/build/fork/extractPathFromURL';

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
import { redirectSystemPath } from '../../mobile/app/+native-intent';

const callback = 'clerk://com.caloriebank.mobile.hosted-callback';
const success = `${callback}?created_session_id=fixture-session&rotating_token_nonce=fixture-nonce&state=fixture-state`;

describe('Android Clerk callback navigation boundary', () => {
  it('reproduces the installed Router parser treating the callback host as a screen', () => {
    expect(extractExpoPathFromURL([], success)).toBe(
      'com.caloriebank.mobile.hosted-callback?created_session_id=fixture-session&rotating_token_nonce=fixture-nonce&state=fixture-state',
    );
    expect(extractExpoPathFromURL([], redirectSystemPath({ path: success, initial: true }))).toBe('');
  });
  it('exports the actual Router hook and suppresses warm callback navigation', () => {
    expect(redirectSystemPath({ path: success, initial: false })).toBe('');
  });
  it('uses the existing auth gate for cold callbacks without forwarding credentials', () => {
    expect(redirectSystemPath({ path: success, initial: true })).toBe('/');
  });
  it('leaves a warm screen mounted while Clerk verifies and hydrates the session', () => {
    const currentScreen = 'sign-in-awaiting-clerk';
    const destination = redirectSystemPath({ path: success, initial: false });
    // Router 6 subscribe dispatches only truthy destinations.
    expect(destination || currentScreen).toBe(currentScreen);
  });
  it('does not navigate an already-authenticated warm app or replay duplicate callbacks', () => {
    for (let repeat = 0; repeat < 3; repeat++) {
      expect(redirectSystemPath({ path: success, initial: false })).toBe('');
      expect(redirectSystemPath({ path: success, initial: true })).toBe('/');
    }
  });
  it('does not activate an old account from callback parameters', () => {
    for (const session of ['account-A', 'account-B', 'stale-account-A']) {
      const path = `${callback}?created_session_id=${session}&state=invalid`;
      expect(redirectSystemPath({ path, initial: false })).toBe('');
      expect(redirectSystemPath({ path, initial: true })).toBe('/');
    }
  });
  it.each([callback, `${callback}/`, `${callback}?error=access_denied`, `${callback}?state=wrong`, `${callback}?rotating_token_nonce=`])(
    'never treats missing/failed/invalid auth parameters as route or session authority: %s', (path) => {
      expect(redirectSystemPath({ path, initial: false })).toBe('');
      expect(redirectSystemPath({ path, initial: true })).toBe('/');
    },
  );
  it.each([
    'com.caloriebank.mobile://callback?state=ios',
    'caloriebank://integrations?provider=google_health_fitbit&status=connected',
    'caloriebank://integrations?provider=fatsecret&status=connected',
    'caloriebank://today', 'caloriebank:///', '/today', '/onboarding', '/settings',
    'clerk://another.app.hosted-callback?state=other',
    `${callback}.evil?state=other`, `${callback}/another-route`,
    'https://com.caloriebank.mobile.hosted-callback',
    'clerk://user@com.caloriebank.mobile.hosted-callback',
    'not a URL', '',
  ])('preserves unrelated/provider/notification/startup links: %s', (path) => {
    for (const initial of [true, false]) expect(redirectSystemPath({ path, initial })).toBe(path);
  });
  it.each(['ios', 'web'])('preserves every incoming URL on %s', (platform) => {
    for (const path of [success, 'com.caloriebank.mobile://callback?state=ios', 'caloriebank://integrations']) {
      for (const initial of [true, false]) expect(normalizeAuthSystemPath({ path, initial }, platform)).toBe(path);
    }
  });
});
