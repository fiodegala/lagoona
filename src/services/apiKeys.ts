import { supabase } from '@/integrations/supabase/client';

export interface ApiKey {
  id: string;
  name: string;
  description: string | null;
  public_key: string;
  status: 'active' | 'revoked' | 'expired';
  scopes: string[];
  allowed_ips: string[];
  rate_limit_per_minute: number;
  last_used_at: string | null;
  last_used_ip: string | null;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiKeyLog {
  id: string;
  api_key_id: string;
  endpoint: string;
  method: string;
  status_code: number;
  ip_address: string | null;
  user_agent: string | null;
  request_body_size: number | null;
  response_time_ms: number | null;
  created_at: string;
}

export interface CreateApiKeyData {
  name: string;
  description?: string;
  scopes: string[];
  allowed_ips?: string[];
  rate_limit_per_minute?: number;
  expires_at?: string;
}

export const apiKeysService = {
  async getAll(): Promise<ApiKey[]> {
    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as ApiKey[];
  },

  async getById(id: string): Promise<ApiKey | null> {
    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as ApiKey;
  },

  async create(input: CreateApiKeyData): Promise<{ 
    apiKey: ApiKey; 
    secretKey: string;
    accessToken: string;
    webhookSecret: string;
  }> {
    const { data, error } = await supabase.functions.invoke('manage-api-key', {
      body: {
        action: 'create',
        name: input.name,
        description: input.description,
        scopes: input.scopes,
        allowed_ips: input.allowed_ips,
        rate_limit_per_minute: input.rate_limit_per_minute,
        expires_at: input.expires_at,
      },
    });

    if (error) throw error;
    return data;
  },

  async revoke(id: string): Promise<void> {
    const { error } = await supabase
      .from('api_keys')
      .update({ status: 'revoked' })
      .eq('id', id);

    if (error) throw error;
  },

  async rotate(id: string): Promise<{ publicKey: string; secretKey: string; accessToken: string; webhookSecret: string }> {
    const { data, error } = await supabase.functions.invoke('manage-api-key', {
      body: { action: 'rotate', id },
    });

    if (error) throw error;
    return data;
  },

  async update(id: string, input: Partial<CreateApiKeyData>): Promise<ApiKey> {
    const { data, error } = await supabase
      .from('api_keys')
      .update({
        name: input.name,
        description: input.description,
        scopes: input.scopes,
        allowed_ips: input.allowed_ips,
        rate_limit_per_minute: input.rate_limit_per_minute,
        expires_at: input.expires_at,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as ApiKey;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('api_keys')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async getLogs(apiKeyId: string, limit = 50): Promise<ApiKeyLog[]> {
    const { data, error } = await supabase
      .from('api_key_logs')
      .select('*')
      .eq('api_key_id', apiKeyId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as ApiKeyLog[];
  },
};

// Available scopes for API keys
export const AVAILABLE_SCOPES = [
  { value: 'store:read', label: 'Leitura da loja', description: 'Ler produtos, categorias e configurações' },
  { value: 'store:write', label: 'Escrita da loja', description: 'Criar e atualizar pedidos' },
  { value: 'products:read', label: 'Ler produtos', description: 'Visualizar lista de produtos' },
  { value: 'orders:read', label: 'Ler pedidos', description: 'Visualizar pedidos' },
  { value: 'orders:write', label: 'Criar pedidos', description: 'Criar novos pedidos' },
  { value: 'variations:read', label: 'Ler variações', description: 'Visualizar variações de produtos (cor, tamanho, SKU)' },
  { value: 'stock:read', label: 'Ler estoque', description: 'Visualizar estoque por loja (físicas e online)' },
  { value: 'prices:read', label: 'Ler preços', description: 'Visualizar 4 tabelas de preço (varejo, atacado, exclusivo, promocional)' },
  { value: 'webhooks', label: 'Webhooks', description: 'Receber webhooks de pagamento' },
];
