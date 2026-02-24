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
import { User, X, Phone, FileText, UserPlus, ArrowLeft, Loader2 } from 'lucide-react';
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

const CustomerSelector = ({ selectedCustomer, onSelectCustomer }: CustomerSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    document: '',
    email: '',
  });

  useEffect(() => {
    const fetchCustomers = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('customers')
          .select('id, name, email, phone, document')
          .eq('is_active', true)
          .order('name', { ascending: true })
          .limit(100);

        if (error) throw error;
        setCustomers(data || []);
      } catch (error) {
        console.error('Erro ao carregar clientes:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (open && !showForm) {
      fetchCustomers();
    }
  }, [open, showForm]);

  const filteredCustomers = customers.filter((customer) => {
    const query = searchQuery.toLowerCase();
    return (
      customer.name.toLowerCase().includes(query) ||
      customer.email?.toLowerCase().includes(query) ||
      customer.phone?.includes(query) ||
      customer.document?.includes(query)
    );
  });

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
    setFormData({ name: searchQuery || '', phone: '', document: '', email: '' });
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setFormData({ name: '', phone: '', document: '', email: '' });
  };

  const handleSaveCustomer = async () => {
    if (!formData.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert({
          name: formData.name.trim(),
          phone: formData.phone.trim() || null,
          document: formData.document.trim() || null,
          email: formData.email.trim() || null,
        })
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
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={handleClear}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) handleCloseForm(); }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start gap-2 text-muted-foreground"
        >
          <User className="h-4 w-4" />
          <span>Selecionar cliente</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 z-50" align="start">
        {showForm ? (
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCloseForm}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h4 className="font-semibold text-sm">Novo Cliente</h4>
            </div>
            <div className="space-y-2">
              <div>
                <Label className="text-xs">Nome *</Label>
                <Input
                  placeholder="Nome completo"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  autoFocus
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs">Telefone</Label>
                <Input
                  placeholder="(00) 00000-0000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs">CPF/CNPJ</Label>
                <Input
                  placeholder="000.000.000-00"
                  value={formData.document}
                  onChange={(e) => setFormData({ ...formData, document: e.target.value })}
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs">E-mail</Label>
                <Input
                  placeholder="email@exemplo.com"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="h-9"
                />
              </div>
            </div>
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
              <Button
                variant="outline"
                className="w-full gap-2"
                size="sm"
                onClick={handleOpenForm}
              >
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
