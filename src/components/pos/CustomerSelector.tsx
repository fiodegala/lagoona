import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { User, X, Phone, FileText, UserPlus, ArrowLeft, Loader2, Building2, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
}

interface CustomerSelectorProps {
  selectedCustomer: Customer | null;
  onSelectCustomer: (customer: Customer | null) => void;
}

const emptyForm = {
  customer_type: 'pf' as 'pf' | 'pj',
  name: '',
  phone: '',
  document: '',
  email: '',
  birthday: '',
  // Address fields
  zip_code: '',
  address: '',
  city: '',
  state: '',
  // PJ fields
  razao_social: '',
  nome_fantasia: '',
  inscricao_estadual: '',
  inscricao_municipal: '',
  responsavel_nome: '',
  responsavel_telefone: '',
};

const CustomerSelector = ({ selectedCustomer, onSelectCustomer }: CustomerSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  useEffect(() => {
    const fetchCustomers = async () => {
      setIsLoading(true);
      try {
        let query = supabase
          .from('customers')
          .select('id, name, email, phone, document')
          .eq('is_active', true)
          .order('name', { ascending: true })
          .limit(50);

        if (searchQuery.trim()) {
          const term = `%${searchQuery.trim()}%`;
          query = query.or(`name.ilike.${term},phone.ilike.${term},document.ilike.${term},email.ilike.${term}`);
        }

        const { data, error } = await query;
        if (error) throw error;
        setCustomers(data || []);
      } catch (error) {
        console.error('Erro ao carregar clientes:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (open && !showForm) {
      const debounce = setTimeout(fetchCustomers, 300);
      return () => clearTimeout(debounce);
    }
  }, [open, showForm, searchQuery]);

  const handleSelect = (customer: Customer) => {
    onSelectCustomer(customer);
    setOpen(false);
    setSearchQuery('');
    setShowForm(false);
  };

  const handleClear = () => {
    onSelectCustomer(null);
  };

  const handleOpenForm = () => {
    setFormData({ ...emptyForm, name: searchQuery || '' });
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setFormData({ ...emptyForm });
  };

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
          setFormData(prev => ({
            ...prev,
            address: data.logradouro || '',
            city: data.localidade || '',
            state: data.uf || '',
          }));
        }
      } catch {
        // silent
      } finally {
        setIsLoadingCep(false);
      }
    }
  };

  const handleSaveCustomer = async () => {
    const isPJ = formData.customer_type === 'pj';

    if (isPJ && !formData.razao_social.trim()) {
      toast.error('Razão Social é obrigatória para PJ');
      return;
    }
    if (!isPJ && !formData.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    setIsSaving(true);
    try {
      const insertData = {
        customer_type: formData.customer_type,
        name: isPJ ? formData.razao_social.trim() : formData.name.trim(),
        phone: formData.phone.trim() || null,
        document: formData.document.trim() || null,
        email: formData.email.trim() || null,
        birthday: formData.birthday || null,
        zip_code: formData.zip_code.trim() || null,
        address: formData.address.trim() || null,
        city: formData.city.trim() || null,
        state: formData.state.trim() || null,
        razao_social: isPJ ? formData.razao_social.trim() : null,
        nome_fantasia: isPJ ? (formData.nome_fantasia.trim() || null) : null,
        inscricao_estadual: isPJ ? (formData.inscricao_estadual.trim() || null) : null,
        inscricao_municipal: isPJ ? (formData.inscricao_municipal.trim() || null) : null,
        responsavel_nome: isPJ ? (formData.responsavel_nome.trim() || null) : null,
        responsavel_telefone: isPJ ? (formData.responsavel_telefone.trim() || null) : null,
      };

      const { data, error } = await supabase
        .from('customers')
        .insert(insertData)
        .select('id, name, email, phone, document')
        .single();

      if (error) throw error;

      toast.success('Cliente cadastrado!');
      handleSelect(data);
    } catch (error: any) {
      console.error('Erro ao cadastrar cliente:', error);
      toast.error('Erro ao cadastrar cliente');
    } finally {
      setIsSaving(false);
    }
  };

  if (selectedCustomer) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-md border border-primary/20">
        <User className="h-4 w-4 text-primary" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{selectedCustomer.name}</div>
          {(selectedCustomer.phone || selectedCustomer.document) && (
            <div className="text-xs text-muted-foreground truncate">
              {selectedCustomer.phone || selectedCustomer.document}
            </div>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleClear}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) handleCloseForm(); }}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start gap-2 text-muted-foreground">
          <User className="h-4 w-4" />
          <span>Selecionar cliente</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0 z-50 max-h-[80vh]" align="start" side="bottom" avoidCollisions>
        {showForm ? (
          <div className="flex flex-col max-h-[70vh]">
            <div className="flex items-center gap-2 p-3 border-b">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCloseForm}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h4 className="font-semibold text-sm">Novo Cliente</h4>
            </div>

            <div className="overflow-y-auto max-h-[55vh] p-4">
              <div className="space-y-4">
                {/* Tipo de pessoa */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Tipo de Pessoa</Label>
                  <RadioGroup
                    value={formData.customer_type}
                    onValueChange={(v) => updateField('customer_type', v)}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="pf" id="pf" />
                      <Label htmlFor="pf" className="cursor-pointer font-normal flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" /> Pessoa Física
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="pj" id="pj" />
                      <Label htmlFor="pj" className="cursor-pointer font-normal flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5" /> Pessoa Jurídica
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {formData.customer_type === 'pf' ? (
                  /* ---- PESSOA FÍSICA ---- */
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Nome Completo *</Label>
                      <Input
                        placeholder="Nome completo"
                        value={formData.name}
                        onChange={(e) => updateField('name', e.target.value)}
                        autoFocus
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">CPF</Label>
                      <Input
                        placeholder="000.000.000-00"
                        value={formData.document}
                        onChange={(e) => updateField('document', e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Data de Nascimento</Label>
                      <Input
                        type="date"
                        value={formData.birthday}
                        onChange={(e) => updateField('birthday', e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Telefone</Label>
                      <Input
                        placeholder="(00) 00000-0000"
                        value={formData.phone}
                        onChange={(e) => updateField('phone', e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">E-mail</Label>
                      <Input
                        placeholder="email@exemplo.com"
                        type="email"
                        value={formData.email}
                        onChange={(e) => updateField('email', e.target.value)}
                        className="h-9"
                      />
                    </div>
                    {/* Endereço */}
                    <div className="pt-2 border-t">
                      <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> Endereço
                      </Label>
                    </div>
                    <div>
                      <Label className="text-xs">CEP</Label>
                      <div className="relative">
                        <Input
                          placeholder="00000-000"
                          value={formData.zip_code}
                          onChange={(e) => handleCepChange(e.target.value)}
                          maxLength={9}
                          className="h-9"
                        />
                        {isLoadingCep && <Loader2 className="h-3.5 w-3.5 animate-spin absolute right-2.5 top-2.5 text-muted-foreground" />}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Endereço</Label>
                      <Input
                        placeholder="Rua, número, complemento"
                        value={formData.address}
                        onChange={(e) => updateField('address', e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <Label className="text-xs">Cidade</Label>
                        <Input
                          placeholder="Cidade"
                          value={formData.city}
                          onChange={(e) => updateField('city', e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">UF</Label>
                        <Input
                          placeholder="UF"
                          value={formData.state}
                          onChange={(e) => updateField('state', e.target.value)}
                          maxLength={2}
                          className="h-9"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ---- PESSOA JURÍDICA ---- */
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Razão Social *</Label>
                      <Input
                        placeholder="Razão Social da empresa"
                        value={formData.razao_social}
                        onChange={(e) => updateField('razao_social', e.target.value)}
                        autoFocus
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Nome Fantasia</Label>
                      <Input
                        placeholder="Nome fantasia"
                        value={formData.nome_fantasia}
                        onChange={(e) => updateField('nome_fantasia', e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">CNPJ</Label>
                      <Input
                        placeholder="00.000.000/0000-00"
                        value={formData.document}
                        onChange={(e) => updateField('document', e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Inscrição Estadual</Label>
                      <Input
                        placeholder="Inscrição estadual"
                        value={formData.inscricao_estadual}
                        onChange={(e) => updateField('inscricao_estadual', e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Inscrição Municipal</Label>
                      <Input
                        placeholder="Inscrição municipal"
                        value={formData.inscricao_municipal}
                        onChange={(e) => updateField('inscricao_municipal', e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">E-mail da Empresa</Label>
                      <Input
                        placeholder="contato@empresa.com"
                        type="email"
                        value={formData.email}
                        onChange={(e) => updateField('email', e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Telefone da Empresa</Label>
                      <Input
                        placeholder="(00) 0000-0000"
                        value={formData.phone}
                        onChange={(e) => updateField('phone', e.target.value)}
                        className="h-9"
                      />
                    </div>
                    {/* Endereço */}
                    <div className="pt-2 border-t">
                      <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> Endereço
                      </Label>
                    </div>
                    <div>
                      <Label className="text-xs">CEP</Label>
                      <div className="relative">
                        <Input
                          placeholder="00000-000"
                          value={formData.zip_code}
                          onChange={(e) => handleCepChange(e.target.value)}
                          maxLength={9}
                          className="h-9"
                        />
                        {isLoadingCep && <Loader2 className="h-3.5 w-3.5 animate-spin absolute right-2.5 top-2.5 text-muted-foreground" />}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Endereço</Label>
                      <Input
                        placeholder="Rua, número, complemento"
                        value={formData.address}
                        onChange={(e) => updateField('address', e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <Label className="text-xs">Cidade</Label>
                        <Input
                          placeholder="Cidade"
                          value={formData.city}
                          onChange={(e) => updateField('city', e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">UF</Label>
                        <Input
                          placeholder="UF"
                          value={formData.state}
                          onChange={(e) => updateField('state', e.target.value)}
                          maxLength={2}
                          className="h-9"
                        />
                      </div>
                    </div>
                    <div className="pt-2 border-t">
                      <Label className="text-xs font-medium text-muted-foreground">Responsável</Label>
                    </div>
                    <div>
                      <Label className="text-xs">Nome do Responsável</Label>
                      <Input
                        placeholder="Nome do responsável"
                        value={formData.responsavel_nome}
                        onChange={(e) => updateField('responsavel_nome', e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Telefone do Responsável</Label>
                      <Input
                        placeholder="(00) 00000-0000"
                        value={formData.responsavel_telefone}
                        onChange={(e) => updateField('responsavel_telefone', e.target.value)}
                        className="h-9"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 border-t">
              <Button className="w-full" onClick={handleSaveCustomer} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Salvando...
                  </>
                ) : (
                  'Cadastrar e Selecionar'
                )}
              </Button>
            </div>
          </div>
        ) : (
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Buscar por nome, telefone, CPF..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              <CommandEmpty>
                {isLoading ? 'Carregando...' : 'Nenhum cliente encontrado.'}
              </CommandEmpty>
              <CommandGroup>
                {filteredCustomers.map((customer) => (
                  <CommandItem
                    key={customer.id}
                    value={customer.id}
                    onSelect={() => handleSelect(customer)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-start gap-3 w-full">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{customer.name}</div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {customer.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {customer.phone}
                            </span>
                          )}
                          {customer.document && (
                            <span className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {customer.document}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            <div className="p-2 border-t">
              <Button variant="outline" className="w-full gap-2" size="sm" onClick={handleOpenForm}>
                <UserPlus className="h-4 w-4" />
                Cadastrar novo cliente
              </Button>
            </div>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default CustomerSelector;
