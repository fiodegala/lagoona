import { useEffect, useState } from 'react';
import { Plus, Trash2, GripVertical, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ImageUpload from '@/components/ImageUpload';

interface FeedbackPrint {
  id: string;
  image_url: string;
  customer_name: string;
  caption: string;
  sort_order: number;
  is_active: boolean;
}

const CustomerFeedbackSettings = () => {
  const [prints, setPrints] = useState<FeedbackPrint[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('customer_feedback_prints')
      .select('*')
      .order('sort_order', { ascending: true });
    if (data) setPrints(data as FeedbackPrint[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addPrint = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('customer_feedback_prints')
      .insert({
        image_url: '',
        customer_name: '',
        caption: '',
        sort_order: prints.length,
      });
    if (error) {
      toast.error('Erro ao adicionar');
    } else {
      toast.success('Print adicionado');
      await load();
    }
    setSaving(false);
  };

  const updatePrint = async (id: string, updates: Partial<FeedbackPrint>) => {
    const { error } = await supabase
      .from('customer_feedback_prints')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) toast.error('Erro ao salvar');
    else {
      setPrints(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
      toast.success('Salvo!');
    }
  };

  const deletePrint = async (id: string) => {
    const { error } = await supabase
      .from('customer_feedback_prints')
      .delete()
      .eq('id', id);
    if (error) toast.error('Erro ao remover');
    else {
      setPrints(prev => prev.filter(p => p.id !== id));
      toast.success('Removido');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Prints de Feedback</h3>
          <p className="text-sm text-muted-foreground">
            Adicione screenshots de feedbacks de clientes (WhatsApp, Instagram, etc.)
          </p>
        </div>
        <Button onClick={addPrint} disabled={saving} className="gap-2">
          <Plus className="h-4 w-4" />
          Adicionar Print
        </Button>
      </div>

      {prints.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          Nenhum print cadastrado. Clique em "Adicionar Print" para começar.
        </p>
      ) : (
        <div className="space-y-4">
          {prints.map((print, index) => (
            <div key={print.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Print #{index + 1}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`active-${print.id}`} className="text-xs">Ativo</Label>
                    <Switch
                      id={`active-${print.id}`}
                      checked={print.is_active}
                      onCheckedChange={(checked) => updatePrint(print.id, { is_active: checked })}
                    />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deletePrint(print.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Imagem do Print</Label>
                  <ImageUpload
                    value={print.image_url}
                    onChange={(url) => updatePrint(print.id, { image_url: url })}
                    folder="feedback-prints"
                  />
                </div>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Nome do Cliente</Label>
                    <Input
                      value={print.customer_name}
                      onChange={(e) => setPrints(prev => prev.map(p => p.id === print.id ? { ...p, customer_name: e.target.value } : p))}
                      onBlur={() => updatePrint(print.id, { customer_name: print.customer_name })}
                      placeholder="Ex: Maria Silva"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Legenda (opcional)</Label>
                    <Input
                      value={print.caption}
                      onChange={(e) => setPrints(prev => prev.map(p => p.id === print.id ? { ...p, caption: e.target.value } : p))}
                      onBlur={() => updatePrint(print.id, { caption: print.caption })}
                      placeholder="Ex: Amei a qualidade!"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Ordem</Label>
                    <Input
                      type="number"
                      value={print.sort_order}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setPrints(prev => prev.map(p => p.id === print.id ? { ...p, sort_order: val } : p));
                      }}
                      onBlur={() => updatePrint(print.id, { sort_order: print.sort_order })}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomerFeedbackSettings;
