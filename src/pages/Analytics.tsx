import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2, Brain, Clock, MousePointerClick, ShoppingCart, Eye, TrendingUp,
  AlertTriangle, Lightbulb, ArrowRight, RefreshCw, Search, Heart, Smartphone,
  Monitor, Globe, Users, BarChart3, Target
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AnalyticsData {
  period: string;
  totalSessions: number;
  avgTimeByPage: { page: string; avg_seconds: number; views: number }[];
  clickMap: { area: string; count: number }[];
  heatmapPages: { page: string; zones: { x: number; y: number; count: number }[] }[];
  topProducts: { id: string; name: string; views: number }[];
  funnel: Record<string, number>;
  bounceRate: number;
  totalBounces: number;
  devices: { name: string; count: number }[];
  browsers: { name: string; count: number }[];
  operatingSystems: { name: string; count: number }[];
  trafficSources: { name: string; count: number }[];
  trafficMediums: { name: string; count: number }[];
  newVisitors: number;
  returningVisitors: number;
  topSearches: { query: string; count: number; avg_results: number }[];
  totalSearches: number;
  searchesWithNoResults: number;
  topFavorites: { id: string; name: string; count: number }[];
  totalFavoriteAdds: number;
  totalFavoriteRemoves: number;
  topCartRemoves: { id: string; name: string; removes: number }[];
  totalCartRemoves: number;
  aiRecommendations: {
    insights: {
      category: string;
      title: string;
      description: string;
      priority: string;
      impact: string;
    }[];
  } | null;
}

const AREA_LABELS: Record<string, string> = {
  header: 'Cabeçalho / Menu',
  hero: 'Banner Principal',
  products: 'Seção Produtos',
  footer: 'Rodapé',
  cta: 'Botões de Ação',
  cart: 'Carrinho',
  checkout: 'Checkout',
  content: 'Conteúdo Geral',
  unknown: 'Outros',
};

const FUNNEL_LABELS: Record<string, string> = {
  page_view: 'Visitou o Site',
  product_view: 'Viu um Produto',
  add_to_cart: 'Adicionou ao Carrinho',
  checkout_start: 'Iniciou Checkout',
  checkout_complete: 'Comprou',
};

const DEVICE_LABELS: Record<string, string> = {
  desktop: 'Desktop', mobile: 'Mobile', tablet: 'Tablet',
};

const BROWSER_LABELS: Record<string, string> = {
  chrome: 'Chrome', safari: 'Safari', firefox: 'Firefox', edge: 'Edge', opera: 'Opera', other: 'Outros',
};

const OS_LABELS: Record<string, string> = {
  windows: 'Windows', macos: 'macOS', linux: 'Linux', android: 'Android', ios: 'iOS', other: 'Outros',
};

const SOURCE_LABELS: Record<string, string> = {
  direct: 'Direto', google: 'Google', instagram: 'Instagram', facebook: 'Facebook',
  whatsapp: 'WhatsApp', tiktok: 'TikTok', youtube: 'YouTube', twitter: 'Twitter/X',
  pinterest: 'Pinterest', internal: 'Interno', unknown: 'Desconhecido',
};

const COLORS = [
  'hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))',
  'hsl(var(--chart-4))', 'hsl(var(--chart-5))', '#8b5cf6', '#ec4899', '#f97316',
  '#06b6d4', '#84cc16',
];

const priorityColor = (p: string) => {
  if (p === 'alta') return 'destructive';
  if (p === 'media') return 'default';
  return 'secondary';
};

const categoryIcon = (c: string) => {
  switch (c) {
    case 'tempo': return <Clock className="h-4 w-4" />;
    case 'produtos': return <Eye className="h-4 w-4" />;
    case 'funil': return <ShoppingCart className="h-4 w-4" />;
    case 'cliques': return <MousePointerClick className="h-4 w-4" />;
    case 'bounce': return <Target className="h-4 w-4" />;
    case 'dispositivos': return <Smartphone className="h-4 w-4" />;
    case 'trafego': return <Globe className="h-4 w-4" />;
    case 'busca': return <Search className="h-4 w-4" />;
    case 'favoritos': return <Heart className="h-4 w-4" />;
    default: return <TrendingUp className="h-4 w-4" />;
  }
};

