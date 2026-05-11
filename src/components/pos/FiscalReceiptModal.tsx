import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  FileText,
  Receipt,
  SkipForward,
  Loader2,
  MapPin,
  CheckCircle2,
  User,
  Building2,
  Printer,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FiscalCustomerData {
  name?: string;
  document?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
}

interface FiscalReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleId: string | null;
  customerData?: FiscalCustomerData | null;
  total: number;
  onComplete: () => void;
}

const FiscalReceiptModal = ({
  open,
  onOpenChange,
  saleId,
  customerData,
  total,
  onComplete,
}: FiscalReceiptModalProps) => {
  const [step, setStep] = useState<'choose' | 'form' | 'success'>('choose');
  const [fiscalType, setFiscalType] = useState<'nfce' | 'nfe'>('nfce');
  const [isSaving, setIsSaving] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isLoadingCep, setIsLoadingCep] = useState(false);

  const [formData, setFormData] = useState({
    document: '',
    name: '',
    email: '',
    phone: '',
    zip_code: '',
    address: '',
    city: '',
    state: '',
  });

  // Pre-fill from customer data
  useEffect(() => {
    if (open && customerData) {
      setFormData({
        document: customerData.document || '',
        name: customerData.name || '',
        email: customerData.email || '',
        phone: customerData.phone || '',
        zip_code: customerData.zip_code || '',
        address: customerData.address || '',
        city: customerData.city || '',
        state: customerData.state || '',
      });
    }
  }, [open, customerData]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep('choose');
      setFiscalType('nfce');
      setFormData({ document: '', name: '', email: '', phone: '', zip_code: '', address: '', city: '', state: '' });
    }
  }, [open]);

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCepChange = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    const formatted = cleanCep.length > 5 ? `${cleanCep.slice(0, 5)}-${cleanCep.slice(5, 8)}` : cleanCep;
    updateField('zip_code', formatted);

    if (cleanCep.length === 8) {
      setIsLoadingCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setFormData((prev) => ({
            ...prev,
            address: data.logradouro || prev.address,
            city: data.localidade || prev.city,
            state: data.uf || prev.state,
          }));
        }
      } catch {
        // silent
      } finally {
        setIsLoadingCep(false);
      }
    }
  };

  const handleSubmit = async () => {
    if (!formData.document.trim()) {
      toast.error(fiscalType === 'nfce' ? 'CPF/CNPJ é obrigatório para o cupom fiscal' : 'CPF/CNPJ é obrigatório para a nota fiscal');
      return;
    }

    if (fiscalType === 'nfe') {
      if (!formData.name.trim()) {
        toast.error('Nome/Razão Social é obrigatório para NF-e');
        return;
      }
      if (!formData.address.trim() || !formData.city.trim() || !formData.state.trim()) {
        toast.error('Endereço completo é obrigatório para NF-e');
        return;
      }
    }

    setIsSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase.from('fiscal_requests').insert({
        sale_id: saleId,
        fiscal_type: fiscalType,
        customer_name: formData.name.trim() || null,
        customer_document: formData.document.trim(),
        customer_email: formData.email.trim() || null,
        customer_phone: formData.phone.trim() || null,
        requested_by: userData?.user?.id || null,
        metadata: { total },
        customer_address: fiscalType === 'nfe' ? {
          address: formData.address.trim(),
          city: formData.city.trim(),
          state: formData.state.trim(),
          zip_code: formData.zip_code.trim(),
        } : null,
      });

      if (error) throw error;

      setStep('success');
      toast.success(
        fiscalType === 'nfce'
          ? 'Cupom fiscal solicitado com sucesso!'
          : 'Nota fiscal solicitada com sucesso!'
      );
    } catch (error) {
      console.error('Erro ao solicitar documento fiscal:', error);
      toast.error('Erro ao solicitar documento fiscal');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    onOpenChange(false);
    onComplete();
  };

  const handleDone = () => {
    onOpenChange(false);
    onComplete();
  };

  const handlePrintOrder = async () => {
    if (!saleId) {
      toast.error('Venda não encontrada');
      return;
    }
    setIsPrinting(true);
    try {
      const { data: sale, error } = await supabase
        .from('pos_sales')
        .select('*')
        .eq('id', saleId)
        .single();
      if (error || !sale) throw error || new Error('Venda não encontrada');

      let store: any = {};
      if ((sale as any).store_id) {
        const { data: storeData } = await supabase
          .from('stores')
          .select('name, address, city, state, phone')
          .eq('id', (sale as any).store_id)
          .maybeSingle();
        if (storeData) store = storeData;
      }

      const items = Array.isArray(sale.items) ? sale.items : [];
      const fmt = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const paymentLabels: Record<string, string> = {
        cash: 'Dinheiro', card: 'Cartão', pix: 'PIX', boleto: 'Boleto', cheque: 'Cheque', mixed: 'Misto', credit: 'Crediário',
      };
      const pd: any = sale.payment_details || {};
      let paymentDetail = '';
      if (sale.payment_method === 'card' && pd) {
        const label = pd.cardType === 'credit' ? 'Crédito' : 'Débito';
        const inst = pd.installments || 1;
        paymentDetail = `${label}${inst > 1 ? ` - ${inst}x de ${fmt(sale.total / inst)}` : ' - À vista'}`;
      } else if (sale.payment_method === 'mixed' && pd) {
        const parts: string[] = [];
        if (pd.cash > 0) parts.push(`Dinheiro: ${fmt(pd.cash)}`);
        if (pd.card > 0) parts.push(`Cartão: ${fmt(pd.card)}`);
        if (pd.pix > 0) parts.push(`PIX: ${fmt(pd.pix)}`);
        if (pd.boleto > 0) parts.push(`Boleto: ${fmt(pd.boleto)}`);
        if (pd.cheque > 0) parts.push(`Cheque: ${fmt(pd.cheque)}`);
        paymentDetail = parts.join(' | ');
      }

      
      const win = window.open('', '_blank', 'width=400,height=600');
      if (!win) {
        toast.error('Permita pop-ups para imprimir');
        setIsPrinting(false);
        return;
      }
      const dateStr = format(new Date(sale.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
      const fullSaleId = String(sale.id);
      const shortSaleId = fullSaleId.slice(0, 8).toUpperCase();
      const trackingUrl = `${window.location.origin}/rastrear-pedido?order=${encodeURIComponent(fullSaleId)}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(trackingUrl)}`;
      win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pedido #${shortSaleId}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;padding:24px;color:#1a1a1a;font-size:13px;max-width:380px;margin:0 auto}
  .header{text-align:center;margin-bottom:16px;border-bottom:2px solid #1a1a1a;padding-bottom:12px}
  .header h1{font-size:18px;font-weight:700}
  .header h2{font-size:14px;font-weight:600;margin-top:4px}
  .header p{font-size:11px;color:#666;margin-top:4px}
  .section{margin-bottom:12px}
  .section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#666;margin-bottom:6px;border-bottom:1px solid #ddd;padding-bottom:3px}
  .info-row{display:flex;justify-content:space-between;margin-bottom:3px}
  .info-label{color:#666}
  .item{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px dotted #ddd}
  .item-name{flex:1}
  .item-qty{width:40px;text-align:center;color:#666}
  .item-price{width:80px;text-align:right;font-weight:600}
  .totals{margin-top:12px;border-top:2px solid #1a1a1a;padding-top:8px}
  .total-row{display:flex;justify-content:space-between;margin-bottom:3px}
  .total-final{font-size:16px;font-weight:700;margin-top:6px;padding-top:6px;border-top:1px solid #ddd}
  .discount{color:#dc2626}
  .order-id-section{text-align:center;margin:12px 0;padding:10px;border:1px dashed #bbb;border-radius:6px;background:#fafafa}
  .order-id-section .id-label{font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:#888;margin-bottom:4px}
  .order-id-section .id-value{font-size:15px;font-weight:700;word-break:break-all}
  .qr-section{text-align:center;margin:14px 0;padding:12px;border:1px solid #ddd;border-radius:6px}
  .qr-section img{width:130px;height:130px}
  .qr-section .qr-label{font-size:10px;color:#888;margin-top:6px;text-transform:uppercase;letter-spacing:.5px}
  .qr-section .qr-url{font-size:10px;color:#555;word-break:break-all;margin-top:2px}
  .footer{text-align:center;margin-top:20px;font-size:10px;color:#999;border-top:1px solid #ddd;padding-top:8px}
  @media print{body{padding:12px}}
</style></head><body>
  <div class="header">
    ${store.name ? `<h1>${store.name}</h1>` : ''}
    <h2>PEDIDO DE VENDA</h2>
    <p>#${shortSaleId} &bull; ${dateStr}</p>
    ${store.address ? `<p>${store.address}${store.city ? ' - ' + store.city : ''}${store.state ? '/' + store.state : ''}</p>` : ''}
    ${store.phone ? `<p>${store.phone}</p>` : ''}
  </div>
  <div class="order-id-section">
    <div class="id-label">Código do Pedido</div>
    <div class="id-value">${fullSaleId.toUpperCase()}</div>
  </div>
  ${sale.customer_name ? `<div class="section">
    <div class="section-title">Cliente</div>
    <div class="info-row"><span>${sale.customer_name}</span></div>
    ${sale.customer_document ? `<div class="info-row"><span class="info-label">${sale.customer_document}</span></div>` : ''}
  </div>` : ''}
  <div class="section">
    <div class="section-title">Itens</div>
    ${items.map((it: any) => `<div class="item">
      <div class="item-name">${it.name || 'Produto'}${it.variation_label ? ` <span style="font-size:10px;color:#999">(${it.variation_label})</span>` : ''}${it.sku ? `<br><span style="font-size:10px;color:#999">SKU: ${it.sku}</span>` : ''}</div>
      <div class="item-qty">${it.quantity || 1}x</div>
      <div class="item-price">${fmt(it.total ?? (it.unit_price * (it.quantity || 1)))}</div>
    </div>`).join('')}
  </div>
  <div class="totals">
    <div class="total-row"><span>Subtotal</span><span>${fmt(sale.subtotal)}</span></div>
    ${sale.discount_amount > 0 ? `<div class="total-row discount"><span>Desconto</span><span>-${fmt(sale.discount_amount)}</span></div>` : ''}
    <div class="total-row total-final"><span>TOTAL</span><span>${fmt(sale.total)}</span></div>
  </div>
  <div class="section" style="margin-top:12px">
    <div class="section-title">Forma de Pagamento</div>
    <div class="info-row"><span>${paymentLabels[sale.payment_method] || sale.payment_method}</span></div>
    ${paymentDetail ? `<div class="info-row"><span class="info-label">${paymentDetail}</span></div>` : ''}
    ${sale.amount_received ? `<div class="info-row"><span class="info-label">Recebido</span><span>${fmt(sale.amount_received)}</span></div>` : ''}
    ${sale.change_amount > 0 ? `<div class="info-row"><span class="info-label">Troco</span><span>${fmt(sale.change_amount)}</span></div>` : ''}
  </div>
  ${sale.notes ? `<div class="section"><div class="section-title">Observações</div><p>${sale.notes}</p></div>` : ''}
  <div class="qr-section">
    <img src="${qrUrl}" alt="QR Code do pedido" />
    <div class="qr-label">Acompanhe seu pedido</div>
    <div class="qr-url">${trackingUrl}</div>
  </div>
  <div class="footer">Este documento não tem valor fiscal<br>Obrigado pela preferência!</div>
</body></html>`);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 300);
    } catch (e) {
      console.error('Erro ao imprimir pedido:', e);
      toast.error('Erro ao gerar impressão do pedido');
    } finally {
      setIsPrinting(false);
    }
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {step === 'choose' && 'Emissão Fiscal'}
            {step === 'form' && (fiscalType === 'nfce' ? 'Cupom Fiscal (NFC-e)' : 'Nota Fiscal (NF-e)')}
            {step === 'success' && 'Documento Solicitado'}
          </DialogTitle>
          {step === 'choose' && (
            <DialogDescription>
              Venda de {formatCurrency(total)} finalizada. Deseja emitir documento fiscal?
            </DialogDescription>
          )}
        </DialogHeader>

        {step === 'choose' && (
          <div className="space-y-3 py-2">
            <Button
              variant="outline"
              className="w-full h-auto py-4 flex items-start gap-4 text-left"
              onClick={() => {
                setFiscalType('nfce');
                setStep('form');
              }}
            >
              <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                <Receipt className="h-6 w-6" />
              </div>
              <div>
                <div className="font-semibold">Cupom Fiscal (NFC-e)</div>
                <div className="text-sm text-muted-foreground font-normal">
                  Para consumidor final. Requer apenas CPF/CNPJ.
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full h-auto py-4 flex items-start gap-4 text-left"
              onClick={() => {
                setFiscalType('nfe');
                setStep('form');
              }}
            >
              <div className="p-2 rounded-lg bg-accent text-accent-foreground shrink-0">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <div className="font-semibold">Nota Fiscal (NF-e)</div>
                <div className="text-sm text-muted-foreground font-normal">
                  Documento completo. Requer CPF/CNPJ e endereço.
                </div>
              </div>
            </Button>

            <Separator />

            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handlePrintOrder}
              disabled={isPrinting || !saleId}
            >
              {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              Imprimir Pedido de Venda
            </Button>

            <Button variant="ghost" className="w-full gap-2 text-muted-foreground" onClick={handleSkip}>
              <SkipForward className="h-4 w-4" /> Pular - Sem documento fiscal
            </Button>
          </div>
        )}

        {step === 'form' && (
          <>
            <ScrollArea className="flex-1 pr-2" style={{ maxHeight: 'calc(90vh - 200px)' }}>
              <div className="space-y-4 py-2">
                {/* Document */}
                <div>
                  <Label className="text-sm font-medium">CPF/CNPJ *</Label>
                  <Input
                    placeholder={fiscalType === 'nfce' ? '000.000.000-00 ou 00.000.000/0000-00' : 'CPF ou CNPJ'}
                    value={formData.document}
                    onChange={(e) => updateField('document', e.target.value)}
                    autoFocus
                  />
                </div>

                {/* Name */}
                <div>
                  <Label className="text-sm font-medium">
                    {fiscalType === 'nfe' ? 'Nome / Razão Social *' : 'Nome (opcional)'}
                  </Label>
                  <Input
                    placeholder="Nome completo ou razão social"
                    value={formData.name}
                    onChange={(e) => updateField('name', e.target.value)}
                  />
                </div>

                {/* Email */}
                <div>
                  <Label className="text-sm font-medium">E-mail (envio do documento)</Label>
                  <Input
                    placeholder="email@exemplo.com"
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateField('email', e.target.value)}
                  />
                </div>

                {fiscalType === 'nfe' && (
                  <>
                    <Separator />
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> Endereço do Destinatário *
                      </Label>
                    </div>

                    <div>
                      <Label className="text-sm">CEP</Label>
                      <div className="relative">
                        <Input
                          placeholder="00000-000"
                          value={formData.zip_code}
                          onChange={(e) => handleCepChange(e.target.value)}
                          maxLength={9}
                        />
                        {isLoadingCep && (
                          <Loader2 className="h-4 w-4 animate-spin absolute right-3 top-3 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm">Endereço *</Label>
                      <Input
                        placeholder="Rua, número, complemento"
                        value={formData.address}
                        onChange={(e) => updateField('address', e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <Label className="text-sm">Cidade *</Label>
                        <Input
                          placeholder="Cidade"
                          value={formData.city}
                          onChange={(e) => updateField('city', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-sm">UF *</Label>
                        <Input
                          placeholder="UF"
                          value={formData.state}
                          onChange={(e) => updateField('state', e.target.value)}
                          maxLength={2}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>

            <div className="pt-4 border-t flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep('choose')}>
                Voltar
              </Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : fiscalType === 'nfce' ? (
                  <Receipt className="h-4 w-4 mr-2" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Solicitar {fiscalType === 'nfce' ? 'Cupom' : 'Nota'}
              </Button>
            </div>
          </>
        )}

        {step === 'success' && (
          <div className="py-6 flex flex-col items-center gap-4 text-center">
            <div className="p-3 rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">
                {fiscalType === 'nfce' ? 'Cupom Fiscal' : 'Nota Fiscal'} solicitado!
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                O documento será emitido assim que a integração fiscal estiver configurada.
                {formData.email && ` Uma cópia será enviada para ${formData.email}.`}
              </p>
            </div>
            <Button className="w-full" onClick={handleDone}>
              Concluir
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default FiscalReceiptModal;
