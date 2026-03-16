import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Truck, Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { shippingService } from '@/services/shipping';

interface ShippingResult {
  name: string;
  price: number;
  days: string;
  isFreeShipping: boolean;
}

interface ShippingCalculatorProps {
  productWeight?: number;
  orderTotal?: number;
  forceFreeShipping?: boolean;
  onShippingCalculated?: (result: ShippingResult | null) => void;
}

const FREE_SHIPPING_MIN = 299;

const ShippingCalculator = ({
  productWeight = 0.3,
  orderTotal = 0,
  forceFreeShipping = false,
  onShippingCalculated,
}: ShippingCalculatorProps) => {
  const [cep, setCep] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ zone: any; price: number; isFreeShipping: boolean; estimatedDays: string } | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [noZone, setNoZone] = useState(false);

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
    setResult(null);
    setAddress(null);
    setNoZone(false);

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

      // Calculate using internal shipping zones
      const shippingResult = await shippingService.calculateShipping(cleanCep, productWeight, orderTotal);

      if (!shippingResult) {
        setNoZone(true);
        onShippingCalculated?.(null);
        toast.info('Não há opções de frete disponíveis para este CEP.');
        return;
      }

      const isFree = forceFreeShipping || (shippingResult.zone.free_shipping_min_value !== null && orderTotal >= shippingResult.zone.free_shipping_min_value) || orderTotal >= FREE_SHIPPING_MIN;
      const finalPrice = isFree ? 0 : shippingResult.price;

      setResult({ ...shippingResult, price: finalPrice, isFreeShipping: isFree });

      onShippingCalculated?.({
        name: shippingResult.zone.name,
        price: finalPrice,
        days: shippingResult.estimatedDays,
        isFreeShipping: isFree,
      });
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

      {noZone && (
        <p className="text-sm text-muted-foreground">Nenhuma opção disponível para este CEP.</p>
      )}

      {result && (
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between p-3 bg-background rounded-lg border">
            <div>
              <div className="font-medium text-sm">{result.zone.name}</div>
              <div className="text-xs text-muted-foreground">{result.estimatedDays}</div>
            </div>
            <div className={`font-semibold ${result.isFreeShipping ? 'text-success' : ''}`}>
              {result.isFreeShipping && result.price === 0 && (
                <span className="text-xs line-through text-muted-foreground mr-1">
                  {formatPrice(result.zone.base_price + (result.zone.price_per_kg * productWeight))}
                </span>
              )}
              {formatPrice(result.price)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShippingCalculator;
