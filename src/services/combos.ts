import { supabase } from '@/integrations/supabase/client';

export interface ComboItem {
  id: string;
  combo_id: string;
  product_id: string;
  variation_id: string | null;
  quantity: number;
  product?: {
    id: string;
    name: string;
    price: number;
    image_url: string | null;
  };
  variation?: {
    id: string;
    price: number | null;
    product_variation_values: {
      attribute_value: {
        value: string;
        attribute: { name: string };
      };
    }[];
  } | null;
}

export interface Combo {
  id: string;
  name: string;
  description: string | null;
  combo_price: number;
  free_shipping: boolean;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  items?: ComboItem[];
}

export const combosService = {
  async list(): Promise<Combo[]> {
    const { data, error } = await supabase
      .from('product_combos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as Combo[];
  },

  async getWithItems(comboId: string): Promise<Combo | null> {
    const { data, error } = await supabase
      .from('product_combos')
      .select('*')
      .eq('id', comboId)
      .single();

    if (error) throw error;
    if (!data) return null;

    const { data: items } = await supabase
      .from('product_combo_items')
      .select('*')
      .eq('combo_id', comboId);

    return { ...(data as Combo), items: (items || []) as ComboItem[] };
  },

  async listActiveWithItems(): Promise<Combo[]> {
    const { data: combos, error } = await supabase
      .from('product_combos')
      .select('*')
      .eq('is_active', true);

    if (error) throw error;
    if (!combos?.length) return [];

    const comboIds = combos.map(c => c.id);
    const { data: items } = await supabase
      .from('product_combo_items')
      .select('*')
      .in('combo_id', comboIds);

    return (combos as Combo[]).map(combo => ({
      ...combo,
      items: ((items || []) as ComboItem[]).filter(i => i.combo_id === combo.id),
    }));
  },

  async create(combo: {
    name: string;
    description?: string;
    combo_price: number;
    free_shipping: boolean;
    image_url?: string;
    is_active?: boolean;
    items: { product_id: string; variation_id?: string | null; quantity: number }[];
  }): Promise<Combo> {
    const { items, ...comboData } = combo;

    const { data, error } = await supabase
      .from('product_combos')
      .insert(comboData as any)
      .select()
      .single();

    if (error) throw error;

    if (items.length > 0) {
      const comboItems = items.map(item => ({
        combo_id: data.id,
        product_id: item.product_id,
        variation_id: item.variation_id || null,
        quantity: item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from('product_combo_items')
        .insert(comboItems as any);

      if (itemsError) throw itemsError;
    }

    return data as Combo;
  },

  async update(id: string, combo: {
    name?: string;
    description?: string;
    combo_price?: number;
    free_shipping?: boolean;
    image_url?: string;
    is_active?: boolean;
    items?: { product_id: string; variation_id?: string | null; quantity: number }[];
  }): Promise<Combo> {
    const { items, ...comboData } = combo;

    const { data, error } = await supabase
      .from('product_combos')
      .update(comboData as any)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (items) {
      // Remove existing items
      await supabase
        .from('product_combo_items')
        .delete()
        .eq('combo_id', id);

      // Insert new items
      if (items.length > 0) {
        const comboItems = items.map(item => ({
          combo_id: id,
          product_id: item.product_id,
          variation_id: item.variation_id || null,
          quantity: item.quantity,
        }));

        const { error: itemsError } = await supabase
          .from('product_combo_items')
          .insert(comboItems as any);

        if (itemsError) throw itemsError;
      }
    }

    return data as Combo;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('product_combos')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async toggleActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('product_combos')
      .update({ is_active: isActive } as any)
      .eq('id', id);

    if (error) throw error;
  },
};
