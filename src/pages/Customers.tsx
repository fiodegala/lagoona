import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Pencil, Trash2, UserPlus, Loader2, Phone, Mail, MapPin, History, Check, X, Eye, User, Building2, Store, ShoppingCart } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CustomerPurchaseHistory from '@/components/customers/CustomerPurchaseHistory';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  address: string | null;
  address_number: string | null;
  address_complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  customer_type: string;
  birthday: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  inscricao_estadual: string | null;
  inscricao_municipal: string | null;
  responsavel_nome: string | null;
  responsavel_telefone: string | null;
  store_id: string | null;
  referral_source: string | null;
}

interface Store {
  id: string;
  name: string;
  type: string;
}

type CustomerFormData = Omit<Customer, 'id' | 'created_at' | 'updated_at'>;

const emptyFormData: CustomerFormData = {
  customer_type: 'pf',
  name: '',
  email: '',
  phone: '',
  document: '',
  address: '',
  address_number: '',
  address_complement: '',
  neighborhood: '',
  city: '',
  state: '',
  zip_code: '',
  notes: '',
  is_active: true,
  birthday: '',
  razao_social: '',
  nome_fantasia: '',
  inscricao_estadual: '',
  inscricao_municipal: '',
  responsavel_nome: '',
  responsavel_telefone: '',
  store_id: null,
  referral_source: '',
};

