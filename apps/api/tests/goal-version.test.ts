import {
  BankCalculationError,
  calculateFinalizedDailyBankChange,
  INITIAL_GOAL_EFFECTIVE_FROM,
  selectGoalActiveOnDate,
} from '@caloriebank/domain';
import { describe, expect, it } from 'vitest';

const at = (iso: string) => new Date(iso);

describe('selectGoalActiveOnDate', () => {
  const initial = {
    effectiveFrom: INITIAL_GOAL_EFFECTIVE_FROM,
    recordedAt: at('2026-11-01T15:00:00.000Z'),
    goalMode: 'cut' as const,
    dailyEnergyAdjustment: -500,
  };
  const edited = {
    effectiveFrom: '2026-11-12',
    recordedAt: at('2026-11-12T15:00:00.000Z'),
    goalMode: 'bulk' as const,
    dailyEnergyAdjustment: 300,
  };

  it('uses the goal active on that date and does not apply a later edit backward', () => {
    const versions = [initial, edited];
    expect(selectGoalActiveOnDate(versions, '2026-11-11')).toBe(initial);
    expect(selectGoalActiveOnDate(versions, '2026-11-12')).toBe(edited);
    expect(selectGoalActiveOnDate(versions, '2026-11-13')).toBe(edited);
    expect(versions).toHaveLength(2);
  });

  it('keeps the first saved goal for every earlier date', () => {
    expect(selectGoalActiveOnDate([initial], '2020-01-01')).toBe(initial);
  });

  it('returns null when every version starts after the date', () => {
    expect(selectGoalActiveOnDate([edited], '2026-11-11')).toBeNull();
    expect(selectGoalActiveOnDate([], '2026-11-11')).toBeNull();
  });

  it('resolves two edits on the same date to the later recording', () => {
    const earlierSameDay = { ...edited, dailyEnergyAdjustment: 100, recordedAt: at('2026-11-12T12:00:00.000Z') };
    const selected = selectGoalActiveOnDate([earlierSameDay, edited], '2026-11-12');
    expect(selected?.dailyEnergyAdjustment).toBe(300);
  });

  it('posts the selected goal through the finalized bank formula', () => {
    const beforeEdit = selectGoalActiveOnDate([initial, edited], '2026-11-11');
    const onEdit = selectGoalActiveOnDate([initial, edited], '2026-11-12');
    expect(beforeEdit).not.toBeNull();
    expect(onEdit).not.toBeNull();
    const shared = {
      importedTotalDailyExpenditure: 4000,
      expenditureAdjustmentRate: 0.8,
      importedCalorieIntake: 1800,
    };
    expect(calculateFinalizedDailyBankChange({
      ...shared,
      goalMode: beforeEdit!.goalMode,
      goalAdjustmentCalories: Math.abs(beforeEdit!.dailyEnergyAdjustment),
    }).dailyBankChange).toBe(900);
    expect(calculateFinalizedDailyBankChange({
      ...shared,
      goalMode: onEdit!.goalMode,
      goalAdjustmentCalories: Math.abs(onEdit!.dailyEnergyAdjustment),
    }).dailyBankChange).toBe(1700);
  });

  it('rejects a date that is not YYYY-MM-DD', () => {
    expect(() => selectGoalActiveOnDate([], '11/12/2026')).toThrow(BankCalculationError);
    expect(() => selectGoalActiveOnDate([
      { effectiveFrom: 'November 12', recordedAt: at('2026-11-01T00:00:00.000Z') },
    ], '2026-11-12')).toThrow(BankCalculationError);
    expect(() => selectGoalActiveOnDate([
      { effectiveFrom: '2026-11-12', recordedAt: new Date('not-a-time') },
    ], '2026-11-12')).toThrow(BankCalculationError);
  });
});
