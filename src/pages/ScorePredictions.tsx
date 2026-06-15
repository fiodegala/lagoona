import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trash2, MessageCircle, Trophy } from 'lucide-react';
import { toast } from 'sonner';

interface Prediction {
  id: string;
  full_name: string;
  whatsapp: string;
  score_brasil: number;
  score_haiti: number;
  created_at: string;
}

const formatWa = (digits: string) => {
  const d = digits.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digits;
};

const ScorePredictions = () => {
  const [items, setItems] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('score_predictions' as any)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error('Erro ao carregar palpites');
    setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este palpite?')) return;
    const { error } = await supabase.from('score_predictions' as any).delete().eq('id', id);
    if (error) return toast.error('Erro ao excluir');
    toast.success('Palpite excluído');
    setItems((p) => p.filter((i) => i.id !== id));
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="h-6 w-6 text-store-gold" /> Palpites Brasil x Haiti
          </h1>
          <p className="text-muted-foreground">Palpites enviados pelos clientes na promoção do jogo</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              Nenhum palpite recebido ainda.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-left">
                      <th className="p-3">Nome</th>
                      <th className="p-3">WhatsApp</th>
                      <th className="p-3 text-center">Placar</th>
                      <th className="p-3">Data</th>
                      <th className="p-3 w-32"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((p) => {
                      const waLink = `https://wa.me/55${p.whatsapp.replace(/\D/g, '')}`;
                      return (
                        <tr key={p.id} className="border-t hover:bg-muted/30">
                          <td className="p-3 font-medium">{p.full_name}</td>
                          <td className="p-3">
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline inline-flex items-center gap-1"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              {formatWa(p.whatsapp)}
                            </a>
                          </td>
                          <td className="p-3 text-center">
                            <Badge variant="secondary" className="text-base font-bold">
                              {p.score_brasil} x {p.score_haiti}
                            </Badge>
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {new Date(p.created_at).toLocaleString('pt-BR')}
                          </td>
                          <td className="p-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(p.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

export default ScorePredictions;
