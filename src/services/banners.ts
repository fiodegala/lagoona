import { supabase } from '@/integrations/supabase/client';

export interface Banner {
  id: string;
  type: string;
  title: string | null;
  subtitle: string | null;
  image_url: string;
  link_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateBannerData {
  type: string;
  title?: string;
  subtitle?: string;
  image_url: string;
  link_url?: string;
  sort_order?: number;
  is_active?: boolean;
}

export const bannersService = {
  async getAll(): Promise<Banner[]> {
    const { data, error } = await supabase
      .from('banners')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return data as Banner[];
  },

  async getByType(type: string): Promise<Banner[]> {
    const { data, error } = await supabase
      .from('banners')
      .select('*')
      .eq('type', type)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return data as Banner[];
  },

  async create(banner: CreateBannerData): Promise<Banner> {
    const { data, error } = await supabase
      .from('banners')
      .insert(banner)
      .select()
      .single();
    if (error) throw error;
    return data as Banner;
  },

  async update(id: string, banner: Partial<CreateBannerData>): Promise<Banner> {
    const { data, error } = await supabase
      .from('banners')
      .update(banner)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Banner;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('banners').delete().eq('id', id);
    if (error) throw error;
  },

  async reorder(ids: string[]): Promise<void> {
    const updates = ids.map((id, index) =>
      supabase.from('banners').update({ sort_order: index }).eq('id', id)
    );
    await Promise.all(updates);
  },
};
