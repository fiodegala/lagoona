import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  DEFAULT_VALENTINES_CONFIG,
  isValentinesPromoActive,
  VALENTINES_CONFIG_KEY,
  type ValentinesPromoConfig,
} from '@/lib/valentinesPromo';

let cachedConfig: ValentinesPromoConfig | null = null;
const subscribers = new Set<(c: ValentinesPromoConfig) => void>();
let inflight: Promise<ValentinesPromoConfig> | null = null;
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let tickInterval: ReturnType<typeof setInterval> | null = null;
let lastActive: boolean | null = null;

function ensureRealtime() {
  if (realtimeChannel || typeof window === 'undefined') return;
  realtimeChannel = supabase
    .channel('valentines-promo-config')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'store_config', filter: `key=eq.${VALENTINES_CONFIG_KEY}` },
      (payload) => {
        const next = (payload.new as { value?: Partial<ValentinesPromoConfig> } | null)?.value;
        if (next && typeof next === 'object') {
          const merged: ValentinesPromoConfig = { ...DEFAULT_VALENTINES_CONFIG, ...next };
          cachedConfig = merged;
          lastActive = isValentinesPromoActive(merged);
          subscribers.forEach((cb) => cb(merged));
        } else {
          cachedConfig = null;
          fetchValentinesConfig();
        }
      }
    )
    .subscribe();

  // Re-evaluate active window (start/end time crossings) every 30s
  tickInterval = setInterval(() => {
    if (!cachedConfig || subscribers.size === 0) return;
    const active = isValentinesPromoActive(cachedConfig);
    if (active !== lastActive) {
      lastActive = active;
      // Trigger re-render by emitting same config object reference clone
      const refreshed = { ...cachedConfig };
      cachedConfig = refreshed;
      subscribers.forEach((cb) => cb(refreshed));
    }
  }, 30000);
}

async function fetchValentinesConfig(): Promise<ValentinesPromoConfig> {
  if (cachedConfig) return cachedConfig;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { data } = await supabase
        .from('store_config')
        .select('value')
        .eq('key', VALENTINES_CONFIG_KEY)
        .maybeSingle();
      const cfg = (data?.value as unknown as Partial<ValentinesPromoConfig>) || {};
      const merged: ValentinesPromoConfig = { ...DEFAULT_VALENTINES_CONFIG, ...cfg };
      cachedConfig = merged;
      subscribers.forEach((cb) => cb(merged));
      return merged;
    } catch {
      cachedConfig = DEFAULT_VALENTINES_CONFIG;
      return DEFAULT_VALENTINES_CONFIG;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Invalidate cache so the next read fetches fresh config (use after admin saves). */
export function invalidateValentinesPromo(next?: ValentinesPromoConfig) {
  cachedConfig = next ?? null;
  if (next) subscribers.forEach((cb) => cb(next));
  else fetchValentinesConfig();
}

export function useValentinesPromo() {
  const [config, setConfig] = useState<ValentinesPromoConfig>(
    cachedConfig ?? DEFAULT_VALENTINES_CONFIG
  );

  useEffect(() => {
    let mounted = true;
    fetchValentinesConfig().then((c) => {
      if (mounted) setConfig(c);
    });
    const sub = (c: ValentinesPromoConfig) => {
      if (mounted) setConfig(c);
    };
    subscribers.add(sub);
    return () => {
      mounted = false;
      subscribers.delete(sub);
    };
  }, []);

  return {
    config,
    active: isValentinesPromoActive(config),
    label: config.label,
    discountPercent: config.discount_percent,
  };
}
