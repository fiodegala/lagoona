import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Brain, Clock, MousePointerClick, ShoppingCart, Eye, TrendingUp, AlertTriangle, Lightbulb, ArrowRight, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, FunnelChart, Funnel, LabelList, Cell, PieChart, Pie, Legend } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AnalyticsData {
  period: string;
  totalSessions: number;
  avgTimeByPage: { page: string; avg_seconds: number; views: number }[];
  clickMap: { area: string; count: number }[];
  topProducts: { id: string; name: string; views: number }[];
  funnel: Record<string, number>;
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

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  '#8b5cf6',
  '#ec4899',
  '#f97316',
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
    default: return <TrendingUp className="h-4 w-4" />;
  }
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
            <p className="text-muted-foreground">Análise do comportamento dos visitantes e recomendações inteligentes</p>
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{data.totalSessions}</div>
                  <p className="text-xs text-muted-foreground">Sessões no período</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{data.topProducts.length}</div>
                  <p className="text-xs text-muted-foreground">Produtos visualizados</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{conversionRate}%</div>
                  <p className="text-xs text-muted-foreground">Taxa de Conversão</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">
                    {data.avgTimeByPage.length > 0
                      ? `${Math.round(data.avgTimeByPage.reduce((s, p) => s + p.avg_seconds, 0) / data.avgTimeByPage.length)}s`
                      : '—'}
                  </div>
                  <p className="text-xs text-muted-foreground">Tempo médio por página</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Time on Page */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Tempo Médio por Página
                  </CardTitle>
                  <CardDescription>Quanto tempo os visitantes ficam em cada página (segundos)</CardDescription>
                </CardHeader>
                <CardContent>
                  {data.avgTimeByPage.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={data.avgTimeByPage.slice(0, 10)} layout="vertical" margin={{ left: 80 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis
                          dataKey="page"
                          type="category"
                          width={80}
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v) => v.length > 15 ? v.slice(0, 15) + '…' : v}
                        />
                        <Tooltip formatter={(v: number) => [`${v}s`, 'Tempo médio']} />
                        <Bar dataKey="avg_seconds" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground py-12">Nenhum dado de tempo disponível ainda</p>
                  )}
                </CardContent>
              </Card>

              {/* Top Products */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-primary" />
                    Produtos Mais Acessados
                  </CardTitle>
                  <CardDescription>Ranking de produtos por número de visualizações</CardDescription>
                </CardHeader>
                <CardContent>
                  {data.topProducts.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={data.topProducts} layout="vertical" margin={{ left: 100 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis
                          dataKey="name"
                          type="category"
                          width={100}
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v) => v.length > 18 ? v.slice(0, 18) + '…' : v}
                        />
                        <Tooltip formatter={(v: number) => [`${v}`, 'Visualizações']} />
                        <Bar dataKey="views" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground py-12">Nenhum produto visualizado ainda</p>
                  )}
                </CardContent>
              </Card>

              {/* Funnel */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-primary" />
                    Funil de Conversão
                  </CardTitle>
                  <CardDescription>Jornada do visitante até a compra</CardDescription>
                </CardHeader>
                <CardContent>
                  {data.totalSessions > 0 ? (
                    <div className="space-y-3">
                      {funnelData.map((step, i) => {
                        const pct = funnelData[0].value > 0
                          ? Math.round((step.value / funnelData[0].value) * 100)
                          : 0;
                        return (
                          <div key={step.name} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span>{step.name}</span>
                              <span className="font-medium">{step.value} ({pct}%)</span>
                            </div>
                            <div className="h-8 bg-muted rounded-md overflow-hidden">
                              <div
                                className="h-full rounded-md transition-all"
                                style={{
                                  width: `${Math.max(pct, 2)}%`,
                                  backgroundColor: COLORS[i % COLORS.length],
                                }}
                              />
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
                    <p className="text-center text-muted-foreground py-12">Sem dados de funil disponíveis</p>
                  )}
                </CardContent>
              </Card>

              {/* Click Map */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MousePointerClick className="h-5 w-5 text-primary" />
                    Mapa de Cliques por Área
                  </CardTitle>
                  <CardDescription>Quais áreas do site recebem mais interações</CardDescription>
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
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={100}
                          fill="hsl(var(--primary))"
                          dataKey="value"
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
                    <p className="text-center text-muted-foreground py-12">Nenhum clique registrado ainda</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* AI Recommendations */}
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  Recomendações da IA
                </CardTitle>
                <CardDescription>
                  Insights gerados automaticamente baseados no comportamento dos seus visitantes
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.aiRecommendations?.insights?.length ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {data.aiRecommendations.insights.map((insight, i) => (
                      <div
                        key={i}
                        className="p-4 rounded-lg border bg-card space-y-2"
                      >
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
                      Ainda não há dados suficientes para gerar recomendações. Os insights aparecerão conforme os visitantes navegam pelo site.
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-8 space-y-2">
                    <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto" />
                    <p className="text-muted-foreground">Não foi possível gerar recomendações neste momento. Tente novamente.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </AdminLayout>
  );
};

export default Analytics;
