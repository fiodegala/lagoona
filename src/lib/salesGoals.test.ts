import { describe, expect, it } from 'vitest';
import { calculateDailyGoalTarget, getBusinessDays } from './salesGoals';

describe('calculateDailyGoalTarget', () => {
  it('divide o saldo restante da meta mensal pelos dias úteis restantes', () => {
    const result = calculateDailyGoalTarget({
      monthlyTarget: 56000,
      monthTotal: 54180.48,
      configuredDailyTarget: 2154,
      date: new Date(2026, 3, 29),
    });

    expect(result.remainingDays).toBe(2);
    expect(result.monthlyRemaining).toBeCloseTo(1819.52, 2);
    expect(result.dynamicTarget).toBeCloseTo(909.76, 2);
    expect(result.target).toBeCloseTo(909.76, 2);
    expect(result.calculationSource).toBe('Saldo da meta mensal dividido pelos dias úteis restantes');
  });

  it('recalcula a meta diária quando a meta mensal já foi parcialmente atingida e ainda faltam dias úteis', () => {
    const result = calculateDailyGoalTarget({
      monthlyTarget: 10000,
      monthTotal: 7000,
      configuredDailyTarget: 1000,
      date: new Date(2026, 3, 27),
    });

    expect(result.remainingDays).toBe(4);
    expect(result.monthlyRemaining).toBe(3000);
    expect(result.target).toBe(750);
  });

  it('usa a meta diária cadastrada quando a meta mensal já foi batida', () => {
    const result = calculateDailyGoalTarget({
      monthlyTarget: 56000,
      monthTotal: 57000,
      configuredDailyTarget: 2154,
      date: new Date(2026, 3, 29),
    });

    expect(result.monthlyRemaining).toBe(0);
    expect(result.dynamicTarget).toBe(0);
    expect(result.target).toBe(2154);
    expect(result.calculationSource).toBe('Meta diária cadastrada');
  });

  it('considera domingos e feriados nacionais fora dos dias úteis restantes', () => {
    expect(getBusinessDays(new Date(2026, 3, 20), 'remaining')).toBe(9);
  });
});