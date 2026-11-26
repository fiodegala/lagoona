import { describe, it, expect, vi, beforeEach } from 'vitest';
import { posService, CreateSaleData } from './posService';

const inserted = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) },
  from: () => {
    const query: Record<string, unknown> = {};
    for (const method of ['select', 'eq']) query[method] = () => query;
    query.maybeSingle = async () => ({ data: null, error: null });
    query.insert = (data: unknown) => { inserted(data); return query; };
    query.single = async () => ({ data: { id: 'sale-1' }, error: null });
    return query;
  },
} }));

const sale: CreateSaleData = { local_id: 'draft-1', items: [], subtotal: 100, total: 100, payment_method: 'pix' };
beforeEach(() => vi.clearAllMocks());
describe('Persistência da etiqueta na venda e na sincronização', () => {
  it('Salva a etiqueta selecionada junto da venda', async () => {
    await posService.createSale({ ...sale, action_tag_id: 'cashback-tag' });
    expect(inserted).toHaveBeenCalledWith(expect.objectContaining({ action_tag_id: 'cashback-tag', total: 100 }));
  });
  it('Sincroniza uma venda pendente sem perder a etiqueta', async () => {
    await posService.syncPendingSale({ ...sale, action_tag_id: 'birthday-tag' });
    expect(inserted).toHaveBeenCalledWith(expect.objectContaining({ action_tag_id: 'birthday-tag' }));
  });
  it('Uma venda sem etiqueta salva um vínculo vazio como null', async () => {
    await posService.createSale(sale);
    expect(inserted).toHaveBeenCalledWith(expect.objectContaining({ action_tag_id: null }));
  });
});