import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import QuoteEditModal from './QuoteEditModal';

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  eq: vi.fn().mockResolvedValue({ error: null }),
  insert: vi.fn().mockResolvedValue({ error: null }),
  search: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: () => ({ update: mocks.update, insert: mocks.insert }),
} }));
vi.mock('@/services/posService', () => ({ posService: { searchProducts: mocks.search } }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-1' }, profile: { full_name: 'Teste' } }) }));

describe('Inclusão de produtos em orçamento existente', () => {
  it('mantém os itens originais e salva o produto adicionado no mesmo orçamento', async () => {
    mocks.update.mockReturnValue({ eq: mocks.eq });
    mocks.search.mockResolvedValue({ matchedVariationMap: {}, products: [{
      id: 'product-2', name: 'Camisa nova', price: 80, stock: 4,
      image_url: null, barcode: null, product_variations: [],
    }] });
    render(<QuoteEditModal open onOpenChange={vi.fn()} onSaved={vi.fn()} quote={{
      id: 'quote-1', customer_name: 'Cliente', customer_document: null, customer_phone: null,
      items: [{ product_id: 'product-1', name: 'Camisa original', quantity: 2, unit_price: 100, discount_amount: 0, total: 200 }],
      subtotal: 200, total: 200, discount_amount: 0, discount_type: null, discount_value: null,
      notes: null, payment_method: null, payment_details: null,
    }} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Adicionar produto' }), { target: { value: 'Camisa nova' } });
    fireEvent.click(await screen.findByRole('button', { name: /Camisa nova/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar Alterações' }));
    await waitFor(() => expect(mocks.eq).toHaveBeenCalledWith('id', 'quote-1'));
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      subtotal: 280, total: 280,
      items: [
        expect.objectContaining({ product_id: 'product-1', quantity: 2, unit_price: 100 }),
        expect.objectContaining({ product_id: 'product-2', quantity: 1, unit_price: 80 }),
      ],
    }));
  });
});