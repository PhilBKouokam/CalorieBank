export function preferDirectFoodSources<T extends { bundleIdentifier: string }>(
  writers: readonly T[],
  connections: readonly { provider: string; status: string }[],
): T[] {
  const fatSecretConnected = connections.some((connection) =>
    connection.provider === 'fatsecret' && connection.status === 'connected');
  return writers.filter((writer) =>
    !fatSecretConnected || writer.bundleIdentifier !== 'com.fatsecret.caloriecounter');
}
