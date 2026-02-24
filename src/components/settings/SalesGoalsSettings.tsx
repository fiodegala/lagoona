import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Target, TrendingUp, Calendar, Loader2, Lock, Store } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface SalesGoal {
  id: string;
  type: string;
  target_amount: number;
  is_active: boolean;
  store_id: string | null;
}

interface StoreInfo {
  id: string;
  name: string;
}

interface StoreGoals {
  dailyGoal: string;
  monthlyGoal: string;
  dailyRecord: SalesGoal | null;
  monthlyRecord: SalesGoal | null;
}

const SalesGoalsSettings = () => {
  const { canManageGoals, isAdmin } = useAuth();
  const [goals, setGoals] = useState<SalesGoal[]>([]);
  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dailyGoal, setDailyGoal] = useState('');
  const [monthlyGoal, setMonthlyGoal] = useState('');
  const [storeGoals, setStoreGoals] = useState<Record<string, StoreGoals>>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [goalsRes, storesRes] = await Promise.all([
        supabase.from('sales_goals').select('*').eq('is_active', true),
        isAdmin ? supabase.from('stores').select('id, name').eq('is_active', true) : Promise.resolve({ data: [] }),
      ]);

      if (goalsRes.error) throw goalsRes.error;

      const allGoals = (goalsRes.data || []) as SalesGoal[];
      setGoals(allGoals);

      // Global goals (store_id is null)
      const daily = allGoals.find(g => g.type === 'daily' && !g.store_id);
      const monthly = allGoals.find(g => g.type === 'monthly' && !g.store_id);
      setDailyGoal(daily?.target_amount?.toString() || '1000');
      setMonthlyGoal(monthly?.target_amount?.toString() || '30000');

      // Per-store goals
      if (isAdmin && storesRes.data) {
        const storeList = storesRes.data as StoreInfo[];
        setStores(storeList);

        const perStore: Record<string, StoreGoals> = {};
        for (const store of storeList) {
          const d = allGoals.find(g => g.type === 'daily' && g.store_id === store.id);
          const m = allGoals.find(g => g.type === 'monthly' && g.store_id === store.id);
          perStore[store.id] = {
            dailyGoal: d?.target_amount?.toString() || '',
            monthlyGoal: m?.target_amount?.toString() || '',
            dailyRecord: d || null,
            monthlyRecord: m || null,
          };
        }
        setStoreGoals(perStore);
      }
    } catch (error) {
      console.error('Error fetching goals:', error);
      toast({ title: 'Erro', description: 'Não foi possível carregar as metas.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const saveGoal = async (type: string, value: number, storeId: string | null, existingRecord: SalesGoal | null) => {
    if (existingRecord) {
      return supabase
        .from('sales_goals')
        .update({ target_amount: value, updated_at: new Date().toISOString() })
        .eq('id', existingRecord.id);
    } else {
      const insert: any = { type, target_amount: value, is_active: true };
      if (storeId) insert.store_id = storeId;
      return supabase.from('sales_goals').insert(insert);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const dailyValue = parseFloat(dailyGoal) || 0;
      const monthlyValue = parseFloat(monthlyGoal) || 0;

      if (dailyValue <= 0 || monthlyValue <= 0) {
        toast({ title: 'Valores inválidos', description: 'As metas globais devem ser maiores que zero.', variant: 'destructive' });
        setSaving(false);
        return;
      }

      const dailyRecord = goals.find(g => g.type === 'daily' && !g.store_id) || null;
      const monthlyRecord = goals.find(g => g.type === 'monthly' && !g.store_id) || null;

      const updates = [
        saveGoal('daily', dailyValue, null, dailyRecord),
        saveGoal('monthly', monthlyValue, null, monthlyRecord),
      ];

      // Save per-store goals for admin
      if (isAdmin) {
        for (const store of stores) {
          const sg = storeGoals[store.id];
          if (!sg) continue;

          const dVal = parseFloat(sg.dailyGoal);
          const mVal = parseFloat(sg.monthlyGoal);

          if (dVal > 0) {
            updates.push(saveGoal('daily', dVal, store.id, sg.dailyRecord));
          }
          if (mVal > 0) {
            updates.push(saveGoal('monthly', mVal, store.id, sg.monthlyRecord));
          }
        }
      }

      const results = await Promise.all(updates);
      if (results.some(r => r.error)) throw new Error('Erro ao salvar metas');

      toast({ title: 'Metas atualizadas', description: 'As metas de vendas foram salvas com sucesso.' });
      fetchData();
    } catch (error) {
      console.error('Error saving goals:', error);
      toast({ title: 'Erro', description: 'Não foi possível salvar as metas.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const updateStoreGoal = (storeId: string, field: 'dailyGoal' | 'monthlyGoal', value: string) => {
    setStoreGoals(prev => ({
      ...prev,
      [storeId]: { ...prev[storeId], [field]: value },
    }));
  };

  const formatCurrency = (value: string) => {
    const num = parseFloat(value) || 0;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const GoalInputs = ({ daily, monthly, onDailyChange, onMonthlyChange, disabled, idPrefix }: {
    daily: string; monthly: string;
    onDailyChange: (v: string) => void; onMonthlyChange: (v: string) => void;
    disabled: boolean; idPrefix: string;
  }) => (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <Label htmlFor={`${idPrefix}-daily`}>Meta Diária</Label>
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
          <Input id={`${idPrefix}-daily`} type="number" min="0" step="100" value={daily}
            onChange={(e) => onDailyChange(e.target.value)} className="pl-10" placeholder="1000" disabled={disabled} />
        </div>
        {daily && <p className="text-xs text-muted-foreground">Meta atual: {formatCurrency(daily)}</p>}
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <Label htmlFor={`${idPrefix}-monthly`}>Meta Mensal</Label>
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
          <Input id={`${idPrefix}-monthly`} type="number" min="0" step="1000" value={monthly}
            onChange={(e) => onMonthlyChange(e.target.value)} className="pl-10" placeholder="30000" disabled={disabled} />
        </div>
        {monthly && <p className="text-xs text-muted-foreground">Meta atual: {formatCurrency(monthly)}</p>}
      </div>
    </div>
  );

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
        {!canManageGoals && (
          <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Você não tem permissão para editar as metas de vendas
            </span>
          </div>
        )}

        {isAdmin && stores.length > 0 ? (
          <Tabs defaultValue="global">
            <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0 mb-4">
              <TabsTrigger value="global" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-3 py-1.5 text-xs border">
                <Target className="h-3.5 w-3.5 mr-1.5" />
                Global
              </TabsTrigger>
              {stores.map(store => (
                <TabsTrigger key={store.id} value={store.id} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-3 py-1.5 text-xs border">
                  <Store className="h-3.5 w-3.5 mr-1.5" />
                  {store.name}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="global" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Meta geral utilizada quando não há meta específica para uma loja.
              </p>
              <GoalInputs daily={dailyGoal} monthly={monthlyGoal}
                onDailyChange={setDailyGoal} onMonthlyChange={setMonthlyGoal}
                disabled={!canManageGoals} idPrefix="global" />
            </TabsContent>

            {stores.map(store => (
              <TabsContent key={store.id} value={store.id} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Metas específicas para <strong>{store.name}</strong>. Deixe em branco para usar a meta global.
                </p>
                <GoalInputs
                  daily={storeGoals[store.id]?.dailyGoal || ''}
                  monthly={storeGoals[store.id]?.monthlyGoal || ''}
                  onDailyChange={(v) => updateStoreGoal(store.id, 'dailyGoal', v)}
                  onMonthlyChange={(v) => updateStoreGoal(store.id, 'monthlyGoal', v)}
                  disabled={!canManageGoals} idPrefix={store.id}
                />
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <GoalInputs daily={dailyGoal} monthly={monthlyGoal}
            onDailyChange={setDailyGoal} onMonthlyChange={setMonthlyGoal}
            disabled={!canManageGoals} idPrefix="global" />
        )}

        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            As metas são usadas para calcular o progresso no dashboard
          </p>
          <Button onClick={handleSave} disabled={saving || !canManageGoals}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar metas
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SalesGoalsSettings;
