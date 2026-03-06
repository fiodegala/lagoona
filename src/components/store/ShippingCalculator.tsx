import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Truck, Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { shippingService } from '@/services/shipping';

interface ShippingOption {
  name: string;
  price: number;
  days: string;
  company: string;
}

interface ShippingResult {
  name: string;
  price: number;
  days: string;
  isFreeShipping: boolean;
}

interface ShippingCalculatorProps {
  productWeight?: number;
  orderTotal?: number;
  onShippingCalculated?: (result: ShippingResult | null) => void;
}

const ShippingCalculator = ({ productWeight = 0.5, orderTotal = 0, onShippingCalculated }: ShippingCalculatorProps) => {
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
    const formatted = formatCep(e.target.value);
    setCep(formatted);
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
      // Fetch address info from ViaCEP
      const addressResponse = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const addressData = await addressResponse.json();

      if (addressData.erro) {
        toast.error('CEP não encontrado.');
        setIsLoading(false);
        return;
      }

      setAddress(`${addressData.localidade} - ${addressData.uf}`);

      // Calculate shipping using configured zones
      const result = await shippingService.calculateShipping(cleanCep, productWeight, orderTotal);

      if (!result) {
        setOptions([]);
        toast.info('Não há opções de frete disponíveis para este CEP.');
      } else {
        setOptions([{
          name: result.zone.name,
          price: result.price,
          days: result.estimatedDays,
          company: result.isFreeShipping ? 'Frete Grátis' : 'Transportadora',
        }]);
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
          {options.map((option, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-background rounded-lg border"
            >
              <div>
                <div className="font-medium text-sm">
                  {option.company} - {option.name}
                </div>
                <div className="text-xs text-muted-foreground">{option.days}</div>
              </div>
              <div className={`font-semibold ${option.price === 0 ? 'text-success' : ''}`}>
                {formatPrice(option.price)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ShippingCalculator;
