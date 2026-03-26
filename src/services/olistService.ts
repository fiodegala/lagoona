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

  async pushProducts(productIds?: string[]): Promise<{ processed: number; failed: number; total: number; created: number; updated: number; queued: number }> {
    let offset = 0;
    let logId: string | undefined;
    let aggregate = { processed: 0, failed: 0, total: 0, created: 0, updated: 0, queued: 0 };

    while (true) {
      const requestBody: Record<string, unknown> = {
        offset,
        limit: 10,
        logId,
      };
      if (productIds && productIds.length > 0) {
        requestBody.productIds = productIds;
      }

      const result = await callOlist('push-products', requestBody) as {
        processed: number;
        failed: number;
        total: number;
        created: number;
        updated: number;
        queued: number;
        hasMore?: boolean;
        nextOffset?: number;
        logId?: string;
      };

      logId = result.logId || logId;
      aggregate = {
        processed: result.processed,
        failed: result.failed,
        total: result.total,
        created: result.created,
        updated: result.updated,
        queued: result.queued || 0,
      };

      if (!result.hasMore) {
        return aggregate;
      }

      offset = result.nextOffset ?? offset + 10;
    }
  },

  async reconcileProducts(): Promise<{ resolved: number; pending: number; total: number }> {
    return callOlist('reconcile-products');
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
