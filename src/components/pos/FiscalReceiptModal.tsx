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
} from 'lucide-react';

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
