import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Copy, Download, Database, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const TABLE_NAMES = [
  'profiles', 'user_roles', 'stores', 'user_menu_permissions',
  'products', 'product_variations', 'product_attributes', 'product_attribute_values',
  'product_variation_values', 'categories', 'measurement_tables',
  'customers', 'customer_addresses',
  'orders', 'pos_sales', 'pos_sessions', 'pos_transactions',
  'quotes', 'quote_history',
  'store_stock', 'stock_transfers',
  'coupons', 'coupon_usage',
  'product_combos', 'product_combo_items',
  'product_upsells', 'product_reviews',
  'banners', 'shipping_zones', 'store_config',
  'abandoned_carts', 'affiliates', 'affiliate_sales', 'affiliate_withdrawals',
  'audit_logs', 'api_keys', 'api_key_logs',
  'sales_goals', 'service_orders', 'service_order_comments',
  'fiscal_requests', 'import_history',
  'admin_announcements', 'announcement_dismissals',
  'site_analytics_events', 'user_favorites', 'newsletter_subscribers',
  'push_subscriptions', 'video_testimonials', 'customer_feedback_prints',
  'instagram_integrations', 'job_applications',
  'olist_integration', 'olist_product_mappings', 'olist_order_mappings', 'olist_sync_logs',
  'payment_webhooks', 'review_media', 'used_nonces',
] as const;

type TableName = typeof TABLE_NAMES[number];

interface TableData {
  name: string;
  rows: Record<string, unknown>[];
  count: number;
  error?: string;
}

const escapeSQL = (val: unknown): string => {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  return `'${String(val).replace(/'/g, "''")}'`;
};

const generateInsertSQL = (tableName: string, rows: Record<string, unknown>[]): string => {
  if (!rows.length) return `-- Tabela ${tableName}: sem dados\n`;
  const columns = Object.keys(rows[0]);
  const lines = rows.map(row => {
    const values = columns.map(col => escapeSQL(row[col]));
    return `INSERT INTO public.${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});`;
  });
  return `-- Tabela: ${tableName} (${rows.length} registros)\n${lines.join('\n')}\n`;
};

const DatabaseExport = () => {
  const [tables, setTables] = useState<TableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAllTables();
  }, []);

  const loadAllTables = async () => {
    setLoading(true);
    const results: TableData[] = [];

    for (const name of TABLE_NAMES) {
      try {
        const { data, error, count } = await (supabase
          .from(name) as any)
          .select('*', { count: 'exact' })
          .limit(10000);
        
        results.push({
          name,
          rows: data || [],
          count: count || (data?.length ?? 0),
          error: error?.message,
        });
      } catch (e: any) {
        results.push({ name, rows: [], count: 0, error: e.message });
      }
    }

    setTables(results);
    setLoading(false);
  };

  const toggleTable = (name: string) => {
    setExpandedTables(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const getFullSQL = () => {
    return tables
      .filter(t => !t.error && t.rows.length > 0)
      .map(t => generateInsertSQL(t.name, t.rows))
      .join('\n\n');
  };

  const copyAll = () => {
    navigator.clipboard.writeText(getFullSQL());
    toast({ title: 'SQL copiado!', description: 'Todo o SQL foi copiado para a área de transferência.' });
  };

  const downloadAll = () => {
    const blob = new Blob([getFullSQL()], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `database-export-${new Date().toISOString().slice(0, 10)}.sql`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Download iniciado!' });
  };

  const copyTable = (table: TableData) => {
    navigator.clipboard.writeText(generateInsertSQL(table.name, table.rows));
    toast({ title: `SQL de ${table.name} copiado!` });
  };

  const totalRows = tables.reduce((s, t) => s + t.count, 0);
  const tablesWithData = tables.filter(t => t.count > 0).length;

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando dados de todas as tabelas...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Database className="h-6 w-6 text-primary" />
              Export SQL do Banco de Dados
            </h1>
            <p className="text-muted-foreground mt-1">
              {tablesWithData} tabelas com dados • {totalRows.toLocaleString()} registros totais
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={copyAll}>
              <Copy className="h-4 w-4 mr-2" /> Copiar Tudo
            </Button>
            <Button onClick={downloadAll}>
              <Download className="h-4 w-4 mr-2" /> Baixar .sql
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {tables.map(table => {
            const isExpanded = expandedTables.has(table.name);
            const sql = isExpanded ? generateInsertSQL(table.name, table.rows) : '';

            return (
              <Card key={table.name} className="overflow-hidden">
                <button
                  onClick={() => toggleTable(table.name)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-mono font-medium text-sm">{table.name}</span>
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full",
                      table.error
                        ? "bg-destructive/10 text-destructive"
                        : table.count > 0
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                    )}>
                      {table.error ? 'erro' : `${table.count} registros`}
                    </span>
                  </div>
                  {!table.error && table.count > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); copyTable(table); }}
                    >
                      <Copy className="h-3 w-3 mr-1" /> Copiar
                    </Button>
                  )}
                </button>
                {isExpanded && (
                  <CardContent className="pt-0 px-4 pb-4">
                    {table.error ? (
                      <p className="text-sm text-destructive">{table.error}</p>
                    ) : table.count === 0 ? (
                      <p className="text-sm text-muted-foreground italic">Tabela vazia</p>
                    ) : (
                      <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs max-h-96 overflow-y-auto font-mono whitespace-pre-wrap break-all">
                        {sql}
                      </pre>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
};

export default DatabaseExport;
