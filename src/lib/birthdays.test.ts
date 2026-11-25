import { describe, it, expect } from 'vitest';
import {
  birthdayPeriodRange,
  buildBirthdayMessage,
  formatDayMonthBR,
  isBirthdayPopupDue,
  isBirthdayToday,
} from './birthdays';

describe('aniversariantes helpers', () => {
  const now = new Date('2026-11-25T15:00:00Z'); // 12:00 Brasília

  it('identifica aniversário de hoje no horário de Brasília', () => {
    expect(isBirthdayToday('2026-11-25', now)).toBe(true);
    expect(isBirthdayToday('2026-11-24', now)).toBe(false);
    // 22:00 de 25/11 em Brasília = 01:00 UTC de 26/11
    expect(isBirthdayToday('2026-11-25', new Date('2026-11-26T01:00:00Z'))).toBe(true);
  });

  it('pop-up com janela padrão (0 antes, 0 depois) aparece apenas no dia e para pendentes', () => {
    expect(isBirthdayPopupDue('2026-11-25', 'pending', 0, 0, now)).toBe(true);
    expect(isBirthdayPopupDue('2026-11-26', 'pending', 0, 0, now)).toBe(false);
    expect(isBirthdayPopupDue('2026-11-24', 'pending', 0, 0, now)).toBe(false);
    expect(isBirthdayPopupDue('2026-11-25', 'sent', 0, 0, now)).toBe(false);
  });

  it('pop-up respeita antecedência e tolerância configuradas', () => {
    expect(isBirthdayPopupDue('2026-11-28', 'pending', 3, 0, now)).toBe(true);
    expect(isBirthdayPopupDue('2026-11-29', 'pending', 3, 0, now)).toBe(false);
    expect(isBirthdayPopupDue('2026-11-23', 'pending', 0, 2, now)).toBe(true);
    expect(isBirthdayPopupDue('2026-11-22', 'pending', 0, 2, now)).toBe(false);
  });

  it('monta mensagem substituindo nome, loja, data e idade com fallback de loja', () => {
    const msg = buildBirthdayMessage(
      'Parabéns, {nome} ({nome_completo})! {data_aniversario} - {idade} anos na {loja}.',
      { customer_name: 'MARIA OLIVEIRA', store_name: null, birthday_date: '2026-11-25', turning_age: 30 },
    );
    expect(msg).toBe('Parabéns, Maria (MARIA OLIVEIRA)! 25/11 - 30 anos na Fio de Gala.');
  });

  it('calcula intervalos de período corretamente', () => {
    expect(birthdayPeriodRange('today', now)).toEqual({ from: '2026-11-25', to: '2026-11-25' });
    expect(birthdayPeriodRange('tomorrow', now)).toEqual({ from: '2026-11-26', to: '2026-11-26' });
    expect(birthdayPeriodRange('month', now)).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(birthdayPeriodRange('next_month', now)).toEqual({ from: '2026-12-01', to: '2026-12-31' });
    expect(formatDayMonthBR('2026-11-25')).toBe('25/11');
  });
});