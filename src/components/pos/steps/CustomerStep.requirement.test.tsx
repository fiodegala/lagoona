import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CustomerStep from './CustomerStep';
import PaymentStep from './PaymentStep';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

Element.prototype.scrollIntoView = vi.fn();
Element.prototype.hasPointerCapture = vi.fn(() => false);
Element.prototype.setPointerCapture = vi.fn();
Element.prototype.releasePointerCapture = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ isAdmin: false, isManager: false }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => {
  const query: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'order', 'limit', 'range']) query[method] = () => query;
  query.then = (resolve: (value: unknown) => void) => resolve({ data: [{ id: 'action-cashback', name: 'Cashback', is_active: true }], error: null });
  return query;
} } }));

describe('O vendedor pode marcar a ação que trouxe o cliente na venda do PDV', () => {
  it('O vendedor seleciona Cashback como etiqueta da venda', async () => {
    const onActionTagChange = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><CustomerStep selectedCustomer={null} onSelectCustomer={vi.fn()} saleType="varejo" onNext={vi.fn()} onBack={vi.fn()} actionTagId={null} onActionTagChange={onActionTagChange} /></QueryClientProvider>);
    fireEvent.click(await screen.findByRole('combobox', { name: 'Etiqueta da ação' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Cashback' }));
    expect(onActionTagChange).toHaveBeenCalledWith('action-cashback');
  });
  it('O vendedor seleciona uma etiqueta criada ao finalizar a venda', async () => {
    const onActionTagChange = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><PaymentStep cartItems={[]} subtotal={100} discountAmount={0} total={100} saleType="varejo" selectedSeller={null} selectedCustomer={null} isProcessing={false} onPayment={vi.fn()} onBack={vi.fn()} actionTagId={null} onActionTagChange={onActionTagChange} /></QueryClientProvider>);
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Etiqueta da ação' })).toBeEnabled());
    fireEvent.click(await screen.findByRole('combobox', { name: 'Etiqueta da ação' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Cashback' }));
    expect(onActionTagChange).toHaveBeenCalledWith('action-cashback');
  });
});