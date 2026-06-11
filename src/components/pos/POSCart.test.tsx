import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import POSCart, { CartItem } from './POSCart';

// ResizeObserver mock (radix uses it)
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// @ts-expect-error attach to global
global.ResizeObserver = ResizeObserverMock;

const noop = () => {};

const baseItem = (over: Partial<CartItem>): CartItem => ({
  id: over.id || 'i1',
  product_id: 'p1',
  name: 'Produto X',
  unit_price: 100,
  quantity: 1,
  discount_amount: 0,
  total: 100,
  max_stock: 10,
  ...over,
});

const renderCart = (props: {
  items: CartItem[];
  subtotal: number;
  discountAmount: number;
  total: number;
  customerCredit?: number;
}) =>
  render(
    <POSCart
      items={props.items}
      onUpdateQuantity={noop}
      onRemoveItem={noop}
      onUpdatePrice={noop}
      onApplyItemDiscount={noop}
      onTogglePromoPrice={noop}
      generalDiscount={{ type: 'percentage', value: 0 }}
      onApplyGeneralDiscount={noop}
      subtotal={props.subtotal}
      discountAmount={props.discountAmount}
      customerCredit={props.customerCredit}
      total={props.total}
    />
  );

// Replica do cálculo de POSPage.tsx para validar a fórmula
const computeTotals = (
  newSubtotal: number,
  returnSubtotal: number,
  itemDiscounts = 0,
  generalDiscount = 0
) => {
  const discountsOnly = itemDiscounts + generalDiscount;
  const totalDiscount = discountsOnly + returnSubtotal;
  const rawBalance = newSubtotal - totalDiscount;
  const total = Math.max(0, rawBalance);
  const customerCredit = Math.max(0, -rawBalance);
  return { total, customerCredit, discountsOnly };
};

describe('POSCart — devolução maior que produtos novos', () => {
  it('calcula crédito = (devolução - novos - descontos) quando devolução excede novos', () => {
    // Novos 1798,80 / Devolução 1868,90 → diferença R$ 70,10 de crédito
    const r = computeTotals(1798.8, 1868.9);
    expect(r.total).toBe(0);
    expect(r.customerCredit).toBeCloseTo(70.1, 2);
  });

  it('total fica zerado e crédito é zero quando devolução == novos', () => {
    const r = computeTotals(500, 500);
    expect(r.total).toBe(0);
    expect(r.customerCredit).toBe(0);
  });

  it('não gera crédito quando devolução é menor que os novos', () => {
    const r = computeTotals(1000, 300);
    expect(r.total).toBe(700);
    expect(r.customerCredit).toBe(0);
  });

  it('inclui descontos ao calcular o crédito', () => {
    // Novos 1000 - desc 100 - devolução 1200 = -300 → crédito 300
    const r = computeTotals(1000, 1200, 50, 50);
    expect(r.total).toBe(0);
    expect(r.customerCredit).toBeCloseTo(300, 2);
  });

  it('renderiza linha "Crédito ao cliente / Diferença a devolver" quando customerCredit > 0', () => {
    const items: CartItem[] = [
      baseItem({ id: 'new', name: 'Camisa', unit_price: 100, total: 100 }),
      baseItem({
        id: 'ret',
        name: 'Sueter',
        unit_price: 170,
        total: 170,
        is_return: true,
      }),
    ];
    renderCart({
      items,
      subtotal: 100,
      discountAmount: 0,
      total: 0,
      customerCredit: 70,
    });

    expect(
      screen.getByText(/Crédito ao cliente \/ Diferença a devolver/i)
    ).toBeInTheDocument();
    // formato pt-BR R$ 70,00
    expect(screen.getByText(/R\$\s*70,00/)).toBeInTheDocument();
  });

  it('NÃO renderiza a linha de crédito quando customerCredit é 0', () => {
    renderCart({
      items: [baseItem({})],
      subtotal: 100,
      discountAmount: 0,
      total: 100,
      customerCredit: 0,
    });
    expect(
      screen.queryByText(/Crédito ao cliente \/ Diferença a devolver/i)
    ).not.toBeInTheDocument();
  });
});
