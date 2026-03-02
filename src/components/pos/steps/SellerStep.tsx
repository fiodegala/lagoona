import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { User, Loader2, ChevronLeft } from 'lucide-react';

export interface Seller {
  user_id: string;
  full_name: string;
  role: string;
}

interface SellerStepProps {
  selectedSeller: Seller | null;
  onSelect: (seller: Seller) => void;
  onNext: () => void;
  onBack: () => void;
}

const SellerStep = ({ selectedSeller, onSelect, onNext, onBack }: SellerStepProps) => {
  const { userStoreId } = useAuth();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSellers = async () => {
      setIsLoading(true);
      try {
        let query = supabase
          .from('user_roles')
          .select('user_id, role, store_id');

        if (userStoreId) {
          query = query.eq('store_id', userStoreId);
        }

        const { data: rolesData } = await query;

        if (rolesData && rolesData.length > 0) {
          const userIds = rolesData.map(r => r.user_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, full_name')
            .in('user_id', userIds);

          if (profiles) {
            const sellersData = profiles.map(p => {
              const roleEntry = rolesData.find(r => r.user_id === p.user_id);
              return {
                user_id: p.user_id,
                full_name: p.full_name,
                role: roleEntry?.role || 'seller',
              };
            });
            setSellers(sellersData);
          }
        }
      } catch (error) {
        console.error('Error fetching sellers:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSellers();
  }, [userStoreId]);

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Administrador',
      manager: 'Gerente',
      seller: 'Vendedor',
      support: 'Suporte',
    };
    return labels[role] || role;
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <h2 className="text-2xl font-bold mb-2">Selecione o Vendedor</h2>
      <p className="text-muted-foreground mb-8">Quem está realizando esta venda?</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full max-w-2xl">
        {sellers.map((seller) => (
          <button
            key={seller.user_id}
            className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all hover:shadow-md ${
              selectedSeller?.user_id === seller.user_id
                ? 'border-primary bg-primary/5 shadow-md'
                : 'border-border hover:border-primary/50'
            }`}
            onClick={() => onSelect(seller)}
          >
            <div className={`p-3 rounded-full ${
              selectedSeller?.user_id === seller.user_id 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground'
            }`}>
              <User className="h-6 w-6" />
            </div>
            <div className="text-center">
              <div className="font-semibold">{seller.full_name}</div>
              <div className="text-xs text-muted-foreground">{getRoleLabel(seller.role)}</div>
            </div>
          </button>
        ))}
      </div>

      {sellers.length === 0 && (
        <div className="text-center text-muted-foreground py-8">
          <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum vendedor encontrado para esta loja</p>
        </div>
      )}

      <div className="flex gap-4 mt-8">
        <Button variant="outline" size="lg" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <Button size="lg" className="px-12" onClick={onNext} disabled={!selectedSeller}>
          Próximo
        </Button>
      </div>
    </div>
  );
};

export default SellerStep;
