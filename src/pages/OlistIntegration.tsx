import { useState, useEffect, useMemo } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
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
  Search,
  Send,
  Download,
} from 'lucide-react';
import { exportProductsToTinyCSV, downloadCSV } from '@/services/tinyExportService';
import { exportProductsToTikTokXLSX, readTikTokTemplateCategories } from '@/services/tiktokExportService';
import { olistService, OlistConfig, OlistSyncLog } from '@/services/olistService';

interface ProductItem {
  id: string;
  name: string;
  barcode: string | null;
  price: number;
  is_active: boolean;
  image_url: string | null;
}

const OlistIntegration = () => {
  const [config, setConfig] = useState<OlistConfig | null>(null);
  const [logs, setLogs] = useState<OlistSyncLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [isPushingProducts, setIsPushingProducts] = useState(false);
  const [isSyncingProducts, setIsSyncingProducts] = useState(false);
  const [isSyncingOrders, setIsSyncingOrders] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingTikTok, setIsExportingTikTok] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');

  // Product selection state
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [productSearch, setProductSearch] = useState('');
  const [selectAll, setSelectAll] = useState(false);

  // Export selection state (independent)
  const [exportSelectedIds, setExportSelectedIds] = useState<Set<string>>(new Set());
  const [exportSearch, setExportSearch] = useState('');
  const [exportSelectAll, setExportSelectAll] = useState(false);

  // TikTok export selection state
  const [tiktokSelectedIds, setTiktokSelectedIds] = useState<Set<string>>(new Set());
  const [tiktokSearch, setTiktokSearch] = useState('');
  const [tiktokSelectAll, setTiktokSelectAll] = useState(false);
  const [tiktokTemplateFile, setTiktokTemplateFile] = useState<File | null>(null);
  const [tiktokTemplateBuffer, setTiktokTemplateBuffer] = useState<ArrayBuffer | null>(null);
  const [tiktokCategories, setTiktokCategories] = useState<string[]>([]);
  const [tiktokSelectedCategory, setTiktokSelectedCategory] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [configData, logsData, productsData] = await Promise.all([
        olistService.getConfig().catch(() => null),
        olistService.getLogs().catch(() => []),
        supabase.from('products').select('id, name, barcode, price, is_active, image_url').eq('is_active', true).order('name'),
      ]);
      setConfig(configData);
      setLogs(logsData || []);
      setProducts((productsData.data || []) as ProductItem[]);
    } catch (error) {
      console.error('Error loading Olist data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const q = productSearch.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q))
    );
  }, [products, productSearch]);

  const exportFilteredProducts = useMemo(() => {
    if (!exportSearch.trim()) return products;
    const q = exportSearch.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q))
    );
  }, [products, exportSearch]);

  const tiktokFilteredProducts = useMemo(() => {
    if (!tiktokSearch.trim()) return products;
    const q = tiktokSearch.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q))
    );
  }, [products, tiktokSearch]);

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedProductIds(new Set(filteredProducts.map(p => p.id)));
    } else {
      setSelectedProductIds(new Set());
    }
  };

  const handleExportSelectAll = (checked: boolean) => {
    setExportSelectAll(checked);
    if (checked) {
      setExportSelectedIds(new Set(exportFilteredProducts.map(p => p.id)));
    } else {
      setExportSelectedIds(new Set());
    }
  };

  const toggleExportProduct = (id: string) => {
    setExportSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleTiktokSelectAll = (checked: boolean) => {
    setTiktokSelectAll(checked);
    if (checked) {
      setTiktokSelectedIds(new Set(tiktokFilteredProducts.map(p => p.id)));
    } else {
      setTiktokSelectedIds(new Set());
    }
  };

  const toggleTiktokProduct = (id: string) => {
    setTiktokSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleProduct = (id: string) => {
    setSelectedProductIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const testConnection = async () => {
    setIsTesting(true);
    try {
      const result = await olistService.testConnection();
      if (result.connected) {
        setConnectionStatus('connected');
        toast.success('Conexão com Tiny ERP estabelecida com sucesso!');
      } else {
        setConnectionStatus('error');
        toast.error(`Falha na conexão: ${result.error}`);
      }
    } catch (error) {
      setConnectionStatus('error');
      toast.error('Erro ao testar conexão');
    } finally {
      setIsTesting(false);
    }
  };

  const pushProducts = async () => {
    const ids = selectedProductIds.size > 0 ? Array.from(selectedProductIds) : undefined;
    setIsPushingProducts(true);
    try {
      const result = await olistService.pushProducts(ids);
      const parts = [];
      if (result.created > 0) parts.push(`${result.created} criados`);
      if (result.updated > 0) parts.push(`${result.updated} atualizados`);
      if (result.queued > 0) parts.push(`${result.queued} pendentes de confirmação no Tiny`);
      if (result.failed > 0) parts.push(`${result.failed} falhas`);

      if (result.queued > 0 && result.created === 0 && result.updated === 0) {
        toast.error(`O Tiny aceitou a requisição, mas não confirmou o cadastro: ${parts.join(', ')}`);
      } else if (result.failed > 0) {
        toast.error(`Envio parcial: ${parts.join(', ')}`);
      } else {
        toast.success(`Envio concluído: ${parts.join(', ') || 'Nenhum produto processado'}`);
      }

      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar produtos');
    } finally {
      setIsPushingProducts(false);
    }
  };

  const reconcileProducts = async () => {
    setIsReconciling(true);
    try {
      const result = await olistService.reconcileProducts();
      toast.success(`Reconciliação: ${result.resolved} resolvidos, ${result.pending} pendentes`);
      loadData();
    } catch (error) {
      toast.error('Erro ao reconciliar produtos');
    } finally {
      setIsReconciling(false);
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
      case 'partial_success':
        return <Badge className="bg-warning/10 text-warning"><AlertTriangle className="h-3 w-3 mr-1" />Parcial</Badge>;
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
              Integração Olist / Tiny ERP
            </h1>
            <p className="text-muted-foreground">Sincronize produtos, pedidos e notas fiscais com o Tiny ERP (Olist)</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="active-toggle">Ativa</Label>
              <Switch id="active-toggle" checked={config?.is_active ?? false} onCheckedChange={toggleActive} />
            </div>
            <Badge variant={connectionStatus === 'connected' ? 'default' : connectionStatus === 'error' ? 'destructive' : 'secondary'}>
              {connectionStatus === 'connected' ? <><CheckCircle className="h-3 w-3 mr-1" />Conectado</> :
               connectionStatus === 'error' ? <><XCircle className="h-3 w-3 mr-1" />Erro</> :
               <><Plug className="h-3 w-3 mr-1" />Não testado</>}
            </Badge>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center gap-3">
                <Plug className="h-8 w-8 text-primary" />
                <p className="font-medium text-sm">Testar Conexão</p>
                <Button onClick={testConnection} disabled={isTesting} className="w-full" variant="outline" size="sm">
                  {isTesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Testar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center gap-3">
                <Package className="h-8 w-8 text-muted-foreground" />
                <p className="font-medium text-sm">Importar do Olist</p>
                <Button onClick={syncProducts} disabled={isSyncingProducts} className="w-full" variant="outline" size="sm">
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
                <p className="font-medium text-sm">Sincronizar Pedidos</p>
                <Button onClick={syncOrders} disabled={isSyncingOrders} className="w-full" variant="outline" size="sm">
                  {isSyncingOrders ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Sincronizar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center gap-3">
                <RefreshCw className="h-8 w-8 text-muted-foreground" />
                <p className="font-medium text-sm">Reconciliar Fila</p>
                <Button onClick={reconcileProducts} disabled={isReconciling} className="w-full" variant="outline" size="sm">
                  {isReconciling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Reconciliar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="products" className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="products"><Package className="h-4 w-4 mr-1" />Enviar Produtos</TabsTrigger>
            <TabsTrigger value="export"><Download className="h-4 w-4 mr-1" />Exportar CSV</TabsTrigger>
            <TabsTrigger value="tiktok"><Download className="h-4 w-4 mr-1" />TikTok Shop</TabsTrigger>
            <TabsTrigger value="config"><Settings className="h-4 w-4 mr-1" />Configurações</TabsTrigger>
            <TabsTrigger value="logs"><Activity className="h-4 w-4 mr-1" />Logs</TabsTrigger>
          </TabsList>

          {/* Products Tab - Selection and Push */}
          <TabsContent value="products" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Selecionar Produtos para Enviar</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{selectedProductIds.size} selecionados</Badge>
                    <Button
                      onClick={pushProducts}
                      disabled={isPushingProducts}
                      size="sm"
                    >
                      {isPushingProducts ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                      {selectedProductIds.size > 0 ? `Enviar ${selectedProductIds.size} Selecionados` : 'Enviar Todos'}
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>
                  Selecione os produtos que deseja enviar para o Tiny ERP. Se nenhum for selecionado, todos os produtos ativos serão enviados.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por nome ou código..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selectAll}
                        onCheckedChange={(checked) => handleSelectAll(!!checked)}
                      />
                      <Label className="text-sm cursor-pointer" onClick={() => handleSelectAll(!selectAll)}>
                        Selecionar todos
                      </Label>
                    </div>
                  </div>

                  <div className="border rounded-lg max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead>Código</TableHead>
                          <TableHead className="text-right">Preço</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProducts.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                              Nenhum produto encontrado
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredProducts.map((product) => (
                            <TableRow
                              key={product.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => toggleProduct(product.id)}
                            >
                              <TableCell>
                                <Checkbox
                                  checked={selectedProductIds.has(product.id)}
                                  onCheckedChange={() => toggleProduct(product.id)}
                                />
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  {product.image_url ? (
                                    <img src={product.image_url} alt="" className="h-8 w-8 rounded object-cover" />
                                  ) : (
                                    <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                                      <Package className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                  )}
                                  <span className="font-medium text-sm">{product.name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {product.barcode || '-'}
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                R$ {product.price?.toFixed(2) || '0,00'}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    💡 O Tiny ERP processa produtos em fila. Após o envio, use o botão "Reconciliar Fila" para verificar os IDs dos produtos processados.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Export CSV Tab */}
          <TabsContent value="export" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Exportar Produtos para CSV (Formato Tiny ERP)</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{exportSelectedIds.size} selecionados</Badge>
                    <Button
                      onClick={async () => {
                        setIsExporting(true);
                        try {
                          const ids = exportSelectedIds.size > 0 ? Array.from(exportSelectedIds) : undefined;
                          const csv = await exportProductsToTinyCSV(ids);
                          const date = new Date().toISOString().slice(0, 10);
                          downloadCSV(csv, `produtos-tiny-${date}.csv`);
                          toast.success(`CSV exportado com sucesso!`);
                        } catch (err: unknown) {
                          toast.error((err as Error).message || 'Erro ao exportar');
                        } finally {
                          setIsExporting(false);
                        }
                      }}
                      disabled={isExporting}
                      size="sm"
                    >
                      {isExporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                      {exportSelectedIds.size > 0 ? `Exportar ${exportSelectedIds.size} Selecionados` : 'Exportar Todos'}
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>
                  Selecione os produtos e gere um CSV no formato aceito pelo Tiny ERP para importação manual.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por nome ou código..."
                        value={exportSearch}
                        onChange={(e) => setExportSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={exportSelectAll}
                        onCheckedChange={(checked) => handleExportSelectAll(!!checked)}
                      />
                      <Label className="text-sm cursor-pointer" onClick={() => handleExportSelectAll(!exportSelectAll)}>
                        Selecionar todos
                      </Label>
                    </div>
                  </div>

                  <div className="border rounded-lg max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead>Código</TableHead>
                          <TableHead className="text-right">Preço</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {exportFilteredProducts.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                              Nenhum produto encontrado
                            </TableCell>
                          </TableRow>
                        ) : (
                          exportFilteredProducts.map((product) => (
                            <TableRow
                              key={product.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => toggleExportProduct(product.id)}
                            >
                              <TableCell>
                                <Checkbox
                                  checked={exportSelectedIds.has(product.id)}
                                  onCheckedChange={() => toggleExportProduct(product.id)}
                                />
                              </TableCell>
                              <TableCell className="font-medium">{product.name}</TableCell>
                              <TableCell className="text-muted-foreground">{product.barcode || '-'}</TableCell>
                              <TableCell className="text-right">
                                R$ {product.price?.toFixed(2) || '0,00'}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
                    <p className="font-medium">📋 Estrutura do CSV exportado:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li><strong>Produtos simples</strong>: exportados como tipo "S"</li>
                      <li><strong>Produtos com variações</strong>: linha pai "V" + filhas "S" com Código do pai e Variações (ex: Cor:Branca||Tamanho:M)</li>
                      <li>Inclui: SKU, preço, estoque, descrição, peso, dimensões, imagens, código de barras</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TikTok Shop Export Tab */}
          <TabsContent value="tiktok" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Exportar Produtos para TikTok Shop (XLSX)</CardTitle>
                <CardDescription>
                  Faça upload do template baixado do TikTok Seller Center (para a categoria desejada), selecione os produtos e gere o XLSX preenchido.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Step 1: Upload template */}
                  <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                    <p className="font-medium text-sm">📥 Passo 1: Faça upload do template do TikTok</p>
                    <p className="text-xs text-muted-foreground">
                      No TikTok Seller Center, vá em Produtos → Upload em lote → Baixar modelo (para a categoria desejada). Depois faça upload aqui.
                    </p>
                    <Input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setTiktokTemplateFile(file);
                        }
                      }}
                    />
                    {tiktokTemplateFile && (
                      <Badge variant="outline" className="text-xs">
                        ✅ Template carregado: {tiktokTemplateFile.name}
                      </Badge>
                    )}
                  </div>

                  {/* Step 2: Select products */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">📦 Passo 2: Selecione os produtos</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{tiktokSelectedIds.size} selecionados</Badge>
                        <Button
                          onClick={async () => {
                            if (!tiktokTemplateFile) {
                              toast.error('Faça upload do template do TikTok primeiro!');
                              return;
                            }
                            setIsExportingTikTok(true);
                            try {
                              const buffer = await tiktokTemplateFile.arrayBuffer();
                              const ids = tiktokSelectedIds.size > 0 ? Array.from(tiktokSelectedIds) : undefined;
                              await exportProductsToTikTokXLSX(buffer, ids);
                              toast.success('XLSX para TikTok Shop exportado com sucesso!');
                            } catch (err: unknown) {
                              toast.error((err as Error).message || 'Erro ao exportar');
                            } finally {
                              setIsExportingTikTok(false);
                            }
                          }}
                          disabled={isExportingTikTok || !tiktokTemplateFile}
                          size="sm"
                        >
                          {isExportingTikTok ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                          {tiktokSelectedIds.size > 0 ? `Exportar ${tiktokSelectedIds.size}` : 'Exportar Todos'}
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar por nome ou código..."
                          value={tiktokSearch}
                          onChange={(e) => setTiktokSearch(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={tiktokSelectAll}
                          onCheckedChange={(checked) => handleTiktokSelectAll(!!checked)}
                        />
                        <Label className="text-sm cursor-pointer" onClick={() => handleTiktokSelectAll(!tiktokSelectAll)}>
                          Todos
                        </Label>
                      </div>
                    </div>

                    <div className="border rounded-lg max-h-[400px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12"></TableHead>
                            <TableHead>Produto</TableHead>
                            <TableHead>Código</TableHead>
                            <TableHead className="text-right">Preço</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tiktokFilteredProducts.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                Nenhum produto encontrado
                              </TableCell>
                            </TableRow>
                          ) : (
                            tiktokFilteredProducts.map((product) => (
                              <TableRow
                                key={product.id}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => toggleTiktokProduct(product.id)}
                              >
                                <TableCell>
                                  <Checkbox
                                    checked={tiktokSelectedIds.has(product.id)}
                                    onCheckedChange={() => toggleTiktokProduct(product.id)}
                                  />
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    {product.image_url ? (
                                      <img src={product.image_url} alt="" className="h-8 w-8 rounded object-cover" />
                                    ) : (
                                      <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                                        <Package className="h-4 w-4 text-muted-foreground" />
                                      </div>
                                    )}
                                    <span className="font-medium text-sm">{product.name}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">{product.barcode || '-'}</TableCell>
                                <TableCell className="text-right text-sm">R$ {product.price?.toFixed(2) || '0,00'}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
                    <p className="font-medium">💡 Como funciona:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>Baixe o template no TikTok Seller Center para a <strong>categoria correta</strong> dos seus produtos</li>
                      <li>Faça upload do template aqui e selecione os produtos</li>
                      <li>O sistema preenche o template com os dados e gera o XLSX para upload no TikTok</li>
                      <li>Variações são exportadas como linhas separadas com cor/tamanho</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="config" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Módulos de Sincronização</CardTitle>
                <CardDescription>Escolha o que sincronizar com o Tiny ERP</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">Produtos e Estoque</Label>
                    <p className="text-sm text-muted-foreground">Sincronizar catálogo de produtos e níveis de estoque</p>
                  </div>
                  <Switch checked={config?.sync_products ?? true} onCheckedChange={(v) => toggleSync('sync_products', v)} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">Pedidos</Label>
                    <p className="text-sm text-muted-foreground">Importar pedidos do Olist automaticamente</p>
                  </div>
                  <Switch checked={config?.sync_orders ?? true} onCheckedChange={(v) => toggleSync('sync_orders', v)} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-medium">Notas Fiscais</Label>
                    <p className="text-sm text-muted-foreground">Enviar dados de NF-e para o Olist</p>
                  </div>
                  <Switch checked={config?.sync_invoices ?? true} onCheckedChange={(v) => toggleSync('sync_invoices', v)} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Webhook URL</CardTitle>
                <CardDescription>Configure esta URL no painel do Tiny ERP para receber atualizações</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted px-3 py-2 rounded-lg text-sm font-mono break-all">{webhookUrl}</code>
                  <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success('URL copiada!'); }}>
                    Copiar
                  </Button>
                </div>
              </CardContent>
            </Card>

            {config?.last_product_sync_at && (
              <Card>
                <CardHeader><CardTitle>Última Sincronização</CardTitle></CardHeader>
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
                <CardDescription>Últimas 50 operações</CardDescription>
              </CardHeader>
              <CardContent>
                {logs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Nenhum log encontrado</p>
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
                            <TableCell><Badge variant="outline">{log.sync_type}</Badge></TableCell>
                            <TableCell className="text-sm">{log.direction === 'pull' ? '⬇️ Pull' : '⬆️ Push'}</TableCell>
                            <TableCell>{getStatusBadge(log.status)}</TableCell>
                            <TableCell className="text-sm">{log.records_processed}</TableCell>
                            <TableCell className="text-sm">{log.records_failed}</TableCell>
                            <TableCell className="text-sm text-destructive max-w-[200px] truncate">{log.error_message || '-'}</TableCell>
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
