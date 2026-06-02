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
