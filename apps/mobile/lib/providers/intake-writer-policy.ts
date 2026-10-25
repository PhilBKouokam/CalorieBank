export function preferDirectFoodSources<T extends { bundleIdentifier: string }>(
  writers: readonly T[],
  connections: readonly { provider: string; status: string }[],
  allowFatSecret = true,
): T[] {
  const fatSecretConnected = connections.some((connection) =>
    connection.provider === 'fatsecret' && connection.status === 'connected');
  return writers.filter((writer) =>
    (allowFatSecret && !fatSecretConnected) || writer.bundleIdentifier !== 'com.fatsecret.caloriecounter');
}
