import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Package, Lock, MapPin, LogOut, Loader2, Plus, Trash2, Star, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import StoreLayout from '@/components/store/StoreLayout';

interface Address {
  id: string;
  label: string;
  recipient_name: string;
  zip_code: string;
  address: string;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  is_default: boolean;
}

interface Order {
  id: string;
  status: string;
  total: number;
  created_at: string;
  items: any[];
  tracking_code: string | null;
  payment_method: string | null;
}

const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'secondary' },
  confirmed: { label: 'Confirmado', variant: 'default' },
  processing: { label: 'Processando', variant: 'default' },
  shipped: { label: 'Enviado', variant: 'default' },
  delivered: { label: 'Entregue', variant: 'default' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
};

const MyAccountPage = () => {
  const navigate = useNavigate();
  const { user, profile, signOut, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');

  // Profile state
  const [fullName, setFullName] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Orders state
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  // Addresses state
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [addressForm, setAddressForm] = useState({
    label: 'Casa',
    recipient_name: '',
    zip_code: '',
    address: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    is_default: false,
  });
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/conta/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
    }
  }, [profile]);

  useEffect(() => {
    if (user) {
      loadOrders();
      loadAddresses();
    }
  }, [user]);

  const loadOrders = async () => {
    if (!user) return;
    setIsLoadingOrders(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, status, total, created_at, items, tracking_code, payment_method')
        .eq('customer_email', user.email || '')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setOrders(data as Order[]);
      }
    } catch (err) {
      console.error('Error loading orders:', err);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  const loadAddresses = async () => {
    if (!user) return;
    setIsLoadingAddresses(true);
    try {
      const { data, error } = await supabase
        .from('customer_addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false });
      if (!error && data) {
        setAddresses(data as Address[]);
      }
    } catch (err) {
      console.error('Error loading addresses:', err);
    } finally {
      setIsLoadingAddresses(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user || !fullName.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    setIsSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim() })
        .eq('user_id', user.id);
      if (error) throw error;
      toast.success('Perfil atualizado com sucesso!');
    } catch {
      toast.error('Erro ao atualizar perfil');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }
    setIsSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Senha alterada com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      toast.error('Erro ao alterar senha');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleCepChange = async (cep: string) => {
    const cleaned = cep.replace(/\D/g, '');
    const formatted = cleaned.length > 5 ? `${cleaned.slice(0, 5)}-${cleaned.slice(5, 8)}` : cleaned;
    setAddressForm(prev => ({ ...prev, zip_code: formatted }));

    if (cleaned.length === 8) {
      setIsFetchingCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setAddressForm(prev => ({
            ...prev,
            address: data.logradouro || '',
            neighborhood: data.bairro || '',
            city: data.localidade || '',
            state: data.uf || '',
          }));
        }
      } catch { /* ignore */ } finally {
        setIsFetchingCep(false);
      }
    }
  };

  const openAddressModal = (address?: Address) => {
    if (address) {
      setEditingAddress(address);
      setAddressForm({
        label: address.label,
        recipient_name: address.recipient_name,
        zip_code: address.zip_code,
        address: address.address,
        number: address.number || '',
        complement: address.complement || '',
        neighborhood: address.neighborhood || '',
        city: address.city,
        state: address.state,
        is_default: address.is_default,
      });
    } else {
      setEditingAddress(null);
      setAddressForm({
        label: 'Casa',
        recipient_name: profile?.full_name || '',
        zip_code: '',
        address: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: '',
        is_default: addresses.length === 0,
      });
    }
    setAddressModalOpen(true);
  };

  const handleSaveAddress = async () => {
    if (!user) return;
    if (!addressForm.recipient_name.trim() || !addressForm.zip_code.trim() || !addressForm.address.trim() || !addressForm.city.trim() || !addressForm.state.trim()) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }
    setIsSavingAddress(true);
    try {
      // If setting as default, unset others
      if (addressForm.is_default) {
        await supabase
          .from('customer_addresses')
          .update({ is_default: false })
          .eq('user_id', user.id);
      }

      if (editingAddress) {
        const { error } = await supabase
          .from('customer_addresses')
          .update({ ...addressForm })
          .eq('id', editingAddress.id);
        if (error) throw error;
        toast.success('Endereço atualizado!');
      } else {
        const { error } = await supabase
          .from('customer_addresses')
          .insert({ ...addressForm, user_id: user.id });
        if (error) throw error;
        toast.success('Endereço adicionado!');
      }
      setAddressModalOpen(false);
      loadAddresses();
    } catch {
      toast.error('Erro ao salvar endereço');
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    try {
      const { error } = await supabase.from('customer_addresses').delete().eq('id', id);
      if (error) throw error;
      toast.success('Endereço removido');
      loadAddresses();
    } catch {
      toast.error('Erro ao remover endereço');
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  if (authLoading) {
    return (
      <StoreLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </StoreLayout>
    );
  }

  if (!user) return null;

  return (
    <StoreLayout>
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold">Minha Conta</h1>
            <p className="text-muted-foreground">Olá, {profile?.full_name || user.email}</p>
          </div>
          <Button variant="outline" onClick={handleLogout} className="gap-2">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Dados</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Pedidos</span>
            </TabsTrigger>
            <TabsTrigger value="addresses" className="gap-2">
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">Endereços</span>
            </TabsTrigger>
            <TabsTrigger value="password" className="gap-2">
              <Lock className="h-4 w-4" />
              <span className="hidden sm:inline">Senha</span>
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Dados Pessoais</CardTitle>
                <CardDescription>Atualize suas informações pessoais</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={user.email || ''} disabled className="bg-muted" />
                  <p className="text-xs text-muted-foreground">O email não pode ser alterado</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome completo</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <Button onClick={handleSaveProfile} disabled={isSavingProfile}>
                  {isSavingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar alterações
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Pedidos</CardTitle>
                <CardDescription>Acompanhe seus pedidos realizados</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingOrders ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Você ainda não realizou nenhum pedido.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => {
                      const status = statusMap[order.status] || { label: order.status, variant: 'secondary' as const };
                      const items = Array.isArray(order.items) ? order.items : [];
                      return (
                        <div key={order.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <span className="text-sm text-muted-foreground">Pedido #{order.id.slice(0, 8)}</span>
                              <span className="text-sm text-muted-foreground ml-3">{formatDate(order.created_at)}</span>
                            </div>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </div>
                          <Separator className="my-2" />
                          <div className="space-y-1">
                            {items.slice(0, 3).map((item: any, idx: number) => (
                              <p key={idx} className="text-sm">
                                {item.quantity}x {item.name || item.product_name || 'Produto'}
                              </p>
                            ))}
                            {items.length > 3 && (
                              <p className="text-sm text-muted-foreground">+{items.length - 3} item(ns)</p>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-3">
                            <span className="font-semibold">{formatCurrency(order.total)}</span>
                            {order.tracking_code && (
                              <span className="text-xs text-muted-foreground">
                                Rastreio: {order.tracking_code}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Addresses Tab */}
          <TabsContent value="addresses">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Endereços Salvos</CardTitle>
                  <CardDescription>Gerencie seus endereços de entrega</CardDescription>
                </div>
                <Button onClick={() => openAddressModal()} size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Novo
                </Button>
              </CardHeader>
              <CardContent>
                {isLoadingAddresses ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : addresses.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhum endereço cadastrado.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {addresses.map((addr) => (
                      <div key={addr.id} className="border rounded-lg p-4 relative">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium text-sm">{addr.label}</span>
                          {addr.is_default && (
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <Star className="h-3 w-3" /> Padrão
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm">{addr.recipient_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {addr.address}{addr.number ? `, ${addr.number}` : ''}
                          {addr.complement ? ` - ${addr.complement}` : ''}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {addr.neighborhood ? `${addr.neighborhood} - ` : ''}{addr.city}/{addr.state}
                        </p>
                        <p className="text-sm text-muted-foreground">CEP: {addr.zip_code}</p>
                        <div className="flex gap-2 mt-3">
                          <Button variant="outline" size="sm" onClick={() => openAddressModal(addr)}>
                            Editar
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteAddress(addr.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Password Tab */}
          <TabsContent value="password">
            <Card>
              <CardHeader>
                <CardTitle>Alterar Senha</CardTitle>
                <CardDescription>Atualize sua senha de acesso</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Nova senha</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Mínimo 6 caracteres"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Repita a nova senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" disabled={isSavingPassword}>
                    {isSavingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Alterar senha
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Address Modal */}
      <Dialog open={addressModalOpen} onOpenChange={setAddressModalOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAddress ? 'Editar Endereço' : 'Novo Endereço'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Etiqueta</Label>
                <Input
                  value={addressForm.label}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="Casa, Trabalho..."
                />
              </div>
              <div className="space-y-2">
                <Label>CEP *</Label>
                <div className="relative">
                  <Input
                    value={addressForm.zip_code}
                    onChange={(e) => handleCepChange(e.target.value)}
                    placeholder="00000-000"
                    maxLength={9}
                  />
                  {isFetchingCep && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Destinatário *</Label>
              <Input
                value={addressForm.recipient_name}
                onChange={(e) => setAddressForm(prev => ({ ...prev, recipient_name: e.target.value }))}
                placeholder="Nome completo"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Endereço *</Label>
                <Input
                  value={addressForm.address}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Rua, Avenida..."
                />
              </div>
              <div className="space-y-2">
                <Label>Número</Label>
                <Input
                  value={addressForm.number}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, number: e.target.value }))}
                  placeholder="Nº"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Complemento</Label>
                <Input
                  value={addressForm.complement}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, complement: e.target.value }))}
                  placeholder="Apto, Bloco..."
                />
              </div>
              <div className="space-y-2">
                <Label>Bairro</Label>
                <Input
                  value={addressForm.neighborhood}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, neighborhood: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cidade *</Label>
                <Input
                  value={addressForm.city}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, city: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Estado *</Label>
                <Input
                  value={addressForm.state}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, state: e.target.value }))}
                  maxLength={2}
                  placeholder="UF"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_default"
                checked={addressForm.is_default}
                onChange={(e) => setAddressForm(prev => ({ ...prev, is_default: e.target.checked }))}
                className="rounded"
              />
              <Label htmlFor="is_default" className="text-sm cursor-pointer">Definir como endereço padrão</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddressModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveAddress} disabled={isSavingAddress}>
              {isSavingAddress && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StoreLayout>
  );
};

export default MyAccountPage;
