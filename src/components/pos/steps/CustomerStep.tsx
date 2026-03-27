import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  ChevronLeft,
  UserCheck,
  SkipForward,
  RefreshCw,
  User,
  UserPlus,
  Phone,
  FileText,
  Building2,
  MapPin,
  Loader2,
  Search,
} from 'lucide-react';
import { Customer } from '@/components/pos/CustomerSelector';
import { SaleType } from '@/components/pos/ProductSearch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CustomerStepProps {
  selectedCustomer: Customer | null;
  onSelectCustomer: (customer: Customer | null) => void;
  saleType: SaleType;
  onNext: () => void;
  onBack: () => void;
}

const emptyForm = {
  customer_type: 'pf' as 'pf' | 'pj',
  name: '',
  phone: '',
  document: '',
  email: '',
  birthday: '',
  zip_code: '',
  address: '',
  address_number: '',
  address_complement: '',
  neighborhood: '',
  city: '',
  state: '',
  razao_social: '',
  nome_fantasia: '',
  inscricao_estadual: '',
  inscricao_municipal: '',
  responsavel_nome: '',
  responsavel_telefone: '',
  notes: '',
  store_id: '' as string,
  referral_source: '',
};

const CustomerStep = ({ selectedCustomer, onSelectCustomer, saleType, onNext, onBack }: CustomerStepProps) => {
  const isExchange = saleType === 'troca';
  const isColaborador = saleType === 'colaborador';
  const selectionRequired = isExchange || isColaborador;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stores, setStores] = useState<{ id: string; name: string; type: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [isLoadingCep, setIsLoadingCep] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        if (isColaborador) {
          // Fetch collaborators from profiles + user_roles
          let query = supabase
            .from('profiles')
            .select('user_id, full_name, phone, document')
            .order('full_name', { ascending: true })
            .limit(100);

          if (searchQuery.trim()) {
            query = query.ilike('full_name', `%${searchQuery.trim()}%`);
          }

          const { data: profilesData, error: profilesError } = await query;
          if (profilesError) throw profilesError;

          // Get roles for visual info
          const userIds = (profilesData || []).map(p => p.user_id);
          let rolesMap: Record<string, string> = {};
          if (userIds.length > 0) {
            const { data: rolesData } = await supabase
              .from('user_roles')
              .select('user_id, role')
              .in('user_id', userIds);
            rolesData?.forEach(r => { rolesMap[r.user_id] = r.role; });
          }

          const mapped: Customer[] = (profilesData || []).map(p => ({
            id: p.user_id,
            name: p.full_name,
            email: null,
            phone: p.phone || null,
            document: p.document || null,
            _role: rolesMap[p.user_id] || null,
          }));
          setCustomers(mapped);
        } else {
          // Fetch regular customers
          let query = supabase
            .from('customers')
            .select('id, name, email, phone, document')
            .eq('is_active', true)
            .order('name', { ascending: true })
            .limit(searchQuery.trim() ? 50 : 100);

          if (searchQuery.trim()) {
            const term = `%${searchQuery.trim()}%`;
            query = query.or(`name.ilike.${term},email.ilike.${term},phone.ilike.${term},document.ilike.${term}`);
          }

          const { data, error } = await query;
          if (error) throw error;
          setCustomers(data || []);
        }
      } catch (error) {
        console.error('Erro ao carregar:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchStores = async () => {
      try {
        const { data } = await supabase
          .from('stores')
          .select('id, name, type')
          .order('name');
        setStores(data || []);
      } catch (error) {
        console.error('Erro ao carregar lojas:', error);
      }
    };

    const debounce = setTimeout(fetchData, 300);
    if (!isColaborador) fetchStores();

    return () => clearTimeout(debounce);
  }, [searchQuery, isColaborador]);

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = { admin: 'Administrador', manager: 'Gerente', seller: 'Vendedor', support: 'Suporte' };
    return labels[role] || role;
  };

  const filteredCustomers = customers;

  const handleSelect = (customer: Customer) => {
    onSelectCustomer(customer);
    setSearchQuery('');
  };

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
            address: data.logradouro || '',
            neighborhood: data.bairro || '',
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
      toast.error('Nome Completo é obrigatório');
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
        address_number: formData.address_number.trim() || null,
        address_complement: formData.address_complement.trim() || null,
        neighborhood: formData.neighborhood.trim() || null,
        city: formData.city.trim() || null,
        state: formData.state.trim() || null,
        razao_social: isPJ ? formData.razao_social.trim() : null,
        nome_fantasia: isPJ ? (formData.nome_fantasia.trim() || null) : null,
        inscricao_estadual: isPJ ? (formData.inscricao_estadual.trim() || null) : null,
        inscricao_municipal: isPJ ? (formData.inscricao_municipal.trim() || null) : null,
        responsavel_nome: isPJ ? (formData.responsavel_nome.trim() || null) : null,
        responsavel_telefone: isPJ ? (formData.responsavel_telefone.trim() || null) : null,
        notes: formData.notes.trim() || null,
        store_id: formData.store_id || null,
        referral_source: formData.referral_source || null,
      };

      const { data, error } = await supabase
        .from('customers')
        .insert(insertData)
        .select('id, name, email, phone, document')
        .single();

      if (error) throw error;

      toast.success('Cliente cadastrado!');
      setCustomers((prev) => [...prev, data]);
      onSelectCustomer(data);
      setShowRegisterDialog(false);
      setFormData({ ...emptyForm });
    } catch (error) {
      console.error('Erro ao cadastrar cliente:', error);
      toast.error('Erro ao cadastrar cliente');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <h2 className="text-2xl font-bold mb-2">
        {isColaborador ? 'Selecione o Colaborador' : 'Selecione o Cliente'}
      </h2>
      <p className="text-muted-foreground mb-8">
        {isExchange
          ? 'É obrigatório selecionar um cliente para troca'
          : isColaborador
            ? 'Selecione o colaborador que está realizando a compra'
            : 'Vincule um cliente à venda ou pule esta etapa'}
      </p>

      <div className="w-full max-w-md space-y-4">
        {/* Selected customer display */}
        {selectedCustomer ? (
          <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-primary bg-primary/5">
            <div className="p-2 rounded-full bg-primary text-primary-foreground">
              <UserCheck className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="font-semibold">{selectedCustomer.name}</div>
              {selectedCustomer.document && (
                <div className="text-sm text-muted-foreground">{selectedCustomer.document}</div>
              )}
              {selectedCustomer.phone && (
                <div className="text-sm text-muted-foreground">{selectedCustomer.phone}</div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => onSelectCustomer(null)}
            >
              <RefreshCw className="h-4 w-4 mr-1" /> Alterar
            </Button>
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={isColaborador ? "Buscar colaborador por nome..." : "Buscar por nome, CPF, telefone ou e-mail..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12"
                autoFocus
              />
            </div>

            {/* Customer list */}
            <div className="border rounded-xl overflow-hidden">
              <ScrollArea className="max-h-64">
                {isLoading ? (
                  <div className="p-6 flex items-center justify-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
                  </div>
                ) : filteredCustomers.length > 0 ? (
                  <div>
                    {filteredCustomers.map((customer) => (
                      <button
                        key={customer.id}
                        className="w-full text-left px-4 py-3 hover:bg-accent border-b last:border-b-0 flex items-center gap-3 transition-colors"
                        onClick={() => handleSelect(customer)}
                      >
                        <div className="p-1.5 rounded-full bg-muted">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{customer.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            {(customer as any)._role && (
                              <span className="capitalize">{getRoleLabel((customer as any)._role)}</span>
                            )}
                            {customer.document && (
                              <span className="flex items-center gap-1">
                                <FileText className="h-3 w-3" /> {customer.document}
                              </span>
                            )}
                            {customer.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" /> {customer.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    {searchQuery ? 'Nenhum cliente encontrado' : 'Digite para buscar'}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Register button - hide for colaborador */}
            {!isColaborador && (
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => {
                  setFormData({ ...emptyForm, name: searchQuery });
                  setShowRegisterDialog(true);
                }}
              >
                <UserPlus className="h-4 w-4" /> Cadastrar novo cliente
              </Button>
            )}
          </>
        )}

        {selectionRequired && !selectedCustomer && (
          <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
            {isColaborador
              ? '⚠️ Selecione o colaborador para continuar'
              : '⚠️ Selecione um cliente para realizar a troca'}
          </div>
        )}
      </div>

      <div className="flex gap-4 mt-8">
        <Button variant="outline" size="lg" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        {!selectionRequired && !selectedCustomer && (
          <Button variant="ghost" size="lg" onClick={() => { onSelectCustomer(null); onNext(); }}>
            <SkipForward className="h-4 w-4 mr-2" /> Pular
          </Button>
        )}
        <Button size="lg" className="px-12" onClick={onNext} disabled={selectionRequired && !selectedCustomer}>
          Próximo
        </Button>
      </div>

      {/* Register Dialog */}
      <Dialog open={showRegisterDialog} onOpenChange={setShowRegisterDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Cadastrar Novo Cliente</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2" style={{ maxHeight: 'calc(90vh - 140px)' }}>
            <div className="space-y-4 py-2">
              {/* Customer type */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tipo de Pessoa</Label>
                <RadioGroup
                  value={formData.customer_type}
                  onValueChange={(v) => updateField('customer_type', v)}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pf" id="reg-pf" />
                    <Label htmlFor="reg-pf" className="cursor-pointer font-normal flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" /> Pessoa Física
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pj" id="reg-pj" />
                    <Label htmlFor="reg-pj" className="cursor-pointer font-normal flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5" /> Pessoa Jurídica
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Loja de Origem */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> Loja de Origem
                </Label>
                <Select
                  value={formData.store_id || 'none'}
                  onValueChange={(v) => updateField('store_id', v === 'none' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a loja" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Como conheceu a loja */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Como conheceu a loja?</Label>
                <Select
                  value={formData.referral_source || 'none'}
                  onValueChange={(v) => updateField('referral_source', v === 'none' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma opção" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não informado</SelectItem>
                    <SelectItem value="Instagram">Instagram</SelectItem>
                    <SelectItem value="Loja BS">Loja BS</SelectItem>
                    <SelectItem value="Loja 44">Loja 44</SelectItem>
                    <SelectItem value="Site">Site</SelectItem>
                    <SelectItem value="Indicação">Indicação</SelectItem>
                    <SelectItem value="Assessor">Assessor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.customer_type === 'pf' ? (
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm">Nome Completo *</Label>
                    <Input placeholder="Nome completo" value={formData.name} onChange={(e) => updateField('name', e.target.value)} autoFocus />
                  </div>
                  <div>
                    <Label className="text-sm">CPF</Label>
                    <Input placeholder="000.000.000-00" value={formData.document} onChange={(e) => updateField('document', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-sm">Data de Nascimento</Label>
                    <Input type="date" value={formData.birthday} onChange={(e) => updateField('birthday', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-sm">WhatsApp</Label>
                    <Input placeholder="(00) 00000-0000" value={formData.phone} onChange={(e) => updateField('phone', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-sm">E-mail</Label>
                    <Input placeholder="email@exemplo.com" type="email" value={formData.email} onChange={(e) => updateField('email', e.target.value)} />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm">Razão Social *</Label>
                    <Input placeholder="Razão Social" value={formData.razao_social} onChange={(e) => updateField('razao_social', e.target.value)} autoFocus />
                  </div>
                  <div>
                    <Label className="text-sm">Nome Fantasia</Label>
                    <Input placeholder="Nome fantasia" value={formData.nome_fantasia} onChange={(e) => updateField('nome_fantasia', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-sm">CNPJ</Label>
                    <Input placeholder="00.000.000/0000-00" value={formData.document} onChange={(e) => updateField('document', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-sm">Inscrição Estadual</Label>
                    <Input placeholder="Inscrição estadual" value={formData.inscricao_estadual} onChange={(e) => updateField('inscricao_estadual', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-sm">WhatsApp</Label>
                    <Input placeholder="(00) 0000-0000" value={formData.phone} onChange={(e) => updateField('phone', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-sm">E-mail</Label>
                    <Input placeholder="contato@empresa.com" type="email" value={formData.email} onChange={(e) => updateField('email', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-sm">Responsável</Label>
                    <Input placeholder="Nome do responsável" value={formData.responsavel_nome} onChange={(e) => updateField('responsavel_nome', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-sm">WhatsApp do Responsável</Label>
                    <Input placeholder="(00) 00000-0000" value={formData.responsavel_telefone} onChange={(e) => updateField('responsavel_telefone', e.target.value)} />
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <Label className="text-sm">Observações</Label>
                <textarea
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Observações sobre o cliente..."
                  value={formData.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  rows={2}
                />
              </div>

              {/* Address section */}
              <div className="pt-2 border-t">
                <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> Endereço
                </Label>
              </div>
              <div>
                <Label className="text-sm">CEP</Label>
                <div className="relative">
                  <Input placeholder="00000-000" value={formData.zip_code} onChange={(e) => handleCepChange(e.target.value)} maxLength={9} />
                  {isLoadingCep && <Loader2 className="h-4 w-4 animate-spin absolute right-3 top-3 text-muted-foreground" />}
                </div>
              </div>
              <div>
                <Label className="text-sm">Rua / Logradouro</Label>
                <Input placeholder="Rua, Avenida..." value={formData.address} onChange={(e) => updateField('address', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-sm">Número</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Nº"
                      value={formData.address_number === 'S/N' ? '' : formData.address_number}
                      onChange={(e) => updateField('address_number', e.target.value)}
                      disabled={formData.address_number === 'S/N'}
                      className="flex-1"
                    />
                    <div className="flex items-center gap-1 whitespace-nowrap">
                      <Checkbox
                        id="pos-sem-numero"
                        checked={formData.address_number === 'S/N'}
                        onCheckedChange={(checked) => updateField('address_number', checked ? 'S/N' : '')}
                      />
                      <Label htmlFor="pos-sem-numero" className="text-xs cursor-pointer font-normal">S/N</Label>
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="text-sm">Complemento</Label>
                  <Input placeholder="Apto, Bloco..." value={formData.address_complement} onChange={(e) => updateField('address_complement', e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-sm">Bairro</Label>
                <Input placeholder="Bairro" value={formData.neighborhood} onChange={(e) => updateField('neighborhood', e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Label className="text-sm">Cidade</Label>
                  <Input placeholder="Cidade" value={formData.city} onChange={(e) => updateField('city', e.target.value)} />
                </div>
                <div>
                  <Label className="text-sm">UF</Label>
                  <Input placeholder="UF" value={formData.state} onChange={(e) => updateField('state', e.target.value)} maxLength={2} />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <Button className="w-full" onClick={handleSaveCustomer} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Cadastrar e Selecionar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerStep;
