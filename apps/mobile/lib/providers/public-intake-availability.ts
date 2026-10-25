export function allowsFatSecret(response: { intakeAvailability?: { fatSecret: boolean } | undefined } | null | undefined): boolean {
  // A loaded legacy response retains private-beta behavior; a loading account does not expose choices.
  return Boolean(response && response.intakeAvailability?.fatSecret !== false);
}
