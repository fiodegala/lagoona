import { describe, it, expect } from 'vitest';
import { buildCashbackMessage, isReminderDue, normalizeWhatsappPhone, type CashbackReminder } from './cashback';

const base: CashbackReminder = {
  id: 'r1', sale_id: 's1', customer_id: 'c1', customer_name: 'JOÃO DA SILVA', customer_phone: '62981872091',
  customer_document: null, store_id: 'st', store_name: 'Hyper Modas 44',
  sale_date: '2026-11-12T16:00:00Z', sale_total: 1000, items: [], cashback_percent: 10,
  cashback_value: 100, min_use_value: 150, expires_at: '2026-12-12', status: 'pending', sent_at: null, sent_by: null,
};

describe('isReminderDue', () => {
  it('não aparece no mesmo dia da compra', () => {
    expect(isReminderDue(base, new Date('2026-11-12T23:00:00Z'))).toBe(false); // 20h em Brasília
  });
  it('aparece no dia seguinte à compra (horário de Brasília)', () => {
    expect(isReminderDue(base, new Date('2026-11-13T03:01:00Z'))).toBe(true); // 00:01 de 13/11
  });
  it('compra às 22h de Brasília (01h UTC) conta como do dia 12, não do dia 13', () => {
    const late = { ...base, sale_date: '2026-11-13T01:00:00Z' }; // 22h de 12/11
    expect(isReminderDue(late, new Date('2026-11-13T02:30:00Z'))).toBe(false); // 23h30 de 12/11
    expect(isReminderDue(late, new Date('2026-11-13T12:00:00Z'))).toBe(true); // 9h de 13/11
  });
  it('some depois de marcado como enviado', () => {
    expect(isReminderDue({ ...base, status: 'sent' }, new Date('2026-11-13T12:00:00Z'))).toBe(false);
  });
  it('some depois que a validade passa', () => {
    expect(isReminderDue(base, new Date('2026-12-12T12:00:00Z'))).toBe(true);
    expect(isReminderDue(base, new Date('2026-12-13T12:00:00Z'))).toBe(false);
  });
});

describe('buildCashbackMessage', () => {
  it('preenche nome, valores, compra mínima e validade', () => {
    const msg = buildCashbackMessage('{nome}: {valor_compra} na {loja} em {data_compra} gerou {cashback} acima de {compra_minima} até {validade}', base);
    expect(msg).toBe('João: R$\u00a01.000,00 na Hyper Modas 44 em 12/11/2026 gerou R$\u00a0100,00 acima de R$\u00a0150,00 até 12/12/2026');
  });
});

describe('normalizeWhatsappPhone', () => {
  it('adiciona o 55 em celulares com DDD', () => {
    expect(normalizeWhatsappPhone('(62) 98187-2091')).toBe('5562981872091');
  });
  it('rejeita telefone incompleto', () => {
    expect(normalizeWhatsappPhone('98187')).toBeNull();
  });
});
