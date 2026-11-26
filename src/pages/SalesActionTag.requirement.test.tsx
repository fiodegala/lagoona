import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Sales from './Sales';

const state = vi.hoisted(() => ({
  auth: {
    user: { id: 'seller-1' },
    isAdmin: false,
    isManager: false,
    userStoreId: 'store-1',
    managedStoreIds: ['store-1'],
    allowedMenus: [] as string[],
  },
  tags: [
    { id: 'cashback', name: 'Cashback', is_active: true },
    { id: 'birthday', name: 'Aniversário', is_active: true },
  ],
  sales: [] as Array<Record<string, unknown>>,
  rpc: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => state.auth }));
vi.mock('@/components/AdminLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/services/auditService', () => ({ auditService: { log: vi.fn() } }));
vi.mock('@/components/EditPaymentMethodModal', () => ({ default: () => null }));
vi.mock('@/components/EditSaleItemsModal', () => ({ default: () => null }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => state.rpc(...args),
    from: (table: string) => {
      const data = table === 'sale_action_tags' ? state.tags : table === 'pos_sales' ? state.sales : [];
      const query: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'in', 'or', 'order', 'range', 'gte', 'lte']) query[method] = () => query;
      query.single = async () => ({ data: null, error: null });
      query.then = (resolve: (value: unknown) => void) => resolve({ data, error: null });
      return query;
    },
  },
}));

Element.prototype.scrollIntoView = vi.fn();
Element.prototype.hasPointerCapture = vi.fn(() => false);
Element.prototype.setPointerCapture = vi.fn();
Element.prototype.releasePointerCapture = vi.fn();

const baseSale = {
  id: 'sale-completed-1',
  customer_id: null,
  customer_name: 'Cliente Exemplo',
  customer_document: null,
  user_id: 'seller-1',
  seller_id: 'seller-1',
  store_id: 'store-1',
  items: [{ name: 'Camisa', quantity: 1, unit_price: 150, total: 150 }],
  subtotal: 150,
  discount_amount: 0,
  total: 150,
  payment_method: 'pix',
  payment_details: { sale_origin: 'presencial' },
  status: 'completed',
  sale_type: 'varejo',
  is_campaign: false,
  action_tag_id: null as string | null,
  created_at: new Date().toISOString(),
};

function openSalesPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Sales />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  state.auth = {
    user: { id: 'seller-1' },
    isAdmin: false,
    isManager: false,
    userStoreId: 'store-1',
    managedStoreIds: ['store-1'],
    allowedMenus: [],
  };
  state.sales = [{ ...baseSale }];
  state.rpc.mockReset();
  state.rpc.mockImplementation(async (_fn: string, params: { _sale_id: string; _action_tag_id: string | null }) => {
    state.sales = state.sales.map(s => (s.id === params._sale_id ? { ...s, action_tag_id: params._action_tag_id } : s));
    return { data: null, error: null };
  });
});

describe('É possível marcar ou alterar a etiqueta de ação em vendas já concluídas', () => {
  it('O vendedor marca a etiqueta Cashback em uma venda concluída quando esqueceu de marcar no PDV', async () => {
    openSalesPage();
    fireEvent.click(await screen.findByRole('button', { name: /Detalhes/i }));
    const trigger = await screen.findByRole('combobox', { name: 'Etiqueta da ação' });
    await waitFor(() => expect(trigger).toBeEnabled());
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole('option', { name: 'Cashback' }));
    await waitFor(() => {
      expect(state.rpc).toHaveBeenCalledWith('set_pos_sale_action_tag', {
        _sale_id: 'sale-completed-1',
        _action_tag_id: 'cashback',
      });
    });
  });

  it('O gerente vê a etiqueta na lista e pode removê-la de uma venda concluída', async () => {
    state.auth = { ...state.auth, user: { id: 'manager-1' }, isManager: true };
    state.sales = [{ ...baseSale, action_tag_id: 'cashback' }];
    openSalesPage();
    expect(await screen.findByText('Cashback')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Detalhes/i }));
    const trigger = await screen.findByRole('combobox', { name: 'Etiqueta da ação' });
    await waitFor(() => expect(trigger).toBeEnabled());
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole('option', { name: 'Sem etiqueta' }));
    await waitFor(() => {
      expect(state.rpc).toHaveBeenCalledWith('set_pos_sale_action_tag', {
        _sale_id: 'sale-completed-1',
        _action_tag_id: null,
      });
    });
  });

  it('Não permite alterar a etiqueta de uma venda cancelada', async () => {
    state.auth = { ...state.auth, user: { id: 'admin-1' }, isAdmin: true };
    state.sales = [{ ...baseSale, id: 'sale-cancelled-1', status: 'cancelled' }];
    openSalesPage();
    fireEvent.click(await screen.findByRole('button', { name: /Detalhes/i }));
    const trigger = await screen.findByRole('combobox', { name: 'Etiqueta da ação' });
    expect(trigger).toBeDisabled();
    expect(state.rpc).not.toHaveBeenCalled();
  });
});