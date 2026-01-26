import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { User, X, Search, Phone, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

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

    if (open) {
      fetchCustomers();
    }
  }, [open]);

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
  };

  const handleClear = () => {
    onSelectCustomer(null);
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
    <Popover open={open} onOpenChange={setOpen}>
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
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default CustomerSelector;
