/** Presentation only: retain the selected exact identity; never merge source evidence. */
const recognizableTrackers = new Set(['Cronometer', 'MyFitnessPal', 'Lose It!', 'MacroFactor', 'FatSecret']);
export function trackerChoices<T extends { label: string }>(options: readonly T[], selected: T | null): T[] {
  const ordered = selected ? [selected, ...options.filter((option) => option !== selected)] : [...options];
  const seen = new Set<string>();
  return ordered.filter((option) => {
    if (!recognizableTrackers.has(option.label)) return true;
    if (seen.has(option.label)) return false;
    seen.add(option.label);
    return true;
  });
}
