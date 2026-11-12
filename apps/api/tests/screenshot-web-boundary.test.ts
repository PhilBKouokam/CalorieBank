import { expect, it } from 'vitest';
import { loadScreenshotTools } from '../../mobile/lib/sharing/native-screenshot.web';
it('keeps unsupported web screenshot detection inert without loading native capture dependencies', async () => {
  expect(await loadScreenshotTools()).toBeNull();
});
