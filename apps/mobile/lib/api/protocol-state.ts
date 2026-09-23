// Compatibility state is account-scoped UI state, never an authentication signal.
let required = false;
const listeners = new Set<() => void>();
export const isUpdateRequired = () => required;
export function setUpdateRequired(value: boolean) {
  if (required === value) return;
  required = value;
  // Account scope is set during root rendering; notify subscribers afterwards.
  queueMicrotask(() => listeners.forEach(listener => listener()));
}
export function subscribeToProtocolState(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
