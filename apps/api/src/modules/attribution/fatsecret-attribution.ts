import type { AttributionProviders } from '@caloriebank/schemas';

type IntakeProvenance = {
  intakeProvider: string;
  intakeWriterBundleIdentifier?: string | null;
  intakeSourceId?: string | null;
  intakeProviderRecordId?: string | null;
  intakeSourceDisplayName?: string | null;
};
const appleWriter = 'com.fatsecret.caloriecounter';
const androidSource = 'com.fatsecret.android';
/** Use persisted provenance, never the currently selected source or an editable label. */
export function intakeAttributions(input: IntakeProvenance | null): AttributionProviders {
  if (!input) return [];
  if (input.intakeProvider === 'fatsecret') return ['fatsecret'];
  if (!['apple_health', 'health_connect'].includes(input.intakeProvider)) return [];
  if (input.intakeProvider === 'apple_health' && input.intakeWriterBundleIdentifier) {
    return input.intakeWriterBundleIdentifier === appleWriter ? ['fatsecret'] : [];
  }
  if (input.intakeProvider === 'health_connect') {
    if (input.intakeSourceId) return input.intakeSourceId === androidSource ? ['fatsecret'] : [];
    if (input.intakeProviderRecordId?.startsWith('health_connect:')) {
      return input.intakeProviderRecordId.startsWith(`health_connect:${androidSource}:`) ? ['fatsecret'] : [];
    }
  }
  // Older Opening Bank rows retain the verified writer's display name but not its ID.
  // Match only the stored native-writer label, including the app's add-correction suffix.
  return /^FatSecret(?: \+ [\d,]+ kcal added)?$/i.test(input.intakeSourceDisplayName ?? '') ? ['fatsecret'] : [];
}
