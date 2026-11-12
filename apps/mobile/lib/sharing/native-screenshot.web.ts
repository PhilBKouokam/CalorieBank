/** Screenshot detection/sharing is native-only; web must not bundle native capture dependencies. */
export async function loadScreenshotTools(): Promise<null> {
  return null;
}
