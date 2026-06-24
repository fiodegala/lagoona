import { supabase } from '@/integrations/supabase/client';

const SITE_STORE_ID = 'e0b8ebbc-1b3b-4aec-b5f7-6925762e6ea1';
const CACHE_KEY = 'top5_site_products_v1';
const TTL_MS = 6 * 60 * 60 * 1000; // 6h

const normalize = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const baseName = (s: string) => {
  // Drop variation tails like " - tamanho M / Preto"
  const cut = s.split(/\s+[-—]\s+/)[0];
  return normalize(cut);
};

interface Cache { at: number; names: string[] }

export async function getTop5SiteProductNames(): Promise<string[]> {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(CACHE_KEY) : null;
    if (raw) {
      const c: Cache = JSON.parse(raw);
      if (Date.now() - c.at < TTL_MS && Array.isArray(c.names)) return c.names;
    }
  } catch {}

  const counts: Record<string, number> = {};
  const pageSize = 1000;
  let from = 0;
  const statuses = ['confirmed', 'completed', 'delivered', 'processing', 'shipped'];

  for (let i = 0; i < 10; i++) {
    const { data, error } = await supabase
      .from('orders')
      .select('items')
      .eq('store_id', SITE_STORE_ID)
      .in('status', statuses)
      .range(from, from + pageSize - 1);
    if (error || !data) break;
    for (const o of data) {
      const items = (o as any).items || [];
      for (const it of items) {
        const name = baseName(it?.name || '');
        if (!name) continue;
        const qty = Number(it?.quantity || it?.qty || 1);
        counts[name] = (counts[name] || 0) + qty;
      }
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const names = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([n]) => n);

  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), names } satisfies Cache));
  } catch {}

  return names;
}

export function isTop5ByName(productName: string, top: string[]): boolean {
  if (!productName || !top?.length) return false;
  const n = baseName(productName);
  return top.includes(n);
}
