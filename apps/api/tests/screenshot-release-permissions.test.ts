import { expect, it } from 'vitest';
import configure from '../../mobile/app.config';
it('blocks Android13 image-library access for the Android14-only screenshot prompt', () => {
  const result = configure({ config: { name: 'CalorieBank', slug: 'caloriebank' } } as Parameters<typeof configure>[0]);
  expect(result.android?.blockedPermissions).toContain('android.permission.READ_MEDIA_IMAGES');
});
