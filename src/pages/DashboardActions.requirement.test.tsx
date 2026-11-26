import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';

const auth = vi.hoisted(() => ({ user: { id: 'owner' }, profile: { full_name: 'Proprietário' }, roles: ['admin'], isAdmin: true, isManager: false, accessibleStoreIds: [], userStoreId: null, userStore: null, isLoading: false }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/components/AdminLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/dashboard/BrazilSalesMap', () => ({ default: () => null }));
vi.mock('@/components/dashboard/WhatsAppMetrics', () => ({ default: () => null }));
vi.mock('recharts', () => {
  const Container = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const Empty = () => null;
  return { ResponsiveContainer: Container, AreaChart: Container, BarChart: Container, PieChart: Container, Area: Empty, Bar: Empty, Pie: Empty, Cell: Empty, XAxis: Empty, YAxis: Empty, CartesianGrid: Empty, Tooltip: Empty };
});
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (table: string) => {
  const today = new Date().toISOString();
  const base = { user_id: 'owner', seller_id: 'owner', store_id: 'store-1', customer_id: 'customer-1', customer_name: 'Cliente exemplo', payment_method: 'pix', payment_details: {}, items: [], discount_amount: 0, sale_type: 'varejo', status: 'completed', created_at: today };
  const data = table === 'sale_action_tags' ? [{ id: 'cashback', name: 'Cashback', is_active: true }, { id: 'birthday', name: 'Aniversário', is_active: true }]
    : table === 'pos_sales' ? [
      { ...base, id: 'sale-1', action_tag_id: 'cashback', total: 100 },
      { ...base, id: 'sale-2', action_tag_id: 'cashback', total: 200, created_at: '2020-01-01T12:00:00Z' },
      { ...base, id: 'sale-3', action_tag_id: 'birthday', total: 80 },
      { ...base, id: 'sale-4', action_tag_id: 'cashback', total: 999, status: 'cancelled' },
      { ...base, id: 'sale-5', action_tag_id: null, total: 500 },
    ] : [];
  const query: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in', 'or', 'order', 'limit', 'range', 'gte', 'lte']) query[method] = () => query;
  query.then = (resolve: (value: unknown) => void) => resolve({ data, error: null });
  return query;
} } }));

function openDashboard() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><Dashboard /></MemoryRouter></QueryClientProvider>);
}

describe('O dashboard mostra o retorno de vendas de cada ação marcada no PDV', () => {
  it('O proprietário vê separadamente R$ 300 de Cashback e R$ 80 de Aniversário sem somar vendas canceladas ou sem etiqueta', async () => {
    openDashboard();
    const cashback = (await screen.findByRole('rowheader', { name: 'Cashback' })).closest('tr');
    const birthday = screen.getByRole('rowheader', { name: 'Aniversário' }).closest('tr');
    if (!cashback || !birthday) throw new Error('As ações precisam aparecer na tabela');
    expect(within(cashback).getByText('R$ 300,00')).toBeInTheDocument();
    expect(within(cashback).getByText('2')).toBeInTheDocument();
    expect(within(cashback).getByText('R$ 150,00')).toBeInTheDocument();
    expect(within(birthday).getAllByText('R$ 80,00')).toHaveLength(2);
  });
  it('O proprietário filtra Hoje e vê somente R$ 100 de Cashback vendido hoje', async () => {
    openDashboard();
    await screen.findByRole('rowheader', { name: 'Cashback' });
    fireEvent.click(screen.getByRole('button', { name: /^Hoje$/ }));
    await waitFor(() => {
      const row = screen.getByRole('rowheader', { name: 'Cashback' }).closest('tr');
      if (!row) throw new Error('A ação precisa aparecer');
      expect(within(row).getAllByText('R$ 100,00')).toHaveLength(2);
      expect(within(row).queryByText('R$ 300,00')).not.toBeInTheDocument();
    });
  });
});