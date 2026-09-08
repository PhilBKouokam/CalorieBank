export function createSourceOperationGate() {
  let generation = 0;
  let active: { owner: string; generation: number } | null = null;
  return {
    begin(owner: string) {
      if (active) return false;
      active = { owner, generation };
      return true;
    },
    current() { return !active || active.generation === generation; },
    invalidate() { generation += 1; },
    end() { active = null; },
  };
}
