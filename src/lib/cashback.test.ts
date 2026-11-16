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

import { cashbackValue, cashbackMinNextPurchase } from './cashback';

describe('tabela Fio de Gala | Cashback varejo (10%, cobre até 15% da próxima compra)', () => {
  const tabela: Array<[number, number, number]> = [
    [100, 10, 67], [200, 20, 134], [300, 30, 200], [400, 40, 267], [500, 50, 334],
    [600, 60, 400], [700, 70, 467], [900, 90, 600], [1000, 100, 667], [1500, 150, 1000],
    [1600, 160, 1067], [2000, 200, 1334], [2900, 290, 1934], [3000, 300, 2000],
  ];
  it.each(tabela)('compra de R$ %i gera R$ %i e exige compra mínima de R$ %i', (compra, cashback, minima) => {
    const cb = cashbackValue(compra, 10);
    expect(cb).toBe(cashback);
    expect(cashbackMinNextPurchase(cb, 15)).toBe(minima);
  });
});

import {
  validityFromToday,
  isSaleEligibleForCashback,
  latestSalePerCustomer,
  templateForReminder,
  DEFAULT_OLD_SALES_TEMPLATE,
  type OldSale,
} from './cashback';

describe('cashback de compras antigas', () => {
  it('validade a partir de hoje: 16/11/2026 + 30 dias = 16/12/2026', () => {
    expect(validityFromToday(30, new Date('2026-11-16T19:20:00Z'))).toBe('2026-12-16');
  });
  it('às 22h de Brasília ainda conta o dia de hoje', () => {
    expect(validityFromToday(30, new Date('2026-11-17T01:00:00Z'))).toBe('2026-12-16');
  });

  const sale: OldSale = {
    id: 's1', created_at: '2026-08-01T15:00:00Z', customer_id: 'c1', customer_name: 'JOÃO',
    sale_type: 'varejo', status: 'completed', total: 1000, store_id: 'st',
  };
  const rules = { sale_types: ['varejo'], min_sale_value: 0 };

  it('compra de varejo concluída com cliente gera', () => {
    expect(isSaleEligibleForCashback(sale, rules)).toBe(true);
  });
  it('atacado não gera', () => {
    expect(isSaleEligibleForCashback({ ...sale, sale_type: 'atacado' }, rules)).toBe(false);
  });
  it('Consumidor Final não gera', () => {
    expect(isSaleEligibleForCashback({ ...sale, customer_name: 'Consumidor Final' }, rules)).toBe(false);
  });
  it('venda cancelada não gera', () => {
    expect(isSaleEligibleForCashback({ ...sale, status: 'cancelled' }, rules)).toBe(false);
  });

  it('só a compra mais recente de cada cliente', () => {
    const list = [
      { ...sale, id: 'a', created_at: '2026-08-01T15:00:00Z' },
      { ...sale, id: 'b', created_at: '2026-09-10T15:00:00Z' },
      { ...sale, id: 'c', customer_id: 'c2', created_at: '2026-07-05T15:00:00Z' },
    ];
    expect(latestSalePerCustomer(list).map((s) => s.id).sort()).toEqual(['b', 'c']);
  });

  it('aviso de compra antiga usa a mensagem própria', () => {
    expect(templateForReminder({ source: 'sale_manual' }, { message_template: 'normal' })).toBe(DEFAULT_OLD_SALES_TEMPLATE);
    expect(templateForReminder({ source: 'auto' }, { message_template: 'normal' })).toBe('normal');
  });
});
