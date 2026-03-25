import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Loader2,
  Plug,
  Package,
  ShoppingCart,
  FileText,
  Activity,
  Settings,
  Zap,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { olistService, OlistConfig, OlistSyncLog } from '@/services/olistService';

const OlistIntegration = () => {
  const [config, setConfig] = useState<OlistConfig | null>(null);
  const [logs, setLogs] = useState<OlistSyncLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [isPushingProducts, setIsPushingProducts] = useState(false);
  const [isSyncingProducts, setIsSyncingProducts] = useState(false);
  const [isSyncingOrders, setIsSyncingOrders] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [configData, logsData] = await Promise.all([
        olistService.getConfig().catch(() => null),
        olistService.getLogs().catch(() => []),
      ]);
      setConfig(configData);
      setLogs(logsData || []);
    } catch (error) {
      console.error('Error loading Olist data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const testConnection = async () => {
    setIsTesting(true);
    try {
      const result = await olistService.testConnection();
      if (result.connected) {
        setConnectionStatus('connected');
        toast.success('Conexão com Olist estabelecida com sucesso!');
      } else {
        setConnectionStatus('error');
        toast.error(`Falha na conexão: ${result.error}`);
      }
    } catch (error) {
      setConnectionStatus('error');
      toast.error('Erro ao testar conexão com Olist');
    } finally {
      setIsTesting(false);
    }
  };

  const pushProducts = async () => {
    setIsPushingProducts(true);
    try {
      const result = await olistService.pushProducts();
      toast.success(`Enviados para Olist: ${result.created} novos, ${result.updated} atualizados, ${result.failed} falhas`);
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar produtos para Olist');
    } finally {
      setIsPushingProducts(false);
    }
  };

  const syncProducts = async () => {
    setIsSyncingProducts(true);
    try {
      const result = await olistService.syncProducts();
      toast.success(`Produtos importados: ${result.processed} processados, ${result.failed} falhas`);
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao sincronizar produtos');
    } finally {
      setIsSyncingProducts(false);
    }
  };

  const syncOrders = async () => {
    setIsSyncingOrders(true);
    try {
      const result = await olistService.syncOrders();
      toast.success(`Pedidos sincronizados: ${result.processed} processados, ${result.failed} falhas`);
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao sincronizar pedidos');
    } finally {
      setIsSyncingOrders(false);
    }
  };

  const toggleActive = async (active: boolean) => {
    try {
      const updated = await olistService.saveConfig({ is_active: active });
      setConfig(updated);
      toast.success(active ? 'Integração ativada!' : 'Integração desativada');
    } catch (error) {
      toast.error('Erro ao atualizar configuração');
    }
  };

  const toggleSync = async (field: 'sync_products' | 'sync_orders' | 'sync_invoices', value: boolean) => {
    try {
      const updated = await olistService.saveConfig({ [field]: value });
      setConfig(updated);
      toast.success('Configuração salva');
    } catch (error) {
      toast.error('Erro ao salvar configuração');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-success/10 text-success hover:bg-success/20"><CheckCircle className="h-3 w-3 mr-1" />Sucesso</Badge>;
      case 'error':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Erro</Badge>;
      case 'running':
        return <Badge className="bg-primary/10 text-primary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Executando</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
    }
  };

  const webhookUrl = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/olist-webhooks`;

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Zap className="h-6 w-6 text-primary" />
              Integração Olist
            </h1>
            <p className="text-muted-foreground">Sincronize produtos, pedidos e notas fiscais com o Olist Marketplace</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="active-toggle">Ativa</Label>
              <Switch
                id="active-toggle"
                checked={config?.is_active ?? false}
                onCheckedChange={toggleActive}
              />
            </div>
            <Badge variant={connectionStatus === 'connected' ? 'default' : connectionStatus === 'error' ? 'destructive' : 'secondary'}>
              {connectionStatus === 'connected' ? <><CheckCircle className="h-3 w-3 mr-1" />Conectado</> :
               connectionStatus === 'error' ? <><XCircle className="h-3 w-3 mr-1" />Erro</> :
               <><Plug className="h-3 w-3 mr-1" />Não testado</>}
            </Badge>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center gap-3">
                <Plug className="h-8 w-8 text-primary" />
                <p className="font-medium">Testar Conexão</p>
                <Button onClick={testConnection} disabled={isTesting} className="w-full" variant="outline">
                  {isTesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Testar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center gap-3">
                <Package className="h-8 w-8 text-primary" />
                <p className="font-medium">Enviar para Olist</p>
                <Button onClick={pushProducts} disabled={isPushingProducts} className="w-full">
                  {isPushingProducts ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                  Enviar Produtos
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center gap-3">
                <Package className="h-8 w-8 text-muted-foreground" />
                <p className="font-medium">Importar do Olist</p>
                <Button onClick={syncProducts} disabled={isSyncingProducts} className="w-full" variant="outline">
                  {isSyncingProducts ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Importar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center gap-3">
                <ShoppingCart className="h-8 w-8 text-primary" />
                <p className="font-medium">Sincronizar Pedidos</p>
                <Button onClick={syncOrders} disabled={isSyncingOrders} className="w-full" variant="outline">
                  {isSyncingOrders ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Sincronizar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <p className="font-medium">Notas Fiscais</p>
                <p className="text-xs text-muted-foreground">Envio via detalhes do pedido</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="config" className="space-y-4">
          <TabsList>
            <TabsTrigger value="config"><Settings className="h-4 w-4 mr-1" />Configurações</TabsTrigger>
            <TabsTrigger value="logs"><Activity className="h-4 w-4 mr-1" />Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Módulos de Sincronização</CardTitle>
                <CardDescription>Escolha o que sincronizar com o Olist</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">Produtos e Estoque</Label>
                    <p className="text-sm text-muted-foreground">Sincronizar catálogo de produtos e níveis de estoque</p>
                  </div>
                  <Switch
                    checked={config?.sync_products ?? true}
                    onCheckedChange={(v) => toggleSync('sync_products', v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">Pedidos</Label>
                    <p className="text-sm text-muted-foreground">Importar pedidos do Olist automaticamente</p>
                  </div>
                  <Switch
                    checked={config?.sync_orders ?? true}
                    onCheckedChange={(v) => toggleSync('sync_orders', v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">Notas Fiscais</Label>
                    <p className="text-sm text-muted-foreground">Enviar dados de NF-e para o Olist</p>
                  </div>
                  <Switch
                    checked={config?.sync_invoices ?? true}
                    onCheckedChange={(v) => toggleSync('sync_invoices', v)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Webhook URL</CardTitle>
                <CardDescription>Configure esta URL no painel do Olist para receber atualizações em tempo real</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted px-3 py-2 rounded-lg text-sm font-mono break-all">
                    {webhookUrl}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(webhookUrl);
                      toast.success('URL copiada!');
                    }}
                  >
                    Copiar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Cole esta URL nas configurações de webhook do Olist para receber notificações de pedidos e estoque.
                </p>
              </CardContent>
            </Card>

            {config?.last_product_sync_at && (
              <Card>
                <CardHeader>
                  <CardTitle>Última Sincronização</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {config.last_product_sync_at && (
                    <p className="text-sm">
                      <span className="font-medium">Produtos:</span>{' '}
                      {format(new Date(config.last_product_sync_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  )}
                  {config.last_order_sync_at && (
                    <p className="text-sm">
                      <span className="font-medium">Pedidos:</span>{' '}
                      {format(new Date(config.last_order_sync_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  )}
                  {config.last_error && (
                    <div className="flex items-start gap-2 text-sm text-destructive">
                      <AlertTriangle className="h-4 w-4 mt-0.5" />
                      <span>{config.last_error}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Sincronização</CardTitle>
                <CardDescription>Últimas 50 operações de sincronização</CardDescription>
              </CardHeader>
              <CardContent>
                {logs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Nenhum log encontrado</p>
                    <p className="text-sm">Execute uma sincronização para ver os logs aqui</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data/Hora</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Direção</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Processados</TableHead>
                          <TableHead>Falhas</TableHead>
                          <TableHead>Erro</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-sm">
                              {format(new Date(log.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{log.sync_type}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {log.direction === 'pull' ? '⬇️ Pull' : '⬆️ Push'}
                            </TableCell>
                            <TableCell>{getStatusBadge(log.status)}</TableCell>
                            <TableCell className="text-sm">{log.records_processed}</TableCell>
                            <TableCell className="text-sm">{log.records_failed}</TableCell>
                            <TableCell className="text-sm text-destructive max-w-[200px] truncate">
                              {log.error_message || '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default OlistIntegration;