const HeatmapGrid = ({ zones }: { zones: { x: number; y: number; count: number }[] }) => {
  const maxCount = Math.max(...zones.map(z => z.count), 1);
  return (
    <div className="relative w-full aspect-video bg-muted/30 rounded-lg border overflow-hidden">
      {zones.map((zone, i) => {
        const intensity = zone.count / maxCount;
        return (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${zone.x}%`,
              top: `${zone.y}%`,
              width: `${Math.max(12, intensity * 40)}px`,
              height: `${Math.max(12, intensity * 40)}px`,
              background: `radial-gradient(circle, hsla(0, 90%, 55%, ${0.2 + intensity * 0.6}) 0%, transparent 70%)`,
              transform: 'translate(-50%, -50%)',
            }}
            title={`${zone.count} cliques`}
          />
        );
      })}
      <div className="absolute bottom-2 right-2 text-[10px] text-muted-foreground bg-background/80 px-2 py-1 rounded">
        Mapa de calor dos cliques
      </div>
    </div>
  );
};

const Analytics = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState('30d');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('analyze-behavior', {
        body: { period },
      });
      if (error) throw error;
      setData(result);
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast.error('Erro ao carregar analytics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [period]);

  const funnelData = data?.funnel
    ? Object.entries(FUNNEL_LABELS).map(([key, label]) => ({
        name: label,
        value: data.funnel[key] || 0,
      }))
    : [];

  const conversionRate = data?.funnel
    ? data.funnel.page_view > 0
      ? ((data.funnel.checkout_complete / data.funnel.page_view) * 100).toFixed(1)
      : '0'
    : '0';

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="h-6 w-6 text-primary" />
              Analytics Comportamental com IA
            </h1>
            <p className="text-muted-foreground">Análise completa do comportamento dos visitantes</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="14d">Últimos 14 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={loadData} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="text-muted-foreground">Analisando dados e gerando recomendações com IA...</p>
            </div>
          </div>
        ) : data ? (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Sessões</span>
                  </div>
                  <div className="text-2xl font-bold">{data.totalSessions}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Taxa Rejeição</span>
                  </div>
                  <div className="text-2xl font-bold">{data.bounceRate}%</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Conversão</span>
                  </div>
                  <div className="text-2xl font-bold">{conversionRate}%</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Tempo Médio</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {data.avgTimeByPage.length > 0
                      ? `${Math.round(data.avgTimeByPage.reduce((s, p) => s + p.avg_seconds, 0) / data.avgTimeByPage.length)}s`
                      : '—'}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Buscas</span>
                  </div>
                  <div className="text-2xl font-bold">{data.totalSearches}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Heart className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Favoritos</span>
                  </div>
                  <div className="text-2xl font-bold">{data.totalFavoriteAdds}</div>
                </CardContent>
              </Card>
            </div>

            {/* Visitors: New vs Returning */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-4 pb-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Visitantes Novos</p>
                    <div className="text-xl font-bold">{data.newVisitors}</div>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Visitantes Recorrentes</p>
                    <div className="text-xl font-bold">{data.returningVisitors}</div>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-chart-2/10 flex items-center justify-center">
                    <RefreshCw className="h-5 w-5 text-[hsl(var(--chart-2))]" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Produtos Removidos do Carrinho</p>
                    <div className="text-xl font-bold">{data.totalCartRemoves}</div>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                    <ShoppingCart className="h-5 w-5 text-destructive" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="comportamento" className="space-y-4">
              <TabsList className="flex flex-wrap h-auto gap-1">
                <TabsTrigger value="comportamento">Comportamento</TabsTrigger>
                <TabsTrigger value="trafego">Tráfego & Dispositivos</TabsTrigger>
                <TabsTrigger value="busca">Busca & Favoritos</TabsTrigger>
                <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
                <TabsTrigger value="ia">IA Insights</TabsTrigger>
              </TabsList>

              {/* ===== TAB: COMPORTAMENTO ===== */}
              <TabsContent value="comportamento" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Time on Page */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Clock className="h-5 w-5 text-primary" />
                        Tempo Médio por Página
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {data.avgTimeByPage.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={data.avgTimeByPage.slice(0, 10)} layout="vertical" margin={{ left: 80 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis dataKey="page" type="category" width={80} tick={{ fontSize: 11 }}
                              tickFormatter={(v) => v.length > 15 ? v.slice(0, 15) + '…' : v} />
                            <Tooltip formatter={(v: number) => [`${v}s`, 'Tempo médio']} />
                            <Bar dataKey="avg_seconds" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-center text-muted-foreground py-12">Nenhum dado disponível</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Top Products */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Eye className="h-5 w-5 text-primary" />
                        Produtos Mais Acessados
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {data.topProducts.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={data.topProducts} layout="vertical" margin={{ left: 100 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }}
                              tickFormatter={(v) => v.length > 18 ? v.slice(0, 18) + '…' : v} />
                            <Tooltip formatter={(v: number) => [`${v}`, 'Visualizações']} />
                            <Bar dataKey="views" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-center text-muted-foreground py-12">Nenhum produto visualizado</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Funnel */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <ShoppingCart className="h-5 w-5 text-primary" />
                        Funil de Conversão
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {data.totalSessions > 0 ? (
                        <div className="space-y-3">
                          {funnelData.map((step, i) => {
                            const pct = funnelData[0].value > 0
                              ? Math.round((step.value / funnelData[0].value) * 100) : 0;
                            return (
                              <div key={step.name} className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                  <span>{step.name}</span>
                                  <span className="font-medium">{step.value} ({pct}%)</span>
                                </div>
                                <div className="h-8 bg-muted rounded-md overflow-hidden">
                                  <div className="h-full rounded-md transition-all"
                                    style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                                </div>
                                {i < funnelData.length - 1 && funnelData[i].value > 0 && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground pl-2">
                                    <ArrowRight className="h-3 w-3" />
                                    {funnelData[i + 1].value > 0
                                      ? `${Math.round((funnelData[i + 1].value / funnelData[i].value) * 100)}% avançaram`
                                      : 'Ninguém avançou'}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-center text-muted-foreground py-12">Sem dados de funil</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Click Map */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <MousePointerClick className="h-5 w-5 text-primary" />
                        Cliques por Área
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {data.clickMap.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={data.clickMap.map((c) => ({
                                name: AREA_LABELS[c.area] || c.area,
                                value: c.count,
                              }))}
                              cx="50%" cy="50%" labelLine={false} outerRadius={100}
                              fill="hsl(var(--primary))" dataKey="value"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            >
                              {data.clickMap.map((_, i) => (
                                <Cell key={i} fill={COLORS[i % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-center text-muted-foreground py-12">Nenhum clique registrado</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Cart Removes */}
                  {data.topCartRemoves.length > 0 && (
                    <Card className="lg:col-span-2">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <ShoppingCart className="h-5 w-5 text-destructive" />
                          Produtos Mais Removidos do Carrinho
                        </CardTitle>
                        <CardDescription>Produtos que os clientes adicionaram mas desistiram</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={data.topCartRemoves} layout="vertical" margin={{ left: 100 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }}
                              tickFormatter={(v) => v.length > 18 ? v.slice(0, 18) + '…' : v} />
                            <Tooltip formatter={(v: number) => [`${v}`, 'Remoções']} />
                            <Bar dataKey="removes" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>

              {/* ===== TAB: TRÁFEGO & DISPOSITIVOS ===== */}
              <TabsContent value="trafego" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Traffic Sources */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Globe className="h-5 w-5 text-primary" />
                        Origem do Tráfego
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {data.trafficSources.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={data.trafficSources.map(s => ({
                                name: SOURCE_LABELS[s.name] || s.name,
                                value: s.count,
                              }))}
                              cx="50%" cy="50%" outerRadius={100} dataKey="value"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            >
                              {data.trafficSources.map((_, i) => (
                                <Cell key={i} fill={COLORS[i % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-center text-muted-foreground py-12">Sem dados de tráfego</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Traffic Medium */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        Meio de Aquisição
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {data.trafficMediums.length > 0 ? (
                        <div className="space-y-3">
                          {data.trafficMediums.map((m, i) => {
                            const total = data.trafficMediums.reduce((s, t) => s + t.count, 0);
                            const pct = total > 0 ? Math.round((m.count / total) * 100) : 0;
                            return (
                              <div key={m.name} className="space-y-1">
                                <div className="flex justify-between text-sm">
                                  <span className="capitalize">{m.name === 'none' ? 'Direto' : m.name}</span>
                                  <span className="font-medium">{m.count} ({pct}%)</span>
                                </div>
                                <div className="h-3 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-center text-muted-foreground py-12">Sem dados</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Devices */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Smartphone className="h-5 w-5 text-primary" />
                        Dispositivos
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {data.devices.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <PieChart>
                            <Pie
                              data={data.devices.map(d => ({ name: DEVICE_LABELS[d.name] || d.name, value: d.count }))}
                              cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            >
                              {data.devices.map((_, i) => (
                                <Cell key={i} fill={COLORS[i % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-center text-muted-foreground py-12">Sem dados</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Browsers & OS */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Monitor className="h-5 w-5 text-primary" />
                        Navegadores & Sistemas
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Navegadores</p>
                          {data.browsers.map((b, i) => (
                            <div key={b.name} className="flex justify-between text-sm py-1">
                              <span>{BROWSER_LABELS[b.name] || b.name}</span>
                              <Badge variant="secondary">{b.count}</Badge>
                            </div>
                          ))}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Sistemas</p>
                          {data.operatingSystems.map((o) => (
                            <div key={o.name} className="flex justify-between text-sm py-1">
                              <span>{OS_LABELS[o.name] || o.name}</span>
                              <Badge variant="secondary">{o.count}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* ===== TAB: BUSCA & FAVORITOS ===== */}
              <TabsContent value="busca" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Top Searches */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Search className="h-5 w-5 text-primary" />
                        Termos Mais Buscados
                      </CardTitle>
                      <CardDescription>
                        {data.totalSearches} buscas • {data.searchesWithNoResults} sem resultados
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {data.topSearches.length > 0 ? (
                        <div className="space-y-2">
                          {data.topSearches.map((s, i) => (
                            <div key={s.query} className="flex items-center justify-between py-1.5 border-b last:border-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                                <span className="text-sm font-medium">{s.query}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {s.avg_results === 0 && (
                                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">sem resultado</Badge>
                                )}
                                <Badge variant="secondary">{s.count}x</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center text-muted-foreground py-12">Nenhuma busca registrada</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Top Favorites */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Heart className="h-5 w-5 text-primary" />
                        Produtos Mais Favoritados
                      </CardTitle>
                      <CardDescription>
                        {data.totalFavoriteAdds} adicionados • {data.totalFavoriteRemoves} removidos
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {data.topFavorites.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={data.topFavorites} layout="vertical" margin={{ left: 100 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }}
                              tickFormatter={(v) => v.length > 18 ? v.slice(0, 18) + '…' : v} />
                            <Tooltip formatter={(v: number) => [`${v}`, 'Favoritos']} />
                            <Bar dataKey="count" fill="#ec4899" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-center text-muted-foreground py-12">Nenhum favorito registrado</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* ===== TAB: HEATMAP ===== */}
              <TabsContent value="heatmap" className="space-y-6">
                {data.heatmapPages && data.heatmapPages.length > 0 ? (
                  <div className="grid grid-cols-1 gap-6">
                    {data.heatmapPages.map((hp) => (
                      <Card key={hp.page}>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <MousePointerClick className="h-5 w-5 text-primary" />
                            Heatmap: {hp.page}
                          </CardTitle>
                          <CardDescription>
                            Distribuição de cliques na página (zonas mais quentes = mais cliques)
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <HeatmapGrid zones={hp.zones} />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-12">
                      <p className="text-center text-muted-foreground">
                        Dados de heatmap serão exibidos conforme os visitantes interagem com o site.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* ===== TAB: IA INSIGHTS ===== */}
              <TabsContent value="ia" className="space-y-6">
                <Card className="border-primary/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5 text-primary" />
                      Recomendações da IA
                    </CardTitle>
                    <CardDescription>
                      Insights gerados automaticamente baseados em todos os dados comportamentais
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {data.aiRecommendations?.insights?.length ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        {data.aiRecommendations.insights.map((insight, i) => (
                          <div key={i} className="p-4 rounded-lg border bg-card space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                {categoryIcon(insight.category)}
                                <h4 className="font-semibold text-sm">{insight.title}</h4>
                              </div>
                              <Badge variant={priorityColor(insight.priority) as any}>
                                {insight.priority}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{insight.description}</p>
                            <div className="flex items-center gap-1 text-xs text-primary">
                              <Lightbulb className="h-3 w-3" />
                              <span>{insight.impact}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : data.totalSessions === 0 ? (
                      <div className="text-center py-8 space-y-2">
                        <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto" />
                        <p className="text-muted-foreground">
                          Ainda não há dados suficientes. Os insights aparecerão conforme os visitantes navegam.
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-8 space-y-2">
                        <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto" />
                        <p className="text-muted-foreground">Não foi possível gerar recomendações. Tente novamente.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </div>
    </AdminLayout>
  );
};

export default Analytics;
