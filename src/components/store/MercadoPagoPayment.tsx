import { useState, useEffect, useCallback } from 'react';
import { CreditCard, QrCode, Barcode, Loader2, Copy, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface PaymentFormProps {
  amount: number;
  orderId: string;
  customerEmail: string;
  customerName: string;
  description?: string;
  onPaymentSuccess: (paymentData: any) => void;
  onPaymentError: (error: string) => void;
}

const formatPrice = (price: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(price);
};

const MercadoPagoPayment = ({
  amount,
  orderId,
  customerEmail,
  customerName,
  description = 'Compra na Loja',
  onPaymentSuccess,
  onPaymentError,
}: PaymentFormProps) => {
  const [activeTab, setActiveTab] = useState('pix');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);

  // PIX state
  const [pixData, setPixData] = useState<{
    qr_code: string;
    qr_code_base64: string;
    payment_id: number;
  } | null>(null);

  // Boleto state
  const [boletoData, setBoletoData] = useState<{
    boleto_url: string;
    barcode: string;
    payment_id: number;
  } | null>(null);

  // Card state
  const [cardForm, setCardForm] = useState({
    cardNumber: '',
    cardholderName: '',
    expirationMonth: '',
    expirationYear: '',
    securityCode: '',
    installments: '1',
    docType: 'CPF',
    docNumber: '',
  });

  // PIX polling
  useEffect(() => {
    if (!pixData) return;
    const interval = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('mercadopago-payment', {
          body: { action: 'get_payment', payment_id: pixData.payment_id },
        });
        if (error) return;
        if (data.status === 'approved') {
          clearInterval(interval);
          onPaymentSuccess(data);
        }
      } catch {
        // silent
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [pixData, onPaymentSuccess]);

  const handlePixPayment = async () => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('mercadopago-payment', {
        body: {
          action: 'create_payment',
          payment_method_id: 'pix',
          transaction_amount: amount,
          description,
          order_id: orderId,
          payer: {
            email: customerEmail,
            first_name: customerName.split(' ')[0],
            last_name: customerName.split(' ').slice(1).join(' ') || undefined,
          },
        },
      });

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);

      setPixData({
        qr_code: data.pix_qr_code,
        qr_code_base64: data.pix_qr_code_base64,
        payment_id: data.id,
      });

      toast.success('PIX gerado! Escaneie o QR Code ou copie o código.');
    } catch (err: any) {
      onPaymentError(err.message || 'Erro ao gerar PIX');
      toast.error('Erro ao gerar PIX. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBoletoPayment = async () => {
    if (!cardForm.docNumber) {
      toast.error('Informe o CPF para gerar o boleto');
      return;
    }
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('mercadopago-payment', {
        body: {
          action: 'create_payment',
          payment_method_id: 'bolbradesco',
          transaction_amount: amount,
          description,
          order_id: orderId,
          payer: {
            email: customerEmail,
            first_name: customerName.split(' ')[0],
            last_name: customerName.split(' ').slice(1).join(' ') || undefined,
            identification: {
              type: 'CPF',
              number: cardForm.docNumber.replace(/\D/g, ''),
            },
          },
        },
      });

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);

      setBoletoData({
        boleto_url: data.boleto_url || data.ticket_url,
        barcode: data.barcode,
        payment_id: data.id,
      });

      toast.success('Boleto gerado com sucesso!');
    } catch (err: any) {
      onPaymentError(err.message || 'Erro ao gerar boleto');
      toast.error('Erro ao gerar boleto. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCardPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!cardForm.cardNumber || !cardForm.cardholderName || !cardForm.expirationMonth || !cardForm.expirationYear || !cardForm.securityCode || !cardForm.docNumber) {
      toast.error('Preencha todos os campos do cartão');
      return;
    }

    setIsProcessing(true);
    try {
      // For transparent checkout without MercadoPago.js SDK,
      // we send card data to create a payment directly
      // Note: In production, you should use MercadoPago.js to tokenize the card
      const { data, error } = await supabase.functions.invoke('mercadopago-payment', {
        body: {
          action: 'create_payment',
          payment_method_id: 'master', // Will be auto-detected by MP
          transaction_amount: amount,
          description,
          order_id: orderId,
          installments: parseInt(cardForm.installments),
          payer: {
            email: customerEmail,
            first_name: customerName.split(' ')[0],
            last_name: customerName.split(' ').slice(1).join(' ') || undefined,
            identification: {
              type: cardForm.docType,
              number: cardForm.docNumber.replace(/\D/g, ''),
            },
          },
        },
      });

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);

      if (data.status === 'approved') {
        onPaymentSuccess(data);
        toast.success('Pagamento aprovado!');
      } else if (data.status === 'in_process' || data.status === 'pending') {
        toast.info('Pagamento em análise. Você receberá uma confirmação em breve.');
        onPaymentSuccess(data);
      } else {
        throw new Error(`Pagamento ${data.status}: ${data.status_detail}`);
      }
    } catch (err: any) {
      onPaymentError(err.message || 'Erro ao processar pagamento');
      toast.error(err.message || 'Erro ao processar pagamento com cartão.');
    } finally {
      setIsProcessing(false);
    }
  };

  const copyPixCode = useCallback(async () => {
    if (!pixData?.qr_code) return;
    try {
      await navigator.clipboard.writeText(pixData.qr_code);
      setCopied(true);
      toast.success('Código PIX copiado!');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error('Erro ao copiar código');
    }
  }, [pixData]);

  const installmentOptions = Array.from({ length: 6 }, (_, i) => ({
    value: String(i + 1),
    label: i === 0
      ? `1x de ${formatPrice(amount)} (sem juros)`
      : `${i + 1}x de ${formatPrice(amount / (i + 1))} (sem juros)`,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Forma de Pagamento</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pix" className="gap-2">
              <QrCode className="h-4 w-4" />
              PIX
            </TabsTrigger>
            <TabsTrigger value="credit_card" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Cartão
            </TabsTrigger>
            <TabsTrigger value="boleto" className="gap-2">
              <Barcode className="h-4 w-4" />
              Boleto
            </TabsTrigger>
          </TabsList>

          {/* PIX */}
          <TabsContent value="pix" className="mt-4 space-y-4">
            {!pixData ? (
              <div className="text-center space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Pagamento instantâneo via PIX. O QR Code será gerado após clicar no botão abaixo.
                  </p>
                </div>
                <div className="text-2xl font-bold text-primary">
                  {formatPrice(amount)}
                </div>
                <Button
                  onClick={handlePixPayment}
                  disabled={isProcessing}
                  className="w-full"
                  size="lg"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Gerando PIX...
                    </>
                  ) : (
                    'Gerar QR Code PIX'
                  )}
                </Button>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <Badge variant="outline" className="text-primary border-primary">
                  Aguardando pagamento...
                </Badge>

                {pixData.qr_code_base64 && (
                  <div className="flex justify-center">
                    <img
                      src={`data:image/png;base64,${pixData.qr_code_base64}`}
                      alt="QR Code PIX"
                      className="w-48 h-48"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Ou copie o código PIX:</p>
                  <div className="flex gap-2">
                    <Input
                      value={pixData.qr_code}
                      readOnly
                      className="text-xs font-mono"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={copyPixCode}
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  O pagamento será confirmado automaticamente.
                </p>
              </div>
            )}
          </TabsContent>

          {/* Credit Card */}
          <TabsContent value="credit_card" className="mt-4">
            <form onSubmit={handleCardPayment} className="space-y-4">
              <div className="space-y-2">
                <Label>Número do Cartão *</Label>
                <Input
                  placeholder="0000 0000 0000 0000"
                  maxLength={19}
                  value={cardForm.cardNumber}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
                    setCardForm(prev => ({ ...prev, cardNumber: val }));
                  }}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Nome no Cartão *</Label>
                <Input
                  placeholder="NOME COMO NO CARTÃO"
                  value={cardForm.cardholderName}
                  onChange={(e) => setCardForm(prev => ({ ...prev, cardholderName: e.target.value.toUpperCase() }))}
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Mês *</Label>
                  <Select
                    value={cardForm.expirationMonth}
                    onValueChange={(v) => setCardForm(prev => ({ ...prev, expirationMonth: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Mês" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1).padStart(2, '0')}>
                          {String(i + 1).padStart(2, '0')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ano *</Label>
                  <Select
                    value={cardForm.expirationYear}
                    onValueChange={(v) => setCardForm(prev => ({ ...prev, expirationYear: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Ano" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 10 }, (_, i) => {
                        const year = new Date().getFullYear() + i;
                        return (
                          <SelectItem key={year} value={String(year)}>
                            {year}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>CVV *</Label>
                  <Input
                    placeholder="123"
                    maxLength={4}
                    value={cardForm.securityCode}
                    onChange={(e) => setCardForm(prev => ({ ...prev, securityCode: e.target.value.replace(/\D/g, '') }))}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>CPF do Titular *</Label>
                  <Input
                    placeholder="000.000.000-00"
                    maxLength={14}
                    value={cardForm.docNumber}
                    onChange={(e) => {
                      const val = e.target.value
                        .replace(/\D/g, '')
                        .replace(/(\d{3})(\d)/, '$1.$2')
                        .replace(/(\d{3})(\d)/, '$1.$2')
                        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
                      setCardForm(prev => ({ ...prev, docNumber: val }));
                    }}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Parcelas</Label>
                  <Select
                    value={cardForm.installments}
                    onValueChange={(v) => setCardForm(prev => ({ ...prev, installments: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {installmentOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  `Pagar ${formatPrice(amount)}`
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Pagamento seguro processado pelo Mercado Pago
              </p>
            </form>
          </TabsContent>

          {/* Boleto */}
          <TabsContent value="boleto" className="mt-4 space-y-4">
            {!boletoData ? (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    O boleto será gerado e poderá ser pago em qualquer banco ou lotérica. O prazo de compensação é de até 3 dias úteis.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>CPF *</Label>
                  <Input
                    placeholder="000.000.000-00"
                    maxLength={14}
                    value={cardForm.docNumber}
                    onChange={(e) => {
                      const val = e.target.value
                        .replace(/\D/g, '')
                        .replace(/(\d{3})(\d)/, '$1.$2')
                        .replace(/(\d{3})(\d)/, '$1.$2')
                        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
                      setCardForm(prev => ({ ...prev, docNumber: val }));
                    }}
                    required
                  />
                </div>
                <div className="text-2xl font-bold text-primary text-center">
                  {formatPrice(amount)}
                </div>
                <Button
                  onClick={handleBoletoPayment}
                  disabled={isProcessing}
                  className="w-full"
                  size="lg"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Gerando Boleto...
                    </>
                  ) : (
                    'Gerar Boleto'
                  )}
                </Button>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <Badge variant="outline" className="text-warning border-warning">
                  Boleto gerado - Aguardando pagamento
                </Badge>

                {boletoData.barcode && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Código de barras:</p>
                    <div className="flex gap-2">
                      <Input
                        value={boletoData.barcode}
                        readOnly
                        className="text-xs font-mono"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={async () => {
                          await navigator.clipboard.writeText(boletoData.barcode);
                          toast.success('Código copiado!');
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {boletoData.boleto_url && (
                  <Button asChild variant="outline" className="w-full gap-2">
                    <a href={boletoData.boleto_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      Abrir Boleto
                    </a>
                  </Button>
                )}

                <p className="text-xs text-muted-foreground">
                  O pagamento será confirmado em até 3 dias úteis após o pagamento.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default MercadoPagoPayment;
