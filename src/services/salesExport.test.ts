import { describe, it, expect } from 'vitest';
import { buildSaleRecord, describePayment, salesToCSV, salesToXML } from './salesExport';

const sale = {
  id: 'abc12345-0000', created_at: '2026-11-10T15:00:00Z', status: 'completed', sale_type: 'atacado',
  customer_id: 'c1', customer_name: 'X', subtotal: 300, discount_amount: 20, total: 280,
  payment_method: 'mixed', payment_details: { sale_origin: 'online', payments: [
    { type: 'credit', amount: 180, installments: 3 }, { type: 'pix', amount: 100, installments: 1 },
  ] },
  items: [
    { name: 'Camisa', sku: 'C1', quantity: 2, unit_price: 100, total: 200 },
    { name: 'Calça', sku: 'K1', quantity: 1, unit_price: 100, total: 100 },
  ],
};
const customer = { name: 'Maria Silva', document: '123.456.789-00', phone: '62999', email: 'm@x.com', city: 'Goiânia', state: 'GO' };

describe('exportação de vendas', () => {
  it('descreve pagamento misto com parcelas', () => {
    expect(describePayment('mixed', sale.payment_details)).toEqual({
      text: 'Crédito 3x R$ 180,00 + PIX R$ 100,00', installments: '3x',
    });
  });

  it('descreve cartão parcelado', () => {
    expect(describePayment('card', { cardType: 'credit', installments: 2, installmentValue: 75 }).installments).toBe('2x de R$ 75,00');
  });

  it('junta dados do cliente, loja, vendedor e itens', () => {
    const r = buildSaleRecord(sale, customer, 'Bernardo Sayão', 'Carol');
    expect(r.cliente).toBe('Maria Silva');
    expect(r.documento).toBe('123.456.789-00');
    expect(r.tipo).toBe('Atacado');
    expect(r.canal).toBe('Online');
    expect(r.loja).toBe('Bernardo Sayão');
    expect(r.vendedor).toBe('Carol');
    expect(r.qtd_pecas).toBe(3);
    expect(r.itens).toHaveLength(2);
  });

  it('CSV tem uma linha por item com os dados da venda repetidos', () => {
    const csv = salesToCSV([buildSaleRecord(sale, customer, 'BS', 'Carol')]);
    const lines = csv.replace('\uFEFF', '').split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('"Maria Silva"');
    expect(lines[1]).toContain('"Camisa"');
    expect(lines[2]).toContain('"Calça"');
    expect(lines[2]).toContain('"280,00"');
  });

  it('XML agrupa itens dentro da venda', () => {
    const xml = salesToXML([buildSaleRecord(sale, customer, 'BS', 'Carol')]);
    expect(xml.match(/<venda>/g)).toHaveLength(1);
    expect(xml.match(/<item>/g)).toHaveLength(2);
    expect(xml).toContain('<total>280.00</total>');
  });
});
