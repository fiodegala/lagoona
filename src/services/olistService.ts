import { supabase } from '@/integrations/supabase/client';

export interface OlistConfig {
  id: string;
  is_active: boolean;
  environment: string;
  sync_products: boolean;
  sync_orders: boolean;
  sync_invoices: boolean;
  auto_sync_interval_minutes: number;
  last_product_sync_at: string | null;
  last_order_sync_at: string | null;
  last_error: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OlistSyncLog {
  id: string;
  sync_type: string;
  direction: string;
  status: string;
  records_processed: number;
  records_failed: number;
  error_message: string | null;
  details: Record<string, unknown>;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

async function invokeOlist(action: string, body?: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('olist-sync', {
    body: body || {},
    headers: { 'Content-Type': 'application/json' },
  });

  // The action is passed as query param, but supabase.functions.invoke doesn't support query params directly
  // So we use the body to pass the action
  return { data, error };
}

// We need to call with URL params, so let's use fetch directly
async function callOlist(action: string, body?: Record<string, unknown>) {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const url = `https://${projectId}.supabase.co/functions/v1/olist-sync?action=${action}`;
  
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  
  if (!token) throw new Error('Não autenticado');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: body ? JSON.stringify(body) : '{}',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Erro ${response.status}`);
  }

  return response.json();
}

export const olistService = {
  async testConnection(): Promise<{ connected: boolean; seller?: unknown; error?: string }> {
    return callOlist('test-connection');
  },

  async getConfig(): Promise<OlistConfig | null> {
    return callOlist('get-config');
  },

  async saveConfig(config: Partial<OlistConfig>): Promise<OlistConfig> {
    return callOlist('save-config', config as Record<string, unknown>);
  },

  async syncProducts(): Promise<{ processed: number; failed: number; total: number }> {
    return callOlist('sync-products');
  },

  async syncOrders(): Promise<{ processed: number; failed: number; total: number }> {
    return callOlist('sync-orders');
  },

  async sendInvoice(orderCode: string, invoiceData: { key: string; number: string; series?: string }): Promise<{ success: boolean }> {
    return callOlist('send-invoice', { order_code: orderCode, ...invoiceData });
  },

  async getLogs(): Promise<OlistSyncLog[]> {
    return callOlist('get-logs');
  },

  async getProductMappings(): Promise<unknown[]> {
    return callOlist('get-product-mappings');
  },

  async getOrderMappings(): Promise<unknown[]> {
    return callOlist('get-order-mappings');
  },
};
