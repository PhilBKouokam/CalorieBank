import { expect, it } from 'vitest';
import { migrationAuditAllowed } from './helpers/migration-audit-policy';
it('migration-audit DDL is denied unless its separate explicit opt-in is exactly 1', () => {
  for (const value of [undefined, '', '0', 'true', 'yes', ' 1', '1 ']) expect(migrationAuditAllowed(value)).toBe(false);
  expect(migrationAuditAllowed('1')).toBe(true);
});
