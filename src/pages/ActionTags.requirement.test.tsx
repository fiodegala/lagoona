import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ActionTags from './ActionTags';

const state = vi.hoisted(() => ({ tags: [{ id: 'cashback', name: 'Cashback', is_active: true }], inserted: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner' }, isAdmin: true, isManager: false, managedStoreIds: [] }) }));
vi.mock('@/components/AdminLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (table: string) => {
  const data = table === 'sale_action_tags' ? state.tags : table === 'stores' ? [] : [
    { id: 'sale-1', action_tag_id: 'cashback', total: 150, customer_id: 'customer-1', customer_name: 'Cliente exemplo', status: 'completed', sale_type: 'varejo' },
    { id: 'sale-2', action_tag_id: 'cashback', total: 900, customer_id: 'customer-2', customer_name: 'Cliente exemplo 2', status: 'cancelled', sale_type: 'varejo' },
  ];
  const query: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'not', 'in', 'order', 'range', 'gte', 'lte']) query[method] = () => query;
  query.insert = (tag: { name: string }) => { state.inserted(tag); state.tags = [...state.tags, { id: 'new-tag', name: tag.name, is_active: true }]; return query; };
  query.single = async () => ({ data: { id: 'new-tag' }, error: null });
  query.then = (resolve: (value: unknown) => void) => resolve({ data, error: null });
  return query;
} } }));

Element.prototype.scrollIntoView = vi.fn();
Element.prototype.hasPointerCapture = vi.fn(() => false);
Element.prototype.setPointerCapture = vi.fn();
Element.prototype.releasePointerCapture = vi.fn();

beforeEach(() => { state.tags = [{ id: 'cashback', name: 'Cashback', is_active: true }]; state.inserted.mockClear(); });
function openPage() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ActionTags /></QueryClientProvider>);
}
describe('O dashboard mostra o retorno de vendas de cada ação marcada no PDV', () => {
  it('O proprietário cria uma etiqueta na seção própria e seu painel de resultados aparece automaticamente sem vendas', async () => {
    openPage();
    await screen.findByText('Cashback');
    fireEvent.change(screen.getByLabelText('Nova etiqueta'), { target: { value: 'Reativação' } });
    fireEvent.click(screen.getByRole('button', { name: /^Criar$/ }));
    await screen.findByText('Reativação');
    expect(state.inserted).toHaveBeenCalledWith({ name: 'Reativação' });
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Resultados' }), { button: 0, ctrlKey: false });
    const panel = await screen.findByLabelText('Resultados de Reativação');
    expect(within(panel).getAllByText('R$ 0,00')).toHaveLength(2);
    expect(within(panel).getAllByText('0')).toHaveLength(2);
  });
  it('O proprietário vê R$ 150 vendidos na ação Cashback na seção de resultados sem contar a venda cancelada', async () => {
    openPage();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Resultados' }), { button: 0, ctrlKey: false });
    await waitFor(() => {
      const panel = screen.getByLabelText('Resultados de Cashback');
      expect(within(panel).getAllByText('R$ 150,00')).toHaveLength(2);
      expect(within(panel).queryByText('R$ 1.050,00')).not.toBeInTheDocument();
    });
  });
});