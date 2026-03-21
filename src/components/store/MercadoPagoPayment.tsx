import { useState, useEffect, useCallback, useRef } from 'react';
import { CreditCard, QrCode, Barcode, Loader2, Copy, Check, ExternalLink, Percent } from 'lucide-react';
import CreditCardMockup from './CreditCardMockup';
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

const formatPrice = (price: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);

// Load MercadoPago SDK script
const loadMPScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if ((window as any).MercadoPago) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://sdk.mercadopago.com/js/v2';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load MercadoPago SDK'));
    document.head.appendChild(script);
  });
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
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState('');
  const mpInstanceRef = useRef<any>(null);
  const cardFormRef = useRef<any>(null);
  const cardFormMountedRef = useRef(false);
  const tokenResolveRef = useRef<((token: string) => void) | null>(null);
  const tokenRejectRef = useRef<((err: any) => void) | null>(null);

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

  // Card state (for doc only, rest handled by SDK)
  const [docNumber, setDocNumber] = useState('');
  const [installments, setInstallments] = useState('1');

  // Card mockup state
  const [cardDisplayNumber, setCardDisplayNumber] = useState('');
  const [cardDisplayName, setCardDisplayName] = useState('');
  const [cardDisplayExpiry, setCardDisplayExpiry] = useState('');
  const [cardBrand, setCardBrand] = useState('');
  const [isCardFlipped, setIsCardFlipped] = useState(false);

  // PIX discount
  const PIX_DISCOUNT_PERCENT = 5;
  const pixDiscountAmount = Math.round(amount * PIX_DISCOUNT_PERCENT) / 100;
  const pixAmount = Math.round((amount - pixDiscountAmount) * 100) / 100;
  // Initialize MercadoPago SDK
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('mercadopago-payment', {
          body: { action: 'get_public_key' },
        });
        if (error || !data?.public_key) throw new Error('Não foi possível obter a chave pública');

        await loadMPScript();
        if (cancelled) return;

        const mp = new (window as any).MercadoPago(data.public_key, { locale: 'pt-BR' });
        mpInstanceRef.current = mp;
        setSdkReady(true);
      } catch (err: any) {
        if (!cancelled) {
          console.error('MP SDK init error:', err);
          setSdkError(err.message || 'Erro ao inicializar SDK');
        }
      }
    };
    init();
    return () => { cancelled = true; };
  }, []);

  // Mount CardForm when tab switches to credit_card and SDK is ready
  useEffect(() => {
    if (activeTab !== 'credit_card' || !sdkReady || !mpInstanceRef.current) return;

    // Reset mounted flag when re-entering the tab (DOM elements may have been destroyed)
    // Check if the container still has an iframe; if not, we need to remount
    const container = document.getElementById('mp-card-number');
    if (cardFormMountedRef.current && container && container.querySelector('iframe')) {
      return; // Already mounted and iframe still exists
    }

    // Cleanup previous card form if any
    if (cardFormRef.current) {
      try {
        cardFormRef.current.unmount();
      } catch {
        // silent
      }
      cardFormRef.current = null;
      cardFormMountedRef.current = false;
    }

    // Small delay to ensure DOM elements exist
    const timeout = setTimeout(() => {
      try {
        // Verify DOM elements exist before mounting
        const requiredIds = ['mp-card-form', 'mp-card-number', 'mp-expiration-date', 'mp-security-code', 'mp-cardholder-name', 'mp-installments', 'mp-identification-number', 'mp-identification-type', 'mp-issuer'];
        for (const id of requiredIds) {
          if (!document.getElementById(id)) {
            console.warn(`MP CardForm: element #${id} not found, skipping mount`);
            return;
          }
        }

        const cardForm = mpInstanceRef.current.cardForm({
          amount: String(amount),
          iframe: true,
          form: {
            id: 'mp-card-form',
            cardNumber: { id: 'mp-card-number', placeholder: '0000 0000 0000 0000' },
            expirationDate: { id: 'mp-expiration-date', placeholder: 'MM/AA' },
            securityCode: { id: 'mp-security-code', placeholder: 'CVV' },
            cardholderName: { id: 'mp-cardholder-name', placeholder: 'NOME COMO NO CARTÃO' },
            installments: { id: 'mp-installments' },
            identificationNumber: { id: 'mp-identification-number', placeholder: '000.000.000-00' },
            identificationType: { id: 'mp-identification-type' },
            issuer: { id: 'mp-issuer' },
          },
          callbacks: {
            onFormMounted: (error: any) => {
              if (error) {
                console.error('CardForm mount error:', error);
                return;
              }
              cardFormMountedRef.current = true;

              // Listen to cardholder name input changes
              const nameInput = document.getElementById('mp-cardholder-name') as HTMLInputElement;
              if (nameInput) {
                nameInput.addEventListener('input', (e) => {
                  setCardDisplayName((e.target as HTMLInputElement).value);
                });
                nameInput.addEventListener('focus', () => setIsCardFlipped(false));
              }

              // Flip card on CVV focus, flip back on other fields
              const detectFocusInterval = setInterval(() => {
                try {
                  const activeEl = document.activeElement;
                  if (!activeEl) return;
                  
                  const cvvContainer = document.getElementById('mp-security-code');
                  if (cvvContainer) {
                    const cvvIframe = cvvContainer.querySelector('iframe');
                    if (cvvIframe && (activeEl === cvvIframe || cvvContainer.contains(activeEl))) {
                      setIsCardFlipped(true);
                      return;
                    }
                  }
                  
                  const otherContainers = ['mp-card-number', 'mp-expiration-date'];
                  for (const id of otherContainers) {
                    const container = document.getElementById(id);
                    if (container) {
                      const iframe = container.querySelector('iframe');
                      if (iframe && (activeEl === iframe || container.contains(activeEl))) {
                        setIsCardFlipped(false);
                        return;
                      }
                    }
                  }
                  
                  const nameInput = document.getElementById('mp-cardholder-name');
                  if (activeEl === nameInput) {
                    setIsCardFlipped(false);
                  }
                } catch {
                  // silent
                }
              }, 300);

              const cvvContainer = document.getElementById('mp-security-code');
              if (cvvContainer) {
                cvvContainer.addEventListener('mousedown', () => setIsCardFlipped(true));
              }
              ['mp-card-number', 'mp-expiration-date'].forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                  el.addEventListener('mousedown', () => setIsCardFlipped(false));
                }
              });

              (window as any).__cardFocusInterval = detectFocusInterval;
            },
            onSubmit: async (event: Event) => {
              event.preventDefault();
            },
            onFetching: (resource: string) => {
              return () => {};
            },
            onCardTokenReceived: (error: any, token: any) => {
              if (error) {
                console.warn('CardToken error (callback):', error);
                if (tokenRejectRef.current) {
                  tokenRejectRef.current(error);
                  tokenRejectRef.current = null;
                  tokenResolveRef.current = null;
                }
              } else if (token) {
                if (tokenResolveRef.current) {
                  tokenResolveRef.current(token);
                  tokenResolveRef.current = null;
                  tokenRejectRef.current = null;
                }
              }
            },
            onPaymentMethodsReceived: (error: any, data: any) => {
              if (!error && data && data.length > 0) {
                const method = data[0];
                setCardBrand(method.id || '');
              }
            },
            onBinChange: (bin: string) => {
              if (bin) {
                setCardDisplayNumber(bin.padEnd(16, '•').replace(/(.{4})/g, '$1 ').trim());
                if (bin.startsWith('4')) setCardBrand('visa');
                else if (bin.startsWith('5') || bin.startsWith('2')) setCardBrand('mastercard');
                else if (bin.startsWith('34') || bin.startsWith('37')) setCardBrand('amex');
                else if (bin.startsWith('636368') || bin.startsWith('438935') || bin.startsWith('504175') || bin.startsWith('451416') || bin.startsWith('636297') || bin.startsWith('5067') || bin.startsWith('4576') || bin.startsWith('4011')) setCardBrand('elo');
                else if (bin.startsWith('606282') || bin.startsWith('3841')) setCardBrand('hipercard');
              } else {
                setCardDisplayNumber('');
                setCardBrand('');
              }
            },
            onError: (error: any) => {
              console.error('CardForm error callback:', error);
            },
          },
        });
        cardFormRef.current = cardForm;
      } catch (err) {
        console.error('CardForm init error:', err);
      }
    }, 600);

    return () => {
      clearTimeout(timeout);
      if ((window as any).__cardFocusInterval) {
        clearInterval((window as any).__cardFocusInterval);
        delete (window as any).__cardFocusInterval;
      }
    };
  }, [activeTab, sdkReady, amount]);

  // Poll card form data for brand detection
  useEffect(() => {
    if (activeTab !== 'credit_card' || !cardFormMountedRef.current || !cardFormRef.current) return;

    const interval = setInterval(() => {
      try {
        const data = cardFormRef.current?.getCardFormData?.();
        if (data) {
          if (data.paymentMethodId) setCardBrand(data.paymentMethodId);
        }
      } catch {
        // silent
      }
    }, 800);

    return () => clearInterval(interval);
  }, [activeTab, sdkReady]);

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
          transaction_amount: pixAmount,
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
    if (!docNumber) {
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
            identification: { type: 'CPF', number: docNumber.replace(/\D/g, '') },
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
    e.stopPropagation();
    
    if (!cardFormRef.current) {
      toast.error('SDK de pagamento não está pronto. Aguarde.');
      return;
    }

    setIsProcessing(true);
    try {
      let cardFormData: any;
      try {
        cardFormData = cardFormRef.current.getCardFormData();
      } catch (formErr) {
        console.error('getCardFormData error:', formErr);
        toast.error('Erro ao ler dados do cartão. Preencha todos os campos.');
        setIsProcessing(false);
        return;
      }

      if (!cardFormData || typeof cardFormData !== 'object') {
        toast.error('Preencha todos os dados do cartão.');
        setIsProcessing(false);
        return;
      }

      if (!cardFormData.token) {
        try {
          // Use the SDK's built-in submit to generate the token via onCardTokenReceived callback
          const tokenPromise = new Promise<string>((resolve, reject) => {
            tokenResolveRef.current = resolve;
            tokenRejectRef.current = reject;
            // Timeout after 15s
            setTimeout(() => {
              tokenResolveRef.current = null;
              tokenRejectRef.current = null;
              reject(new Error('Tempo esgotado ao tokenizar o cartão.'));
            }, 15000);
          });

          // Trigger the SDK's internal submit which generates the token
          try {
            const tokenResult = await cardFormRef.current.createCardToken();
            if (tokenResult?.id) {
              cardFormData.token = tokenResult.id;
            }
          } catch {
            // createCardToken may fail; fall back to waiting for the callback
          }

          // If createCardToken didn't set the token, wait for the callback
          if (!cardFormData.token) {
            const token = await tokenPromise;
            cardFormData.token = typeof token === 'string' ? token : (token as any)?.id;
          }

          if (!cardFormData.token) {
            throw new Error('Verifique os dados do cartão e tente novamente.');
          }
        } catch (tokenErr: any) {
          console.error('Token generation error:', tokenErr);
          const msg = tokenErr?.message || 'Verifique os dados do cartão e tente novamente.';
          toast.error(msg);
          setIsProcessing(false);
          return;
        }
      }

      if (!cardFormData.paymentMethodId) {
        toast.error('Não foi possível identificar a bandeira do cartão. Verifique o número.');
        setIsProcessing(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('mercadopago-payment', {
        body: {
          action: 'create_payment',
          payment_method_id: cardFormData.paymentMethodId,
          transaction_amount: amount,
          description,
          order_id: orderId,
          token: cardFormData.token,
          installments: Number(cardFormData.installments) || 1,
          issuer_id: cardFormData.issuerId || undefined,
          payer: {
            email: customerEmail,
            first_name: customerName.split(' ')[0],
            last_name: customerName.split(' ').slice(1).join(' ') || undefined,
            identification: {
              type: cardFormData.identificationType || 'CPF',
              number: (cardFormData.identificationNumber || '').replace(/\D/g, ''),
            },
          },
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      if (data.status === 'approved') {
        onPaymentSuccess(data);
        toast.success('Pagamento aprovado!');
      } else if (data.status === 'in_process' || data.status === 'pending') {
        toast.info('Pagamento em análise. Você receberá uma confirmação em breve.');
        onPaymentSuccess(data);
      } else if (data.status === 'rejected') {
        const rejectionMessages: Record<string, string> = {
          cc_rejected_insufficient_amount: 'Saldo insuficiente no cartão.',
          cc_rejected_bad_filled_security_code: 'Código de segurança inválido.',
          cc_rejected_bad_filled_date: 'Data de validade inválida.',
          cc_rejected_bad_filled_other: 'Verifique os dados do cartão.',
          cc_rejected_high_risk: 'Pagamento recusado por segurança. Tente outro método.',
          cc_rejected_call_for_authorize: 'Autorize o pagamento junto ao seu banco.',
          cc_rejected_card_disabled: 'Cartão desabilitado. Entre em contato com seu banco.',
          cc_rejected_max_attempts: 'Limite de tentativas excedido. Tente outro cartão.',
        };
        const detail = data.status_detail || '';
        const friendlyMsg = rejectionMessages[detail] || `Pagamento recusado: ${detail}`;
        toast.error(friendlyMsg);
      } else {
        throw new Error(`Pagamento ${data.status}: ${data.status_detail}`);
      }
    } catch (err: any) {
      console.error('Card payment error:', err);
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
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Percent className="h-4 w-4 text-emerald-600" />
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                      5% de desconto no PIX!
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Pagamento instantâneo via PIX. O QR Code será gerado após clicar no botão abaixo.
                  </p>
                </div>
                <div className="text-center">
                  <div className="text-sm text-muted-foreground line-through">
                    {formatPrice(amount)}
                  </div>
                  <div className="text-2xl font-bold text-emerald-600">
                    {formatPrice(pixAmount)}
                  </div>
                  <div className="text-xs text-emerald-600 font-medium">
                    Economia de {formatPrice(pixDiscountAmount)}
                  </div>
                </div>
                <Button onClick={handlePixPayment} disabled={isProcessing} className="w-full" size="lg">
                  {isProcessing ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando PIX...</>
                  ) : (
                    `Pagar ${formatPrice(pixAmount)} com PIX`
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
                    <Input value={pixData.qr_code} readOnly className="text-xs font-mono" />
                    <Button variant="outline" size="icon" onClick={copyPixCode}>
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

          {/* Credit Card - SDK Secure Fields */}
          <TabsContent value="credit_card" className="mt-4">
            {sdkError ? (
              <div className="p-4 bg-destructive/10 rounded-lg text-center">
                <p className="text-sm text-destructive">{sdkError}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Tente recarregar a página.
                </p>
              </div>
            ) : !sdkReady ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Carregando formulário seguro...</span>
              </div>
            ) : (
              <form id="mp-card-form" onSubmit={handleCardPayment} className="space-y-4">
                {/* Animated Card Mockup */}
                <CreditCardMockup
                  cardNumber={cardDisplayNumber}
                  cardholderName={cardDisplayName}
                  expirationDate={cardDisplayExpiry}
                  isFlipped={isCardFlipped}
                  brand={cardBrand}
                />

                <div className="space-y-2">
                  <Label>Número do Cartão *</Label>
                  <div
                    id="mp-card-number"
                    className="h-10 border rounded-md bg-background [&>iframe]:!h-full [&>iframe]:!w-full"
                    style={{ minHeight: '40px' }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nome no Cartão *</Label>
                  <input
                    id="mp-cardholder-name"
                    type="text"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Validade *</Label>
                    <div
                      id="mp-expiration-date"
                      className="h-10 border rounded-md bg-background [&>iframe]:!h-full [&>iframe]:!w-full"
                      style={{ minHeight: '40px' }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CVV *</Label>
                    <div
                      id="mp-security-code"
                      className="h-10 border rounded-md bg-background [&>iframe]:!h-full [&>iframe]:!w-full"
                      style={{ minHeight: '40px' }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Tipo de Documento</Label>
                    <select id="mp-identification-type" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label>Documento *</Label>
                    <input
                      id="mp-identification-number"
                      type="text"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Parcelas</Label>
                    <select id="mp-installments" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label>Banco Emissor</Label>
                    <select id="mp-issuer" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                  </div>
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={isProcessing}>
                  {isProcessing ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processando...</>
                  ) : (
                    `Pagar ${formatPrice(amount)}`
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  🔒 Pagamento seguro com tokenização via Mercado Pago
                </p>
              </form>
            )}
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
                    value={docNumber}
                    onChange={(e) => {
                      const val = e.target.value
                        .replace(/\D/g, '')
                        .replace(/(\d{3})(\d)/, '$1.$2')
                        .replace(/(\d{3})(\d)/, '$1.$2')
                        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
                      setDocNumber(val);
                    }}
                    required
                  />
                </div>
                <div className="text-2xl font-bold text-primary text-center">
                  {formatPrice(amount)}
                </div>
                <Button onClick={handleBoletoPayment} disabled={isProcessing} className="w-full" size="lg">
                  {isProcessing ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando Boleto...</>
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
                      <Input value={boletoData.barcode} readOnly className="text-xs font-mono" />
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
