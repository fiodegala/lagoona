import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DealsConfig {
  enabled: boolean;
  end_date: string | null;
  show_on_home: boolean;
}

export interface CountdownTime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

const computeTimeLeft = (endDate: string | null): number => {
  if (endDate) return new Date(endDate).getTime() - Date.now();
  // Fallback: end of today
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return end.getTime() - Date.now();
};

const toParts = (ms: number): CountdownTime => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    totalMs: Math.max(0, ms),
  };
};

let cachedConfig: DealsConfig | null = null;
let configPromise: Promise<DealsConfig> | null = null;

const loadConfig = async (): Promise<DealsConfig> => {
  if (cachedConfig) return cachedConfig;
  if (configPromise) return configPromise;
  configPromise = (async () => {
    try {
      const { data } = await supabase
        .from('store_config')
        .select('value')
        .eq('key', 'deals_countdown')
        .maybeSingle();
      const cfg = (data?.value as unknown as DealsConfig) || { enabled: false, end_date: null, show_on_home: false };
      cachedConfig = cfg;
      return cfg;
    } catch {
      const cfg = { enabled: false, end_date: null, show_on_home: false };
      cachedConfig = cfg;
      return cfg;
    }
  })();
  return configPromise;
};

/**
 * Shared countdown hook backed by `store_config.deals_countdown`.
 * Returns null until loaded; returns inactive=true when expired/disabled.
 */
export const useDealsCountdown = () => {
  const [config, setConfig] = useState<DealsConfig | null>(cachedConfig);
  const [time, setTime] = useState<CountdownTime>(() => toParts(0));

  useEffect(() => {
    let mounted = true;
    if (!cachedConfig) {
      loadConfig().then(cfg => { if (mounted) setConfig(cfg); });
    }
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!config) return;
    const tick = () => setTime(toParts(computeTimeLeft(config.end_date)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [config]);

  const active = !!config?.enabled && time.totalMs > 0;
  return { config, time, active, loaded: config !== null };
};
