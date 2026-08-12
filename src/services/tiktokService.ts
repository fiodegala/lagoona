import { supabase } from '@/integrations/supabase/client';

export interface TikTokConfig {
  id: string;
  shop_id: string | null;
  shop_name: string | null;
  store_id: string | null;
  is_active: boolean;
  auto_sync_stock: boolean;
  auto_sync_price: boolean;
  auto_import_orders: boolean;
  last_sync_at: string | null;
  last_order_sync_at: string | null;
}

export interface TikTokSyncLog {
  id: string;
  sync_type: string;
  direction: string;
  status: string;
  items_processed: number;
  items_failed: number;
  message: string | null;
  created_at: string;
}

export interface TikTokProductMapping {
  id: string;
  tiktok_product_id: string;
  tiktok_sku_id: string | null;
  seller_sku: string | null;
  product_id: string | null;
  variation_id: string | null;
  sync_status: string;
  sync_error: string | null;
  last_synced_at: string | null;
  products?: { name: string } | null;
  product_variations?: { sku: string | null } | null;
}

export interface TikTokOrderMapping {
  id: string;
  tiktok_order_id: string;
  order_id: string | null;
  tiktok_status: string | null;
  local_status: string | null;
  total: number | null;
  stock_deducted: boolean;
  created_at: string;
}

async function callTikTok<T>(action: string, body?: Record<string, unknown>): Promise<T> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const url = `https://${projectId}.supabase.co/functions/v1/tiktok-sync?action=${action}`;

  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) throw new Error('Não autenticado');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(body || {}),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Erro ${response.status}`);
  return data as T;
}

export interface TikTokAuthStatus {
  has_app_credentials: boolean;
  has_token: boolean;
  seller_name: string | null;
  access_token_expires_at: string | null;
  refresh_token_expires_at: string | null;
  token_created_at: string | null;
  shop_cipher_configured: boolean;
  shop_name: string | null;
  shop_id: string | null;
}

export const tiktokService = {
  authStatus: () => callTikTok<TikTokAuthStatus>('auth-status'),
  authUrl: (serviceId: string) => callTikTok<{ url: string; service_id: string }>('auth-url', { service_id: serviceId }),
  authorize: (authCode: string) =>
    callTikTok<{ authorized: boolean; seller_name: string | null; shop_cipher_configured: boolean; shop_fetch_warning: string | null; shops: { id: string; name: string }[] }>('authorize', { auth_code: authCode }),
  refreshToken: () => callTikTok<{ refreshed: boolean; access_token_expires_at: string | null }>('refresh-token'),
  clearAuth: () => callTikTok<{ cleared: boolean }>('clear-auth'),
  testConnection: () => callTikTok<{ connected: boolean; shops: { id: string; name: string }[] }>('test-connection'),
  getConfig: () => callTikTok<TikTokConfig>('get-config'),
  saveConfig: (config: Partial<TikTokConfig>) => callTikTok<TikTokConfig>('save-config', config as Record<string, unknown>),

  pullProducts: () =>
    callTikTok<{ processed: number; matched: number; unmatched: number; unmatchedSample: { title: string; seller_sku: string | null }[] }>('pull-products'),
  pushStock: () => callTikTok<{ processed: number; failed: number; message?: string }>('push-stock'),
  pullOrders: (sinceHours = 72) =>
    callTikTok<{ processed: number; created: number; updated: number; failed: number }>('pull-orders', { sinceHours }),
  getLogs: () => callTikTok<TikTokSyncLog[]>('get-logs'),
  getProductMappings: () => callTikTok<TikTokProductMapping[]>('get-product-mappings'),
  getOrderMappings: () => callTikTok<TikTokOrderMapping[]>('get-order-mappings'),
};
