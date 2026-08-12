import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  tiktokService,
  type TikTokConfig,
  type TikTokSyncLog,
  type TikTokProductMapping,
  type TikTokOrderMapping,
  type TikTokAuthStatus,
} from '@/services/tiktokService';
import { Loader2, RefreshCw, Download, Upload, PlugZap, ShoppingBag, KeyRound } from 'lucide-react';

const statusVariant = (status: string) => {
  if (status === 'success' || status === 'linked' || status === 'synced') return 'default';
  if (status === 'partial' || status === 'pending' || status === 'unmatched') return 'secondary';
  return 'destructive';
};

export default function TikTokIntegration() {
  const { toast } = useToast();
  const [config, setConfig] = useState<TikTokConfig | null>(null);
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [logs, setLogs] = useState<TikTokSyncLog[]>([]);
  const [productMappings, setProductMappings] = useState<TikTokProductMapping[]>([]);
  const [orderMappings, setOrderMappings] = useState<TikTokOrderMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState('');
  const [authStatus, setAuthStatus] = useState<TikTokAuthStatus | null>(null);

  const loadAll = async () => {
    try {
      const [cfg, status, logsData, prodMaps, orderMaps] = await Promise.all([
        tiktokService.getConfig(),
        tiktokService.authStatus().catch(() => null),
        tiktokService.getLogs(),
        tiktokService.getProductMappings(),
        tiktokService.getOrderMappings(),
      ]);
      setConfig(cfg);
      setAuthStatus(status);
      setLogs(logsData);
      setProductMappings(prodMaps);
      setOrderMappings(orderMaps);
    } catch (err) {
      toast({ title: 'Erro ao carregar', description: String((err as Error).message), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.from('stores').select('id, name').order('name').then(({ data }) => setStores(data || []));
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (key: string, fn: () => Promise<unknown>, successMsg: (r: never) => string) => {
    setBusy(key);
    try {
      const result = await fn();
      toast({ title: 'Concluído', description: successMsg(result as never) });
      await loadAll();
    } catch (err) {
      toast({ title: 'Falha na operação', description: String((err as Error).message), variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const updateConfig = async (patch: Partial<TikTokConfig>) => {
    try {
      const updated = await tiktokService.saveConfig(patch);
      setConfig(updated);
      toast({ title: 'Configuração salva' });
    } catch (err) {
      toast({ title: 'Erro ao salvar', description: String((err as Error).message), variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShoppingBag className="h-6 w-6" /> TikTok Shop
            </h1>
            <p className="text-muted-foreground text-sm">
              Importe produtos e pedidos do TikTok Shop e envie o estoque automaticamente.
            </p>
          </div>
          <Button
            variant="outline"
            disabled={busy !== null}
            onClick={() =>
              run('test', () => tiktokService.testConnection(), (r: { shops: { name: string }[] }) =>
                `Conectado a: ${r.shops?.map((s) => s.name).join(', ') || 'loja TikTok'}`,
              )
            }
          >
            {busy === 'test' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlugZap className="h-4 w-4 mr-2" />}
            Testar conexão
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Autorização do vendedor</CardTitle>
            <CardDescription>
              No Partner Center do TikTok o vendedor recebe apenas um <strong>código/ID de autorização</strong>. Cole esse código
              abaixo — o sistema troca por token de acesso e descobre automaticamente o shop cipher da loja.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-2 flex-1 min-w-[260px]">
                <Label>Código de autorização (auth code)</Label>
                <Input
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value)}
                  placeholder="Ex.: ROW_xxxxxxxxxxxxxxxx"
                />
              </div>
              <Button
                disabled={busy !== null || !authCode.trim()}
                onClick={() =>
                  run('authorize', async () => {
                    const r = await tiktokService.authorize(authCode.trim());
                    setAuthCode('');
                    const st = await tiktokService.authStatus();
                    setAuthStatus(st);
                    return r;
                  }, (r: { seller_name: string | null; shops: { name: string }[] }) =>
                    `Autorizado${r.seller_name ? `: ${r.seller_name}` : ''}${r.shops?.length ? ` — loja ${r.shops.map((s) => s.name).join(', ')}` : ''}`,
                  )
                }
              >
                {busy === 'authorize' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
                Autorizar
              </Button>
              <Button
                variant="outline"
                disabled={busy !== null}
                onClick={() =>
                  run('refresh-token', async () => {
                    const r = await tiktokService.refreshToken();
                    setAuthStatus(await tiktokService.authStatus());
                    return r;
                  }, () => 'Token renovado')
                }
              >
                {busy === 'refresh-token' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Renovar token
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant={authStatus?.has_token ? 'default' : 'destructive'}>
                {authStatus?.has_token ? 'Token ativo' : 'Sem token'}
              </Badge>
              <Badge variant={authStatus?.shop_cipher_configured ? 'default' : 'secondary'}>
                {authStatus?.shop_cipher_configured ? 'Shop cipher OK' : 'Shop cipher pendente'}
              </Badge>
              {authStatus?.seller_name && <Badge variant="secondary">Vendedor: {authStatus.seller_name}</Badge>}
              {authStatus?.shop_name && <Badge variant="secondary">Loja: {authStatus.shop_name}</Badge>}
              {authStatus?.access_token_expires_at && (
                <Badge variant="secondary">
                  Expira em {new Date(authStatus.access_token_expires_at).toLocaleString('pt-BR')}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>

          <CardHeader>
            <CardTitle>Configuração</CardTitle>
            <CardDescription>Defina de qual loja o estoque será enviado e o comportamento da sincronização.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Loja vinculada aos pedidos</Label>
                <Select
                  value={config?.store_id || ''}
                  onValueChange={(value) => updateConfig({ store_id: value })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione a loja" /></SelectTrigger>
                  <SelectContent>
                    {stores.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-md border p-3">
                  <Label htmlFor="active" className="cursor-pointer">Integração ativa</Label>
                  <Switch id="active" checked={!!config?.is_active} onCheckedChange={(v) => updateConfig({ is_active: v })} />
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <Label htmlFor="stock" className="cursor-pointer">Enviar estoque ao TikTok</Label>
                  <Switch id="stock" checked={!!config?.auto_sync_stock} onCheckedChange={(v) => updateConfig({ auto_sync_stock: v })} />
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <Label htmlFor="orders" className="cursor-pointer">Importar pedidos do TikTok</Label>
                  <Switch id="orders" checked={!!config?.auto_import_orders} onCheckedChange={(v) => updateConfig({ auto_import_orders: v })} />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                disabled={busy !== null}
                onClick={() =>
                  run('pull-products', () => tiktokService.pullProducts(), (r: { processed: number; matched: number; unmatched: number }) =>
                    `${r.processed} SKUs lidos · ${r.matched} vinculados · ${r.unmatched} sem correspondência`,
                  )
                }
              >
                {busy === 'pull-products' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                Importar produtos
              </Button>
              <Button
                variant="secondary"
                disabled={busy !== null}
                onClick={() =>
                  run('push-stock', () => tiktokService.pushStock(), (r: { processed: number; failed: number; message?: string }) =>
                    r.message || `${r.processed} SKUs atualizados · ${r.failed} falhas`,
                  )
                }
              >
                {busy === 'push-stock' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                Enviar estoque
              </Button>
              <Button
                variant="secondary"
                disabled={busy !== null}
                onClick={() =>
                  run('pull-orders', () => tiktokService.pullOrders(72), (r: { created: number; updated: number; failed: number }) =>
                    `${r.created} pedidos novos · ${r.updated} atualizados · ${r.failed} falhas`,
                  )
                }
              >
                {busy === 'pull-orders' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Importar pedidos (72h)
              </Button>
            </div>

            <div className="text-xs text-muted-foreground">
              Última sincronização de produtos: {config?.last_sync_at ? new Date(config.last_sync_at).toLocaleString('pt-BR') : '—'} ·
              {' '}Última de pedidos: {config?.last_order_sync_at ? new Date(config.last_order_sync_at).toLocaleString('pt-BR') : '—'}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="products">
          <TabsList>
            <TabsTrigger value="products">Produtos ({productMappings.length})</TabsTrigger>
            <TabsTrigger value="orders">Pedidos ({orderMappings.length})</TabsTrigger>
            <TabsTrigger value="logs">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU TikTok</TableHead>
                      <TableHead>Produto no sistema</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Atualizado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productMappings.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum produto importado ainda.</TableCell></TableRow>
                    )}
                    {productMappings.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-mono text-xs">{m.seller_sku || m.tiktok_sku_id || m.tiktok_product_id}</TableCell>
                        <TableCell>{m.products?.name || <span className="text-muted-foreground">Sem correspondência</span>}</TableCell>
                        <TableCell><Badge variant={statusVariant(m.sync_status)}>{m.sync_status}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {m.last_synced_at ? new Date(m.last_synced_at).toLocaleString('pt-BR') : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders">
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pedido TikTok</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Estoque baixado</TableHead>
                      <TableHead>Importado em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderMappings.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum pedido importado ainda.</TableCell></TableRow>
                    )}
                    {orderMappings.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-xs">{o.tiktok_order_id}</TableCell>
                        <TableCell><Badge variant="secondary">{o.local_status || o.tiktok_status}</Badge></TableCell>
                        <TableCell>{o.total != null ? o.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}</TableCell>
                        <TableCell>{o.stock_deducted ? 'Sim' : 'Não'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString('pt-BR')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Direção</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Processados</TableHead>
                      <TableHead>Mensagem</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem registros.</TableCell></TableRow>
                    )}
                    {logs.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>{l.sync_type}</TableCell>
                        <TableCell>{l.direction === 'inbound' ? 'TikTok → Sistema' : 'Sistema → TikTok'}</TableCell>
                        <TableCell><Badge variant={statusVariant(l.status)}>{l.status}</Badge></TableCell>
                        <TableCell>{l.items_processed} / {l.items_failed} falhas</TableCell>
                        <TableCell className="max-w-md truncate text-xs">{l.message || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString('pt-BR')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