const Customers = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<CustomerFormData>(emptyFormData);
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Customer[];
    },
  });

  const { data: stores = [] } = useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, type')
        .order('name');
      if (error) throw error;
      return data as Store[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      const { error } = await supabase.from('customers').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Cliente cadastrado com sucesso!' });
      handleCloseForm();
    },
    onError: () => {
      toast({ title: 'Erro ao cadastrar cliente', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CustomerFormData }) => {
      const { error } = await supabase.from('customers').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Cliente atualizado com sucesso!' });
      handleCloseForm();
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar cliente', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Cliente excluído com sucesso!' });
      setIsDeleteOpen(false);
      setSelectedCustomer(null);
    },
    onError: () => {
      toast({ title: 'Erro ao excluir cliente', variant: 'destructive' });
    },
  });

  const handleOpenForm = (customer?: Customer) => {
    if (customer) {
      setSelectedCustomer(customer);
      setFormData({
        customer_type: customer.customer_type || 'pf',
        name: customer.name,
        email: customer.email || '',
        phone: customer.phone || '',
        document: customer.document || '',
        address: customer.address || '',
        address_number: customer.address_number || '',
        address_complement: customer.address_complement || '',
        neighborhood: customer.neighborhood || '',
        city: customer.city || '',
        state: customer.state || '',
        zip_code: customer.zip_code || '',
        notes: customer.notes || '',
        is_active: customer.is_active,
        birthday: customer.birthday || '',
        razao_social: customer.razao_social || '',
        nome_fantasia: customer.nome_fantasia || '',
        inscricao_estadual: customer.inscricao_estadual || '',
        inscricao_municipal: customer.inscricao_municipal || '',
        responsavel_nome: customer.responsavel_nome || '',
        responsavel_telefone: customer.responsavel_telefone || '',
        store_id: customer.store_id || null,
        referral_source: customer.referral_source || '',
      });
    } else {
      setSelectedCustomer(null);
      setFormData(emptyFormData);
    }
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedCustomer(null);
    setFormData(emptyFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isPJ = formData.customer_type === 'pj';
    
    if (isPJ && !formData.razao_social?.trim()) {
      toast({ title: 'Razão Social é obrigatória para PJ', variant: 'destructive' });
      return;
    }
    if (!isPJ && !formData.name.trim()) {
      toast({ title: 'Nome Completo é obrigatório', variant: 'destructive' });
      return;
    }

    // Validate document if provided
    if (formData.document) {
      const documentValidation = validateDocument(formData.document);
      if (!documentValidation.valid) {
        toast({ title: documentValidation.message, variant: 'destructive' });
        return;
      }
    }

    const submitData = {
      ...formData,
      name: isPJ ? (formData.razao_social?.trim() || '') : formData.name.trim(),
      email: formData.email?.trim() || null,
      phone: formData.phone?.trim() || null,
      document: formData.document?.trim() || null,
      address: formData.address?.trim() || null,
      address_number: formData.address_number?.trim() || null,
      address_complement: formData.address_complement?.trim() || null,
      neighborhood: formData.neighborhood?.trim() || null,
      city: formData.city?.trim() || null,
      state: formData.state?.trim() || null,
      zip_code: formData.zip_code?.trim() || null,
      notes: formData.notes?.trim() || null,
      birthday: formData.birthday?.trim() || null,
      razao_social: formData.razao_social?.trim() || null,
      nome_fantasia: formData.nome_fantasia?.trim() || null,
      inscricao_estadual: formData.inscricao_estadual?.trim() || null,
      inscricao_municipal: formData.inscricao_municipal?.trim() || null,
      responsavel_nome: formData.responsavel_nome?.trim() || null,
      responsavel_telefone: formData.responsavel_telefone?.trim() || null,
      store_id: formData.store_id || null,
      referral_source: formData.referral_source?.trim() || null,
    };

    if (selectedCustomer) {
      updateMutation.mutate({ id: selectedCustomer.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleOpenDelete = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDeleteOpen(true);
  };

  const handleOpenHistory = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsHistoryOpen(true);
  };

  // Validate CPF
  const validateCPF = (cpf: string): boolean => {
    const digits = cpf.replace(/\D/g, '');
    if (digits.length !== 11) return false;
    
    // Check for known invalid patterns
    if (/^(\d)\1+$/.test(digits)) return false;
    
    // Validate first check digit
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(digits[i]) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(digits[9])) return false;
    
    // Validate second check digit
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(digits[i]) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(digits[10])) return false;
    
    return true;
  };

  // Validate CNPJ
  const validateCNPJ = (cnpj: string): boolean => {
    const digits = cnpj.replace(/\D/g, '');
    if (digits.length !== 14) return false;
    
    // Check for known invalid patterns
    if (/^(\d)\1+$/.test(digits)) return false;
    
    // Validate first check digit
    const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(digits[i]) * weights1[i];
    }
    let remainder = sum % 11;
    const firstDigit = remainder < 2 ? 0 : 11 - remainder;
    if (firstDigit !== parseInt(digits[12])) return false;
    
    // Validate second check digit
    const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    sum = 0;
    for (let i = 0; i < 13; i++) {
      sum += parseInt(digits[i]) * weights2[i];
    }
    remainder = sum % 11;
    const secondDigit = remainder < 2 ? 0 : 11 - remainder;
    if (secondDigit !== parseInt(digits[13])) return false;
    
    return true;
  };

  // Validate document (CPF or CNPJ)
  const validateDocument = (document: string): { valid: boolean; message?: string } => {
    const digits = document.replace(/\D/g, '');
    
    if (digits.length === 0) return { valid: true }; // Empty is valid (optional field)
    
    if (digits.length === 11) {
      if (validateCPF(document)) {
        return { valid: true };
      }
      return { valid: false, message: 'CPF inválido' };
    }
    
    if (digits.length === 14) {
      if (validateCNPJ(document)) {
        return { valid: true };
      }
      return { valid: false, message: 'CNPJ inválido' };
    }
    
    return { valid: false, message: 'Documento deve ter 11 dígitos (CPF) ou 14 dígitos (CNPJ)' };
  };

  // Format phone with mask: (00) 00000-0000 or (00) 0000-0000
  const formatPhone = (value: string): string => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length === 0) return '';
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  // Format CPF/CNPJ with mask: 000.000.000-00 or 00.000.000/0000-00
  const formatDocument = (value: string): string => {
    const digits = value.replace(/\D/g, '').slice(0, 14);
    if (digits.length === 0) return '';
    
    // CPF: 000.000.000-00
    if (digits.length <= 11) {
      if (digits.length <= 3) return digits;
      if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
      if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    }
    
    // CNPJ: 00.000.000/0000-00
    if (digits.length <= 12) {
      return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
    }
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  };

  const handlePhoneChange = (value: string) => {
    setFormData(prev => ({ ...prev, phone: formatPhone(value) }));
  };

  const handleDocumentChange = (value: string) => {
    setFormData(prev => ({ ...prev, document: formatDocument(value) }));
  };

  const handleCepChange = async (cep: string) => {
    // Remove non-digits
    const cleanCep = cep.replace(/\D/g, '');
    
    // Format CEP with mask
    let formattedCep = cleanCep;
    if (cleanCep.length > 5) {
      formattedCep = `${cleanCep.slice(0, 5)}-${cleanCep.slice(5, 8)}`;
    }
    
    setFormData(prev => ({ ...prev, zip_code: formattedCep }));

    // Only search if we have 8 digits
    if (cleanCep.length === 8) {
      setIsLoadingCep(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await response.json();
        
        if (data.erro) {
          toast({
            title: 'CEP não encontrado',
            description: 'Verifique o CEP informado e tente novamente.',
            variant: 'destructive',
          });
          return;
        }

        setFormData(prev => ({
          ...prev,
          address: data.logradouro || prev.address,
          neighborhood: data.bairro || prev.neighborhood,
          city: data.localidade || prev.city,
          state: data.uf || prev.state,
        }));

        toast({
          title: 'Endereço encontrado',
          description: `${data.logradouro}, ${data.localidade}/${data.uf}`,
        });
      } catch (error) {
        console.error('Error fetching CEP:', error);
        toast({
          title: 'Erro ao buscar CEP',
          description: 'Não foi possível consultar o CEP. Tente novamente.',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingCep(false);
      }
    }
  };

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone?.includes(searchTerm) ||
      customer.document?.includes(searchTerm)
  );

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
            <p className="text-muted-foreground mt-1">Gerencie o cadastro de clientes</p>
          </div>
          <Button onClick={() => handleOpenForm()}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Cliente
          </Button>
        </div>

        <Card className="card-elevated">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, email, telefone ou documento..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Badge variant="secondary" className="self-start sm:self-auto">
                {filteredCustomers.length} cliente(s)
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="text-center py-12">
                <UserPlus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Nenhum cliente encontrado</h3>
                <p className="text-muted-foreground mt-1">
                  {searchTerm ? 'Tente outro termo de busca' : 'Cadastre seu primeiro cliente'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Loja</TableHead>
                      <TableHead>Cidade/UF</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {customer.email && (
                              <div className="flex items-center gap-1 text-sm">
                                <Mail className="h-3 w-3 text-muted-foreground" />
                                {customer.email}
                              </div>
                            )}
                            {customer.phone && (
                              <div className="flex items-center gap-1 text-sm">
                                <Phone className="h-3 w-3 text-muted-foreground" />
                                {customer.phone}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{customer.document || '-'}</TableCell>
                        <TableCell>
                          {stores.find(s => s.id === customer.store_id)?.name || '-'}
                        </TableCell>
                        <TableCell>
                          {customer.city && customer.state
                            ? `${customer.city}/${customer.state}`
                            : customer.city || customer.state || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={customer.is_active ? 'default' : 'secondary'}>
                            {customer.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedCustomer(customer);
                                setIsDetailOpen(true);
                              }}
                              title="Ver detalhes"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenHistory(customer)}
                              title="Histórico de compras"
                            >
                              <History className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenForm(customer)}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDelete(customer)}
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedCustomer ? 'Editar Cliente' : 'Novo Cliente'}
            </DialogTitle>
            <DialogDescription>
              {selectedCustomer
                ? 'Atualize as informações do cliente'
                : 'Preencha os dados do novo cliente'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              {/* Tipo de Pessoa */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tipo de Pessoa</Label>
                <RadioGroup
                  value={formData.customer_type}
                  onValueChange={(v) => setFormData({ ...formData, customer_type: v })}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pf" id="form-pf" />
                    <Label htmlFor="form-pf" className="cursor-pointer font-normal flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" /> Pessoa Física
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pj" id="form-pj" />
                    <Label htmlFor="form-pj" className="cursor-pointer font-normal flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5" /> Pessoa Jurídica
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Loja de origem */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Store className="h-3.5 w-3.5" /> Loja de Origem
                </Label>
                <Select
                  value={formData.store_id || 'none'}
                  onValueChange={(v) => setFormData({ ...formData, store_id: v === 'none' ? null : v })}
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
                  onValueChange={(v) => setFormData({ ...formData, referral_source: v === 'none' ? '' : v })}
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
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome Completo *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Nome completo"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="document">CPF</Label>
                      <div className="relative">
                        <Input
                          id="document"
                          value={formData.document || ''}
                          onChange={(e) => handleDocumentChange(e.target.value)}
                          placeholder="000.000.000-00"
                          className={formData.document ? (
                            validateDocument(formData.document).valid 
                              ? 'pr-10 border-primary focus-visible:ring-primary' 
                              : 'pr-10 border-destructive focus-visible:ring-destructive'
                          ) : ''}
                        />
                        {formData.document && formData.document.replace(/\D/g, '').length >= 11 && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            {validateDocument(formData.document).valid ? (
                              <Check className="h-4 w-4 text-primary" />
                            ) : (
                              <X className="h-4 w-4 text-destructive" />
                            )}
                          </div>
                        )}
                      </div>
                      {formData.document && formData.document.replace(/\D/g, '').length >= 11 && !validateDocument(formData.document).valid && (
                        <p className="text-xs text-destructive">
                          {validateDocument(formData.document).message}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="birthday">Data de Nascimento</Label>
                      <Input
                        id="birthday"
                        type="date"
                        value={formData.birthday || ''}
                        onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">WhatsApp</Label>
                      <Input
                        id="phone"
                        value={formData.phone || ''}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">E-mail</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email || ''}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="email@exemplo.com"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="razao_social">Razão Social *</Label>
                      <Input
                        id="razao_social"
                        value={formData.razao_social || ''}
                        onChange={(e) => setFormData({ ...formData, razao_social: e.target.value })}
                        placeholder="Razão Social"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
                      <Input
                        id="nome_fantasia"
                        value={formData.nome_fantasia || ''}
                        onChange={(e) => setFormData({ ...formData, nome_fantasia: e.target.value })}
                        placeholder="Nome fantasia"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="document">CNPJ</Label>
                      <div className="relative">
                        <Input
                          id="document"
                          value={formData.document || ''}
                          onChange={(e) => handleDocumentChange(e.target.value)}
                          placeholder="00.000.000/0000-00"
                          className={formData.document ? (
                            validateDocument(formData.document).valid 
                              ? 'pr-10 border-primary focus-visible:ring-primary' 
                              : 'pr-10 border-destructive focus-visible:ring-destructive'
                          ) : ''}
                        />
                        {formData.document && formData.document.replace(/\D/g, '').length >= 11 && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            {validateDocument(formData.document).valid ? (
                              <Check className="h-4 w-4 text-primary" />
                            ) : (
                              <X className="h-4 w-4 text-destructive" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="inscricao_estadual">Inscrição Estadual</Label>
                      <Input
                        id="inscricao_estadual"
                        value={formData.inscricao_estadual || ''}
                        onChange={(e) => setFormData({ ...formData, inscricao_estadual: e.target.value })}
                        placeholder="Inscrição estadual"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="phone">WhatsApp</Label>
                      <Input
                        id="phone"
                        value={formData.phone || ''}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        placeholder="(00) 0000-0000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">E-mail</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email || ''}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="contato@empresa.com"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="responsavel_nome">Responsável</Label>
                      <Input
                        id="responsavel_nome"
                        value={formData.responsavel_nome || ''}
                        onChange={(e) => setFormData({ ...formData, responsavel_nome: e.target.value })}
                        placeholder="Nome do responsável"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="responsavel_telefone">WhatsApp do Responsável</Label>
                      <Input
                        id="responsavel_telefone"
                        value={formData.responsavel_telefone || ''}
                        onChange={(e) => setFormData({ ...formData, responsavel_telefone: e.target.value })}
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Endereço */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="zip_code" className="flex items-center gap-2">
                    CEP
                    {isLoadingCep && <Loader2 className="h-3 w-3 animate-spin" />}
                  </Label>
                  <div className="relative">
                    <Input
                      id="zip_code"
                      value={formData.zip_code || ''}
                      onChange={(e) => handleCepChange(e.target.value)}
                      placeholder="00000-000"
                      maxLength={9}
                    />
                    {isLoadingCep && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <MapPin className="h-4 w-4 text-muted-foreground animate-pulse" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    value={formData.city || ''}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Cidade"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">UF</Label>
                  <Input
                    id="state"
                    value={formData.state || ''}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="UF"
                    maxLength={2}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Rua / Logradouro</Label>
                <Input
                  id="address"
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Rua, Avenida..."
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="address_number">Número</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="address_number"
                      value={formData.address_number === 'S/N' ? '' : (formData.address_number || '')}
                      onChange={(e) => setFormData({ ...formData, address_number: e.target.value })}
                      placeholder="Nº"
                      disabled={formData.address_number === 'S/N'}
                      className="flex-1"
                    />
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <Checkbox
                        id="sem-numero"
                        checked={formData.address_number === 'S/N'}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, address_number: checked ? 'S/N' : '' })
                        }
                      />
                      <Label htmlFor="sem-numero" className="text-sm cursor-pointer font-normal">
                        Sem número
                      </Label>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address_complement">Complemento</Label>
                  <Input
                    id="address_complement"
                    value={formData.address_complement || ''}
                    onChange={(e) => setFormData({ ...formData, address_complement: e.target.value })}
                    placeholder="Apto, Bloco, Sala..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="neighborhood">Bairro</Label>
                <Input
                  id="neighborhood"
                  value={formData.neighborhood || ''}
                  onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                  placeholder="Bairro"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Anotações sobre o cliente..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseForm}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {selectedCustomer ? 'Salvar' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{selectedCustomer?.name}"? Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedCustomer && deleteMutation.mutate(selectedCustomer.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* History Dialog */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico de Compras</DialogTitle>
            <DialogDescription>
              {selectedCustomer?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedCustomer && (
            <CustomerPurchaseHistory
              customerId={selectedCustomer.id}
              customerName={selectedCustomer.name}
            />
          )}
        </DialogContent>
      </Dialog>
      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do Cliente</DialogTitle>
            <DialogDescription>{selectedCustomer?.name}</DialogDescription>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Tipo</p>
                  <p className="font-medium">{selectedCustomer.customer_type === 'pj' ? 'Pessoa Jurídica' : 'Pessoa Física'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Nome</p>
                  <p className="font-medium">{selectedCustomer.name}</p>
                </div>
                {selectedCustomer.customer_type === 'pj' && (
                  <>
                    {selectedCustomer.razao_social && (
                      <div>
                        <p className="text-xs text-muted-foreground">Razão Social</p>
                        <p className="font-medium">{selectedCustomer.razao_social}</p>
                      </div>
                    )}
                    {selectedCustomer.nome_fantasia && (
                      <div>
                        <p className="text-xs text-muted-foreground">Nome Fantasia</p>
                        <p className="font-medium">{selectedCustomer.nome_fantasia}</p>
                      </div>
                    )}
                    {selectedCustomer.inscricao_estadual && (
                      <div>
                        <p className="text-xs text-muted-foreground">Inscrição Estadual</p>
                        <p className="font-medium">{selectedCustomer.inscricao_estadual}</p>
                      </div>
                    )}
                    {selectedCustomer.responsavel_nome && (
                      <div>
                        <p className="text-xs text-muted-foreground">Responsável</p>
                        <p className="font-medium">{selectedCustomer.responsavel_nome}</p>
                      </div>
                    )}
                    {selectedCustomer.responsavel_telefone && (
                      <div>
                        <p className="text-xs text-muted-foreground">WhatsApp Responsável</p>
                        <p className="font-medium">{selectedCustomer.responsavel_telefone}</p>
                      </div>
                    )}
                  </>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Documento</p>
                  <p className="font-medium">{selectedCustomer.document || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Data de Nascimento</p>
                  <p className="font-medium">{selectedCustomer.birthday ? new Date(selectedCustomer.birthday + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">E-mail</p>
                  <p className="font-medium">{selectedCustomer.email || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">WhatsApp</p>
                  <p className="font-medium">{selectedCustomer.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">CEP</p>
                  <p className="font-medium">{selectedCustomer.zip_code || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cidade/UF</p>
                  <p className="font-medium">
                    {selectedCustomer.city && selectedCustomer.state
                      ? `${selectedCustomer.city}/${selectedCustomer.state}`
                      : selectedCustomer.city || selectedCustomer.state || '-'}
                  </p>
                </div>
              </div>
              {selectedCustomer.address && (
                <div>
                  <p className="text-xs text-muted-foreground">Endereço</p>
                  <p className="font-medium">
                    {selectedCustomer.address}
                    {selectedCustomer.address_number && `, ${selectedCustomer.address_number}`}
                    {selectedCustomer.address_complement && ` - ${selectedCustomer.address_complement}`}
                  </p>
                </div>
              )}
              {selectedCustomer.neighborhood && (
                <div>
                  <p className="text-xs text-muted-foreground">Bairro</p>
                  <p className="font-medium">{selectedCustomer.neighborhood}</p>
                </div>
              )}
              {selectedCustomer.notes && (
                <div>
                  <p className="text-xs text-muted-foreground">Observações</p>
                  <p className="font-medium">{selectedCustomer.notes}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={selectedCustomer.is_active ? 'default' : 'secondary'}>
                    {selectedCustomer.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cadastrado em</p>
                  <p className="font-medium">
                    {new Date(selectedCustomer.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
                  Fechar
                </Button>
                <Button
                  variant="default"
                  className="gap-2"
                  onClick={() => {
                    setIsDetailOpen(false);
                    navigate('/admin/pos', {
                      state: {
                        prefillCustomer: {
                          id: selectedCustomer.id,
                          name: selectedCustomer.name,
                          email: selectedCustomer.email,
                          phone: selectedCustomer.phone,
                          document: selectedCustomer.document,
                        },
                      },
                    });
                  }}
                >
                  <ShoppingCart className="h-4 w-4" />
                  Vender para este cliente
                </Button>
                <Button onClick={() => {
                  setIsDetailOpen(false);
                  handleOpenForm(selectedCustomer);
                }}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default Customers;
