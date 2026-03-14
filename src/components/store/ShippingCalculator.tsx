import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Truck, Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ShippingOption {
  id: number;
  name: string;
  price: number;
  discount: number;
  deliveryTime: number;
  deliveryRange: { min: number; max: number };
  company: { id: number; name: string; picture: string };
}

interface ShippingResult {
  name: string;
  price: number;
  days: string;
  isFreeShipping: boolean;
}

interface ShippingCalculatorProps {
  productWeight?: number;
  productWidth?: number;
  productHeight?: number;
  productLength?: number;
  orderTotal?: number;
  forceFreeShipping?: boolean;
  onShippingCalculated?: (result: ShippingResult | null) => void;
}

const FREE_SHIPPING_MIN = 299;

const ShippingCalculator = ({
  productWeight = 0.3,
  productWidth = 11,
  productHeight = 2,
  productLength = 16,
  orderTotal = 0,
  forceFreeShipping = false,
  onShippingCalculated,
}: ShippingCalculatorProps) => {
  const [cep, setCep] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<ShippingOption[] | null>(null);
  const [address, setAddress] = useState<string | null>(null);

  const formatCep = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 5) return numbers;
    return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`;
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCep(formatCep(e.target.value));
  };

  const calculateShipping = async () => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      toast.error('CEP inválido. Digite um CEP com 8 dígitos.');
      return;
    }

    setIsLoading(true);
    setOptions(null);
    setAddress(null);

    try {
      // Fetch address from ViaCEP
      const addressResponse = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const addressData = await addressResponse.json();

      if (addressData.erro) {
        toast.error('CEP não encontrado.');
        setIsLoading(false);
        return;
      }

      setAddress(`${addressData.localidade} - ${addressData.uf}`);

      // Calculate via Melhor Envio
      const { data, error } = await supabase.functions.invoke('melhor-envio', {
        body: {
          action: 'calculate',
          from_zip: '01001000', // CEP da loja - ajustar conforme necessário
          to_zip: cleanCep,
          weight: productWeight,
          width: productWidth,
          height: productHeight,
          length: productLength,
          insurance_value: orderTotal,
        },
      });

      if (error) {
        console.error('Melhor Envio error:', error);
        toast.error('Erro ao calcular frete. Tente novamente.');
        return;
      }

      if (!data?.services || data.services.length === 0) {
        setOptions([]);
        onShippingCalculated?.(null);
        toast.info('Não há opções de frete disponíveis para este CEP.');
        return;
      }

      const services: ShippingOption[] = data.services.map((s: any) => ({
        id: s.id,
        name: s.name,
        price: s.price - (s.discount || 0),
        discount: s.discount || 0,
        deliveryTime: s.delivery_time,
        deliveryRange: s.delivery_range || { min: s.delivery_time, max: s.delivery_time },
        company: s.company,
      }));

      setOptions(services);

      // Callback with cheapest option
      if (services.length > 0) {
        const cheapest = services.reduce((a, b) => (a.price < b.price ? a : b));
        const isFree = forceFreeShipping || orderTotal >= FREE_SHIPPING_MIN;
        const daysText =
          cheapest.deliveryRange.min === cheapest.deliveryRange.max
            ? `${cheapest.deliveryRange.min} dias úteis`
            : `${cheapest.deliveryRange.min} a ${cheapest.deliveryRange.max} dias úteis`;

        onShippingCalculated?.({
          name: `${cheapest.company.name} - ${cheapest.name}`,
          price: isFree ? 0 : cheapest.price,
          days: daysText,
          isFreeShipping: isFree,
        });
      }
    } catch (error) {
      console.error('Error calculating shipping:', error);
      toast.error('Erro ao calcular frete. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    if (price === 0) return 'Grátis';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const isFree = forceFreeShipping || orderTotal >= FREE_SHIPPING_MIN;

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Truck className="h-4 w-4 text-store-primary" />
        <span>Calcular Frete e Prazo</span>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            placeholder="00000-000"
            value={cep}
            onChange={handleCepChange}
            maxLength={9}
            className="pr-10"
          />
          <a
            href="https://buscacepinter.correios.com.br/app/endereco/index.php"
            target="_blank"
            rel="noopener noreferrer"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-store-primary hover:underline"
          >
            Não sei
          </a>
        </div>
        <Button
          onClick={calculateShipping}
          disabled={isLoading || cep.replace(/\D/g, '').length !== 8}
          className="bg-store-primary text-store-accent hover:bg-store-primary/90"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Calcular'}
        </Button>
      </div>

      {address && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>{address}</span>
        </div>
      )}

      {options && (
        <div className="space-y-2 pt-2">
          {options.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma opção disponível para este CEP.</p>
          )}
          {options.map((option) => {
            const finalPrice = isFree ? 0 : option.price;
            const daysText =
              option.deliveryRange.min === option.deliveryRange.max
                ? `${option.deliveryRange.min} dias úteis`
                : `${option.deliveryRange.min} a ${option.deliveryRange.max} dias úteis`;

            return (
              <div
                key={option.id}
                className="flex items-center justify-between p-3 bg-background rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  {option.company.picture && (
                    <img
                      src={option.company.picture}
                      alt={option.company.name}
                      className="h-6 w-auto object-contain"
                    />
                  )}
                  <div>
                    <div className="font-medium text-sm">
                      {option.company.name} - {option.name}
                    </div>
                    <div className="text-xs text-muted-foreground">{daysText}</div>
                  </div>
                </div>
                <div className={`font-semibold ${finalPrice === 0 ? 'text-success' : ''}`}>
                  {isFree && option.price > 0 && (
                    <span className="text-xs line-through text-muted-foreground mr-1">
                      {formatPrice(option.price)}
                    </span>
                  )}
                  {formatPrice(finalPrice)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ShippingCalculator;
