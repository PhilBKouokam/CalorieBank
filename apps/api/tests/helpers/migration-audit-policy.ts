/** Separate opt-in for legacy tests that execute DDL in disposable audit objects.
 * Never enable from a release wrapper. Requires task-specific migration-test approval.
 */
export function migrationAuditAllowed(value: string | undefined): boolean { return value === '1'; }
