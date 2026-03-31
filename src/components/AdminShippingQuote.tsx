import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Truck, Loader2, MapPin, Search, Package, Printer, CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ShippingService {
  id: number;
  name: string;
  price: number;
  discount: number;
  deliveryTime: number;
  deliveryRange: { min: number; max: number };
  company: { id: number; name: string; picture: string };
}

interface OrderData {
  orderId: string;
  recipientName: string;
  recipientEmail: string;
  recipientPhone: string;
  recipientDocument: string;
  address: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  total: number;
  items: any[];
}

interface AdminShippingQuoteProps {
  initialCep?: string;
  initialWeight?: number;
  initialWidth?: number;
  initialHeight?: number;
  initialLength?: number;
  initialInsuranceValue?: number;
  compact?: boolean;
  showGenerateLabel?: boolean;
  orderData?: OrderData;
}

const AdminShippingQuote = ({
  initialCep = '',
  initialWeight = 0.3,
  initialWidth = 11,
  initialHeight = 2,
  initialLength = 16,
  initialInsuranceValue = 0,
  compact = false,
  showGenerateLabel = false,
  orderData,
}: AdminShippingQuoteProps) => {
  const [cep, setCep] = useState(initialCep);
  const [weight, setWeight] = useState(initialWeight);
  const [width, setWidth] = useState(initialWidth);
  const [height, setHeight] = useState(initialHeight);
  const [length, setLength] = useState(initialLength);
  const [insuranceValue, setInsuranceValue] = useState(initialInsuranceValue);
  const [isLoading, setIsLoading] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [services, setServices] = useState<ShippingService[] | null>(null);
  const [selectedService, setSelectedService] = useState<ShippingService | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [labelUrl, setLabelUrl] = useState<string | null>(null);

  const formatCep = (v: string) => {
    const n = v.replace(/\D/g, '').slice(0, 8);
    return n.length > 5 ? `${n.slice(0, 5)}-${n.slice(5)}` : n;
  };

  const handleCalculate = async () => {
    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) {
      toast.error('CEP inválido');
      return;
    }

    setIsLoading(true);
    setServices(null);
    setSelectedService(null);
    setLabelUrl(null);
    setAddress(null);

    try {
      const addrRes = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const addrData = await addrRes.json();
      if (!addrData.erro) {
        setAddress(`${addrData.localidade} - ${addrData.uf}`);
      }

      const { data, error } = await supabase.functions.invoke('melhor-envio', {
        body: {
          action: 'calculate',
          from_zip: '74550020',
          to_zip: clean,
          weight,
          width,
          height,
          length,
          insurance_value: insuranceValue,
        },
      });

      if (error || !data?.services?.length) {
        toast.error('Nenhuma opção de frete encontrada');
        setServices([]);
        return;
      }

      const mapped: ShippingService[] = data.services.map((s: any) => ({
        id: s.id,
        name: s.name,
        price: s.price - (s.discount || 0),
        discount: s.discount || 0,
        deliveryTime: s.delivery_time,
        deliveryRange: s.delivery_range || { min: s.delivery_time, max: s.delivery_time },
        company: s.company,
      }));

      setServices(mapped);
      toast.success(`${mapped.length} opções encontradas`);
    } catch {
      toast.error('Erro ao calcular frete');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateLabel = async (service: ShippingService) => {
    if (!orderData) {
      toast.error('Dados do pedido são necessários para gerar a etiqueta.');
      return;
    }
    if (!orderData.recipientDocument) {
      toast.error('CPF/CNPJ do destinatário é obrigatório para gerar etiqueta.');
      return;
    }

    setIsGenerating(true);
    setSelectedService(service);
    try {
      const { data, error } = await supabase.functions.invoke('melhor-envio', {
        body: {
          action: 'generate_label',
          service_id: service.id,
          order_data: {
            order_id: orderData.orderId,
            from: {
              name: 'FDG - Fio de Gala',
              phone: '62999999999',
              email: 'contato@fiodegala.com.br',
              document: '07950021000117',
              address: 'Rua Exemplo',
              number: '100',
              complement: '',
              neighborhood: 'Centro',
              city: 'Goiânia',
              state_abbr: 'GO',
              postal_code: '74550020',
            },
            to: {
              name: orderData.recipientName,
              phone: orderData.recipientPhone,
              email: orderData.recipientEmail,
              document: orderData.recipientDocument,
              address: orderData.address,
              number: orderData.number,
              complement: orderData.complement,
              neighborhood: orderData.neighborhood,
              city: orderData.city,
              state_abbr: orderData.state,
              postal_code: orderData.zipCode.replace(/\D/g, ''),
            },
            products: [{
              name: orderData.items.map((i: any) => i.name || i.product_name).join(', ').slice(0, 100) || 'Pedido',
              quantity: 1,
              unitary_value: orderData.total,
            }],
            package: {
              weight,
              width,
              height,
              length,
            },
            insurance_value: insuranceValue || orderData.total,
          },
        },
      });

      if (error) {
        console.error('Generate label error:', error);
        toast.error('Erro ao gerar etiqueta. Verifique os dados do pedido.');
        return;
      }

      if (data?.label_url) {
        setLabelUrl(data.label_url);
        toast.success('Etiqueta gerada com sucesso!');
      } else if (data?.error) {
        console.error('Label error from API:', data.error);
        toast.error(`Erro: ${data.error}`);
      } else {
        toast.error('Resposta inesperada ao gerar etiqueta');
      }
    } catch (err) {
      console.error('Label generation error:', err);
      toast.error('Erro ao gerar etiqueta. Tente outro serviço de envio.');
    } finally {
      setIsGenerating(false);
    }
  };

  const formatPrice = (p: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p);

  const daysText = (s: ShippingService) =>
    s.deliveryRange.min === s.deliveryRange.max
      ? `${s.deliveryRange.min} dias úteis`
      : `${s.deliveryRange.min}-${s.deliveryRange.max} dias úteis`;

  if (compact) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="CEP destino"
            value={formatCep(cep)}
            onChange={(e) => setCep(e.target.value.replace(/\D/g, '').slice(0, 8))}
            className="flex-1"
          />
          <Button onClick={handleCalculate} disabled={isLoading} size="sm">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        {address && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {address}
          </p>
        )}

        {services && services.length > 0 && (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {services.map((s) => (
              <div
                key={s.id}
                className={`flex items-center justify-between p-2.5 rounded-lg border text-sm cursor-pointer transition-colors ${
                  selectedService?.id === s.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                }`}
                onClick={() => setSelectedService(s)}
              >
                <div className="flex items-center gap-2">
                  {s.company.picture && (
                    <img src={s.company.picture} alt={s.company.name} className="h-5 w-auto" />
                  )}
                  <div>
                    <p className="font-medium">{s.company.name} - {s.name}</p>
                    <p className="text-xs text-muted-foreground">{daysText(s)}</p>
                  </div>
                </div>
                <span className="font-semibold">{formatPrice(s.price)}</span>
              </div>
            ))}
          </div>
        )}

        {showGenerateLabel && selectedService && (
          <Button
            onClick={() => handleGenerateLabel(selectedService)}
            disabled={isGenerating}
            size="sm"
            className="w-full"
          >
            {isGenerating ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Gerando...</>
            ) : (
              <><Printer className="h-4 w-4 mr-2" /> Gerar Etiqueta ({formatPrice(selectedService.price)})</>
            )}
          </Button>
        )}

        {!showGenerateLabel && services && services.length > 0 && (
          <p className="text-xs text-muted-foreground">
            A etiqueta deve ser gerada a partir de um pedido com os dados completos do destinatário.
          </p>
        )}

        {showGenerateLabel && labelUrl && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <a href={labelUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-green-700 dark:text-green-400 hover:underline">
              Abrir etiqueta →
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Cotação Rápida - Melhor Envio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="col-span-2 md:col-span-1 space-y-1.5">
            <Label className="text-xs">CEP destino *</Label>
            <Input
              placeholder="00000-000"
              value={formatCep(cep)}
              onChange={(e) => setCep(e.target.value.replace(/\D/g, '').slice(0, 8))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Peso (kg)</Label>
            <Input
              type="number" min="0.01" step="0.01" value={weight}
              onChange={(e) => setWeight(parseFloat(e.target.value) || 0.01)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Largura (cm)</Label>
            <Input
              type="number" min="1" value={width}
              onChange={(e) => setWidth(parseInt(e.target.value) || 1)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Altura (cm)</Label>
            <Input
              type="number" min="1" value={height}
              onChange={(e) => setHeight(parseInt(e.target.value) || 1)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Comprimento (cm)</Label>
            <Input
              type="number" min="1" value={length}
              onChange={(e) => setLength(parseInt(e.target.value) || 1)}
            />
          </div>
        </div>

        <div className="flex items-end gap-3">
          <div className="space-y-1.5 w-48">
            <Label className="text-xs">Valor segurado (R$)</Label>
            <Input
              type="number" min="0" step="0.01" value={insuranceValue || ''}
              onChange={(e) => setInsuranceValue(parseFloat(e.target.value) || 0)}
              placeholder="0,00"
            />
          </div>
          <Button onClick={handleCalculate} disabled={isLoading}>
            {isLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Calculando...</>
            ) : (
              <><Search className="h-4 w-4 mr-2" /> Cotar Frete</>
            )}
          </Button>
        </div>

        {address && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{address}</span>
          </div>
        )}

        {services && services.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhuma opção de frete disponível para este CEP.
          </p>
        )}

        {services && services.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">{services.length} opções encontradas:</p>
            <div className="space-y-2">
              {services.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${
                    selectedService?.id === s.id
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedService(s)}
                >
                  <div className="flex items-center gap-3">
                    {s.company.picture && (
                      <img src={s.company.picture} alt={s.company.name} className="h-7 w-auto object-contain" />
                    )}
                    <div>
                      <div className="font-medium text-sm flex items-center gap-2">
                        {s.company.name} - {s.name}
                        {selectedService?.id === s.id && (
                          <Badge variant="default" className="text-[10px] px-1.5 py-0">Selecionado</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <Package className="h-3 w-3" /> {daysText(s)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold">{formatPrice(s.price)}</span>
                    {s.discount > 0 && (
                      <p className="text-[10px] text-green-600">-{formatPrice(s.discount)} desc.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {showGenerateLabel && selectedService && (
              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={() => handleGenerateLabel(selectedService)}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Gerando etiqueta...</>
                  ) : (
                    <><Printer className="h-4 w-4 mr-2" /> Gerar Etiqueta — {formatPrice(selectedService.price)}</>
                  )}
                </Button>
              </div>
            )}

            {!showGenerateLabel && (
              <p className="text-sm text-muted-foreground pt-2">
                A etiqueta deve ser gerada a partir de um pedido com os dados completos do destinatário.
              </p>
            )}

            {showGenerateLabel && labelUrl && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">Etiqueta gerada!</p>
                  <a href={labelUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-green-600 hover:underline">
                    Abrir etiqueta para impressão →
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminShippingQuote;
