/** No authentication, account settings, editors, or onboarding captures. */
export const SHAREABLE_SCREEN_PATHS = new Set([
  '/today', '/history', '/bank-history', '/today-burn', '/steps-detail',
]);
export function supportsScreenshotPrompt(os: string, version: string | number) {
  return os === 'ios' || (os === 'android' && Number(version) >= 34);
}
export function canOfferScreenshotShare(input: {
  ready: boolean; path: string; appState: string | null; busy: boolean;
}) {
  return input.ready && input.appState === 'active' && !input.busy && SHAREABLE_SCREEN_PATHS.has(input.path);
}
