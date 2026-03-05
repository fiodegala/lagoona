import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Plus, Shield, Pencil, Trash2, Loader2, Mail, ShieldCheck, ShieldAlert, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { allMenuItems } from '@/config/menuItems';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type AppRole = 'admin' | 'manager' | 'support' | 'seller';

interface UserWithRole {
  id: string;
  user_id: string;
  role: AppRole;
  store_id: string | null;
  store_name?: string;
  created_at: string;
  profile?: {
    full_name: string;
    avatar_url: string | null;
  };
  email?: string;
}

const roleLabels: Record<AppRole, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  support: 'Suporte',
  seller: 'Vendedor',
};

const roleDescriptions: Record<AppRole, string> = {
  admin: 'Controle total do sistema',
  manager: 'Gerencia produtos, metas e equipe',
  support: 'Acesso a pedidos e clientes',
  seller: 'Apenas vendas no PDV',
};

const roleColors: Record<AppRole, string> = {
  admin: 'bg-destructive text-destructive-foreground',
  manager: 'bg-primary text-primary-foreground',
  support: 'bg-secondary text-secondary-foreground',
  seller: 'bg-muted text-muted-foreground',
};

const UsersPage = () => {
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'seller' as AppRole,
    store_id: '' as string,
    allowed_menus: [] as string[],
  });

  // Fetch stores
  const { data: stores = [] } = useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, slug, type')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: usersWithRoles = [], isLoading } = useQuery({
    queryKey: ['users-with-roles'],
    queryFn: async () => {
      // Get all user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .order('created_at', { ascending: false });

      if (rolesError) throw rolesError;

      // Get profiles for all users with roles
      const userIds = [...new Set(roles?.map(r => r.user_id) || [])];
      
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Merge data
      const usersMap = new Map<string, UserWithRole>();
      
      roles?.forEach(role => {
        const profile = profiles?.find(p => p.user_id === role.user_id);
        const store = stores.find(s => s.id === role.store_id);
        usersMap.set(role.user_id, {
          id: role.id,
          user_id: role.user_id,
          role: role.role as AppRole,
          store_id: role.store_id || null,
          store_name: store?.name,
          created_at: role.created_at,
          profile: profile ? {
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
          } : undefined,
        });
      });

      return Array.from(usersMap.values());
    },
    enabled: stores.length > 0,
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão não encontrada');

      const { data: responseData, error: fnError } = await supabase.functions.invoke('create-user', {
        body: {
          email: data.email,
          password: data.password,
          fullName: data.fullName,
          role: data.role,
          store_id: data.store_id || null,
          allowed_menus: data.allowed_menus,
        },
      });

      if (fnError) {
        let errorMsg = 'Erro ao criar usuário';
        try {
          if (responseData?.error) {
            errorMsg = responseData.error;
          } else if (fnError.context) {
            const body = await fnError.context.json();
            errorMsg = body?.error || fnError.message;
          } else {
            errorMsg = fnError.message;
          }
        } catch {
          errorMsg = fnError.message || errorMsg;
        }
        throw new Error(errorMsg);
      }
      if (responseData?.error) throw new Error(responseData.error);

      return responseData?.user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast({ title: 'Usuário criado com sucesso!' });
      handleCloseForm();
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Erro ao criar usuário', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role, store_id, allowed_menus }: { userId: string; role: AppRole; store_id: string | null; allowed_menus: string[] }) => {
      const { error } = await supabase
        .from('user_roles')
        .update({ role, store_id } as never)
        .eq('user_id', userId);

      if (error) throw error;

      // Upsert menu permissions
      const { error: menuError } = await supabase
        .from('user_menu_permissions')
        .upsert({ user_id: userId, allowed_menus, updated_at: new Date().toISOString() } as never, { onConflict: 'user_id' });

      if (menuError) throw menuError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast({ title: 'Permissão atualizada!' });
      handleCloseForm();
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar permissão', variant: 'destructive' });
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast({ title: 'Acesso removido!' });
      setIsDeleteOpen(false);
      setSelectedUser(null);
    },
    onError: () => {
      toast({ title: 'Erro ao remover acesso', variant: 'destructive' });
    },
  });

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleOpenForm = (userRole?: UserWithRole) => {
    if (userRole) {
      setSelectedUser(userRole);
      setFormData({
        email: '',
        password: '',
        fullName: userRole.profile?.full_name || '',
        role: userRole.role,
        store_id: userRole.store_id || '',
      });
    } else {
      setSelectedUser(null);
      setFormData({
        email: '',
        password: '',
        fullName: '',
        role: 'seller',
        store_id: '',
      });
    }
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedUser(null);
    setFormData({
      email: '',
      password: '',
      fullName: '',
      role: 'seller',
      store_id: '',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedUser) {
      updateRoleMutation.mutate({ userId: selectedUser.user_id, role: formData.role, store_id: formData.store_id || null });
    } else {
      if (!formData.email || !formData.password || !formData.fullName) {
        toast({ title: 'Preencha todos os campos', variant: 'destructive' });
        return;
      }
      if (formData.password.length < 6) {
        toast({ title: 'Senha deve ter pelo menos 6 caracteres', variant: 'destructive' });
        return;
      }
      createUserMutation.mutate(formData);
    }
  };

  const handleOpenDelete = (userRole: UserWithRole) => {
    if (userRole.user_id === user?.id) {
      toast({ title: 'Você não pode remover seu próprio acesso', variant: 'destructive' });
      return;
    }
    setSelectedUser(userRole);
    setIsDeleteOpen(true);
  };

  const isSaving = createUserMutation.isPending || updateRoleMutation.isPending;

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
            <p className="text-muted-foreground mt-1">Gerencie os usuários e suas permissões</p>
          </div>
          <Button onClick={() => handleOpenForm()} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Usuário
          </Button>
        </div>

        {/* Permissions Guide */}
        <div className="grid gap-4 md:grid-cols-4">
          {(Object.keys(roleLabels) as AppRole[]).map((role) => (
            <Card key={role} className="card-elevated">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  {role === 'admin' && <ShieldCheck className="h-5 w-5 text-destructive" />}
                  {role === 'manager' && <ShieldAlert className="h-5 w-5 text-primary" />}
                  {role === 'support' && <UserCog className="h-5 w-5 text-muted-foreground" />}
                  {role === 'seller' && <Users className="h-5 w-5 text-muted-foreground" />}
                  <CardTitle className="text-sm">{roleLabels[role]}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{roleDescriptions[role]}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Users Table */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle>Usuários do Sistema</CardTitle>
            <CardDescription>
              {usersWithRoles.length} usuário(s) com acesso ao sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : usersWithRoles.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Nenhum usuário cadastrado</h3>
                <p className="text-muted-foreground mt-1">
                  Adicione o primeiro usuário ao sistema
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Loja</TableHead>
                      <TableHead>Permissão</TableHead>
                      <TableHead>Acesso desde</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersWithRoles.map((userRole) => (
                      <TableRow key={userRole.id}>
                        <TableCell>
                          <span className="text-sm">
                            {userRole.store_name || 'Todas'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                              <Users className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                              <div className="font-medium">
                                {userRole.profile?.full_name || 'Usuário'}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {userRole.user_id === user?.id && '(Você)'}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={roleColors[userRole.role]}>
                            {roleLabels[userRole.role]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(userRole.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenForm(userRole)}
                              title="Editar permissão"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDelete(userRole)}
                              title="Remover acesso"
                              disabled={userRole.user_id === user?.id}
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

      {/* Create/Edit User Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedUser ? 'Editar Permissão' : 'Novo Usuário'}
            </DialogTitle>
            <DialogDescription>
              {selectedUser
                ? 'Altere o nível de permissão do usuário'
                : 'Crie um novo usuário e defina suas permissões'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              {!selectedUser && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nome Completo *</Label>
                    <Input
                      id="fullName"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      placeholder="Nome do usuário"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@exemplo.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Mínimo 6 caracteres"
                      required
                      minLength={6}
                    />
                  </div>
                </>
              )}
              
              {selectedUser && (
                <div className="p-4 bg-muted rounded-lg">
                  <div className="font-medium">{selectedUser.profile?.full_name}</div>
                  <div className="text-sm text-muted-foreground">
                    Usuário desde {new Date(selectedUser.created_at).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="role">Nível de Permissão *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: AppRole) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma permissão" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">
                      <div className="flex flex-col">
                        <span className="font-medium">Administrador</span>
                        <span className="text-xs text-muted-foreground">Controle total do sistema</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="manager">
                      <div className="flex flex-col">
                        <span className="font-medium">Gerente</span>
                        <span className="text-xs text-muted-foreground">Produtos, metas e equipe</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="support">
                      <div className="flex flex-col">
                        <span className="font-medium">Suporte</span>
                        <span className="text-xs text-muted-foreground">Pedidos e clientes</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="seller">
                      <div className="flex flex-col">
                        <span className="font-medium">Vendedor</span>
                        <span className="text-xs text-muted-foreground">Apenas vendas no PDV</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="store">Loja *</Label>
                <Select
                  value={formData.store_id}
                  onValueChange={(value: string) => setFormData({ ...formData, store_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma loja" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Permissions Preview */}
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="text-sm font-medium mb-2">Permissões de {roleLabels[formData.role]}:</div>
                <div className="grid gap-1 text-sm">
                  {formData.role === 'admin' && (
                    <>
                      <div className="flex items-center gap-2 text-primary">✓ Controle total do sistema</div>
                      <div className="flex items-center gap-2 text-primary">✓ Criar e gerenciar usuários</div>
                      <div className="flex items-center gap-2 text-primary">✓ Editar produtos e categorias</div>
                      <div className="flex items-center gap-2 text-primary">✓ Definir metas de vendas</div>
                      <div className="flex items-center gap-2 text-primary">✓ Acesso ao PDV</div>
                    </>
                  )}
                  {formData.role === 'manager' && (
                    <>
                      <div className="flex items-center gap-2 text-primary">✓ Editar produtos e categorias</div>
                      <div className="flex items-center gap-2 text-primary">✓ Definir metas de vendas</div>
                      <div className="flex items-center gap-2 text-primary">✓ Gerenciar pedidos</div>
                      <div className="flex items-center gap-2 text-primary">✓ Acesso ao PDV</div>
                      <div className="flex items-center gap-2 text-muted-foreground">✗ Criar usuários</div>
                    </>
                  )}
                  {formData.role === 'support' && (
                    <>
                      <div className="flex items-center gap-2 text-primary">✓ Visualizar pedidos</div>
                      <div className="flex items-center gap-2 text-primary">✓ Gerenciar clientes</div>
                      <div className="flex items-center gap-2 text-primary">✓ Acesso ao PDV</div>
                      <div className="flex items-center gap-2 text-muted-foreground">✗ Editar produtos</div>
                      <div className="flex items-center gap-2 text-muted-foreground">✗ Definir metas</div>
                    </>
                  )}
                  {formData.role === 'seller' && (
                    <>
                      <div className="flex items-center gap-2 text-primary">✓ Acesso ao PDV</div>
                      <div className="flex items-center gap-2 text-primary">✓ Realizar vendas</div>
                      <div className="flex items-center gap-2 text-muted-foreground">✗ Criar usuários</div>
                      <div className="flex items-center gap-2 text-muted-foreground">✗ Editar produtos</div>
                      <div className="flex items-center gap-2 text-muted-foreground">✗ Definir metas</div>
                    </>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseForm}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {selectedUser ? 'Salvar' : 'Criar Usuário'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover acesso do usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              O usuário "{selectedUser?.profile?.full_name}" perderá o acesso ao sistema administrativo.
              Esta ação pode ser desfeita atribuindo uma nova permissão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedUser && deleteRoleMutation.mutate(selectedUser.user_id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover Acesso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default UsersPage;
