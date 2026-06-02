import { supabase } from '@/integrations/supabase/client';

export interface Banner {
  id: string;
  type: string;
  title: string | null;
  subtitle: string | null;
  image_url: string;
  image_url_mobile: string | null;
  video_url: string | null;
  video_url_mobile: string | null;
  media_type: string;
  link_url: string | null;
  sort_order: number;
  is_active: boolean;
  overlay_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateBannerData {
  type: string;
  title?: string;
  subtitle?: string;
  image_url: string;
  image_url_mobile?: string;
  video_url?: string;
  video_url_mobile?: string;
  media_type?: string;
  link_url?: string;
  sort_order?: number;
  is_active?: boolean;
  overlay_enabled?: boolean;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const BANNERS_FN_URL = `${SUPABASE_URL}/functions/v1/store-banners`;

// Cache em memória do lado cliente (mesma sessão / mesma aba)
const clientCache = new Map<string, { data: Banner[]; expiresAt: number }>();
const CLIENT_TTL_MS = 60_000;

async function invalidateServerCache() {
  try {
    await fetch(`${BANNERS_FN_URL}/invalidate`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
      },
    });
  } catch {
    // best effort
  }
  clientCache.clear();
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
    const now = Date.now();
    const cached = clientCache.get(type);
    if (cached && cached.expiresAt > now) return cached.data;

    const res = await fetch(`${BANNERS_FN_URL}?type=${encodeURIComponent(type)}`, {
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
      },
    });
    if (!res.ok) throw new Error(`Failed to load banners (${res.status})`);
    const data = (await res.json()) as Banner[];
    clientCache.set(type, { data, expiresAt: now + CLIENT_TTL_MS });
    return data;
  },

  async create(banner: CreateBannerData): Promise<Banner> {
    const { data, error } = await supabase
      .from('banners')
      .insert(banner)
      .select()
      .single();
    if (error) throw error;
    await invalidateServerCache();
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
    await invalidateServerCache();
    return data as Banner;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('banners').delete().eq('id', id);
    if (error) throw error;
    await invalidateServerCache();
  },

  async reorder(ids: string[]): Promise<void> {
    const updates = ids.map((id, index) =>
      supabase.from('banners').update({ sort_order: index }).eq('id', id)
    );
    await Promise.all(updates);
    await invalidateServerCache();
  },
};

