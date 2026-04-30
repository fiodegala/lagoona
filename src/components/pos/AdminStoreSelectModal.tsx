import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Store, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface StoreOption {
  id: string;
  name: string;
  type: string;
}

interface AdminStoreSelectModalProps {
  open: boolean;
  onSelect: (storeId: string, storeName: string) => void;
}

const AdminStoreSelectModal = ({ open, onSelect }: AdminStoreSelectModalProps) => {
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('stores')
        .select('id, name, type')
        .in('type', ['physical', 'online'])
        .order('name');
      setStores((data as StoreOption[]) || []);
      setLoading(false);
    })();
  }, [open]);

  const handleConfirm = () => {
    const store = stores.find((s) => s.id === selected);
    if (store) onSelect(store.id, store.name);
  };

  return (
    <Dialog open={open} onOpenChange={() => { /* não permite fechar sem escolher */ }}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Selecione a loja
          </DialogTitle>
          <DialogDescription>
            Como administrador, escolha em qual loja física as vendas desta sessão do PDV serão registradas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4">
          <Label>Loja</Label>
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha a loja..." />
              </SelectTrigger>
              <SelectContent>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleConfirm} disabled={!selected || loading} className="w-full">
            Confirmar e abrir PDV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminStoreSelectModal;
