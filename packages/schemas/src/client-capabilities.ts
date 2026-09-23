/** Protocol negotiation only; never authentication or account authorization. */
export const CLIENT_CAPABILITIES_HEADER = 'x-caloriebank-capabilities';
export const INTAKE_AUTHORITY_CAPABILITY = 'intake-authority-v2';
export const UPDATE_REQUIRED_CODE = 'UPDATE_REQUIRED';
export const UPDATE_REQUIRED_MESSAGE = 'Update CalorieBank to continue with this account.';

export function supportsIntakeAuthority(value: string | undefined): boolean {
  if (!value || value.length > 1024) return false;
  const tokens = value.split(',').map((token) => token.trim());
  if (tokens.some((token) => !/^[a-z][a-z0-9-]{0,63}$/.test(token))) return false;
  return tokens.includes(INTAKE_AUTHORITY_CAPABILITY);
}
