/** Exact transport-writer authority; legacy iOS semantics are preserved. */
export function matchesSelectedIntakeSource(
  record: { provider: string; writerBundleIdentifier?: string | null; sourceId?: string | null },
  selection: { appleHealthIntakeWriterBundleId: string | null; nativeIntakeSourceId?: string | null },
) {
  if (record.provider === 'apple_health') return Boolean(selection.appleHealthIntakeWriterBundleId) && record.writerBundleIdentifier === selection.appleHealthIntakeWriterBundleId;
  if (record.provider === 'health_connect') return Boolean(selection.nativeIntakeSourceId) && record.sourceId === selection.nativeIntakeSourceId;
  return true;
}
