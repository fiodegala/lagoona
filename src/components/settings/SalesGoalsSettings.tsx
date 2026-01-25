import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Target, TrendingUp, Calendar, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SalesGoal {
  id: string;
  type: string;
  target_amount: number;
  is_active: boolean;
}

const SalesGoalsSettings = () => {
  const [goals, setGoals] = useState<SalesGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dailyGoal, setDailyGoal] = useState('');
  const [monthlyGoal, setMonthlyGoal] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchGoals();
  }, []);

  const fetchGoals = async () => {
    try {
      const { data, error } = await supabase
        .from('sales_goals')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      setGoals(data || []);
      
      const daily = data?.find(g => g.type === 'daily');
      const monthly = data?.find(g => g.type === 'monthly');
      
      setDailyGoal(daily?.target_amount?.toString() || '1000');
      setMonthlyGoal(monthly?.target_amount?.toString() || '30000');
    } catch (error) {
      console.error('Error fetching goals:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as metas.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const dailyValue = parseFloat(dailyGoal) || 0;
      const monthlyValue = parseFloat(monthlyGoal) || 0;

      if (dailyValue <= 0 || monthlyValue <= 0) {
        toast({
          title: 'Valores inválidos',
          description: 'As metas devem ser maiores que zero.',
          variant: 'destructive',
        });
        return;
      }

      const dailyGoalRecord = goals.find(g => g.type === 'daily');
      const monthlyGoalRecord = goals.find(g => g.type === 'monthly');

      const updates = [];

      if (dailyGoalRecord) {
        updates.push(
          supabase
            .from('sales_goals')
            .update({ target_amount: dailyValue, updated_at: new Date().toISOString() })
            .eq('id', dailyGoalRecord.id)
        );
      } else {
        updates.push(
          supabase
            .from('sales_goals')
            .insert({ type: 'daily', target_amount: dailyValue, is_active: true })
        );
      }

      if (monthlyGoalRecord) {
        updates.push(
          supabase
            .from('sales_goals')
            .update({ target_amount: monthlyValue, updated_at: new Date().toISOString() })
            .eq('id', monthlyGoalRecord.id)
        );
      } else {
        updates.push(
          supabase
            .from('sales_goals')
            .insert({ type: 'monthly', target_amount: monthlyValue, is_active: true })
        );
      }

      const results = await Promise.all(updates);
      
      const hasError = results.some(r => r.error);
      if (hasError) {
        throw new Error('Erro ao salvar metas');
      }

      toast({
        title: 'Metas atualizadas',
        description: 'As metas de vendas foram salvas com sucesso.',
      });

      fetchGoals();
    } catch (error) {
      console.error('Error saving goals:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar as metas.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value: string) => {
    const num = parseFloat(value) || 0;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (loading) {
    return (
      <Card className="card-elevated">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Metas de Vendas
        </CardTitle>
        <CardDescription>
          Configure suas metas de vendas diária e mensal para acompanhar o progresso no dashboard
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <Label htmlFor="daily-goal">Meta Diária</Label>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                R$
              </span>
              <Input
                id="daily-goal"
                type="number"
                min="0"
                step="100"
                value={dailyGoal}
                onChange={(e) => setDailyGoal(e.target.value)}
                className="pl-10"
                placeholder="1000"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Meta atual: {formatCurrency(dailyGoal)}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <Label htmlFor="monthly-goal">Meta Mensal</Label>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                R$
              </span>
              <Input
                id="monthly-goal"
                type="number"
                min="0"
                step="1000"
                value={monthlyGoal}
                onChange={(e) => setMonthlyGoal(e.target.value)}
                className="pl-10"
                placeholder="30000"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Meta atual: {formatCurrency(monthlyGoal)}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            As metas são usadas para calcular o progresso no dashboard
          </p>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar metas
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SalesGoalsSettings;
