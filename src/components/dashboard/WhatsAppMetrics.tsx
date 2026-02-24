import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageCircle, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WhatsAppLog {
  id: string;
  status: string;
  message_type: string;
  created_at: string;
}

const WhatsAppMetrics = () => {
  const [logs, setLogs] = useState<WhatsAppLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadLogs = async () => {
      try {
        const { data } = await supabase
          .from('whatsapp_logs')
          .select('id, status, message_type, created_at')
          .order('created_at', { ascending: false });
        setLogs(data || []);
      } catch (error) {
        console.error('Error loading WhatsApp logs:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadLogs();
  }, []);

  const metrics = useMemo(() => {
    const total = logs.length;
    const sent = logs.filter(l => l.status === 'sent').length;
    const failed = logs.filter(l => l.status === 'error').length;
    const successRate = total > 0 ? (sent / total) * 100 : 0;

    // Last 7 days chart data
    const chartData = [];
    for (let i = 6; i >= 0; i--) {
      const day = startOfDay(subDays(new Date(), i));
      const nextDay = startOfDay(subDays(new Date(), i - 1));
      const dayLogs = logs.filter(l => {
        const d = new Date(l.created_at);
        return d >= day && d < nextDay;
      });
      chartData.push({
        name: format(day, 'EEE', { locale: ptBR }),
        enviados: dayLogs.filter(l => l.status === 'sent').length,
        falhas: dayLogs.filter(l => l.status === 'error').length,
      });
    }

    // By type
    const byType: Record<string, number> = {};
    logs.forEach(l => {
      byType[l.message_type] = (byType[l.message_type] || 0) + 1;
    });

    return { total, sent, failed, successRate, chartData, byType };
  }, [logs]);

  const typeLabels: Record<string, string> = {
    tracking: 'Rastreio',
    status_update: 'Status',
    order_confirmation: 'Confirmação',
  };

  if (isLoading) {
    return (
      <Card className="card-elevated">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (metrics.total === 0) {
    return null;
  }

  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-success" />
          WhatsApp - Métricas de Envio
        </CardTitle>
        <CardDescription>Histórico de notificações enviadas via WhatsApp</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{metrics.total}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Enviados</p>
          </div>
          <div className="bg-success/10 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-success">{metrics.sent}</p>
            <p className="text-xs text-muted-foreground mt-1">Sucesso</p>
          </div>
          <div className="bg-destructive/10 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-destructive">{metrics.failed}</p>
            <p className="text-xs text-muted-foreground mt-1">Falhas</p>
          </div>
          <div className="bg-primary/10 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <p className="text-2xl font-bold text-primary">{metrics.successRate.toFixed(0)}%</p>
              {metrics.successRate >= 90 ? (
                <CheckCircle className="h-4 w-4 text-success" />
              ) : (
                <TrendingUp className="h-4 w-4 text-warning" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Taxa de Sucesso</p>
          </div>
        </div>

        {/* Chart - Last 7 days */}
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-3">Últimos 7 dias</p>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="enviados" name="Enviados" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="falhas" name="Falhas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* By Type */}
        {Object.keys(metrics.byType).length > 0 && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Por Tipo</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(metrics.byType).map(([type, count]) => (
                <Badge key={type} variant="secondary" className="gap-1.5">
                  {typeLabels[type] || type}
                  <span className="bg-background/80 px-1.5 py-0.5 rounded text-xs font-bold">{count}</span>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WhatsAppMetrics;
