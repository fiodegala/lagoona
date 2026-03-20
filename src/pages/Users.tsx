import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Plus, Shield, Pencil, Trash2, Loader2, Mail, ShieldCheck, ShieldAlert, UserCog, KeyRound } from 'lucide-react';
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
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
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

      // Fetch emails via edge function
      let emailsMap: Record<string, string> = {};
      try {
        const { data: emailData } = await supabase.functions.invoke('list-users', {
          body: { user_ids: userIds },
        });
        if (emailData?.emails) {
          emailsMap = emailData.emails;
        }
      } catch (e) {
        console.error('Error fetching emails:', e);
      }

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
          email: emailsMap[role.user_id] || undefined,
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
    onError: (error: Error) => {
      console.error('updateRoleMutation error:', error);
      toast({ title: 'Erro ao atualizar permissão', description: error.message, variant: 'destructive' });
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

  const handleOpenForm = async (userRole?: UserWithRole) => {
    if (userRole) {
      setSelectedUser(userRole);
      // Fetch existing menu permissions
      const { data: menuPerms } = await supabase
        .from('user_menu_permissions')
        .select('allowed_menus')
        .eq('user_id', userRole.user_id)
        .maybeSingle();
      setFormData({
        email: '',
        password: '',
        fullName: userRole.profile?.full_name || '',
        role: userRole.role,
        store_id: userRole.store_id || '',
        allowed_menus: (menuPerms?.allowed_menus as string[]) || [],
      });
    } else {
      setSelectedUser(null);
      setFormData({
        email: '',
        password: '',
        fullName: '',
        role: 'seller',
        store_id: '',
        allowed_menus: [],
      });
    }
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedUser(null);
    setNewPassword('');
    setFormData({
      email: '',
      password: '',
      fullName: '',
      role: 'seller',
      store_id: '',
      allowed_menus: [],
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedUser) {
      updateRoleMutation.mutate({ userId: selectedUser.user_id, role: formData.role, store_id: formData.store_id || null, allowed_menus: formData.allowed_menus });
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
                      <TableHead>E-mail</TableHead>
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
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Mail className="h-3.5 w-3.5" />
                            {userRole.email || '—'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {userRole.store_name || 'Todas'}
                          </span>
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
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {selectedUser ? 'Editar Permissão' : 'Novo Usuário'}
            </DialogTitle>
            <DialogDescription>
              {selectedUser
                ? 'Altere o nível de permissão do usuário'
                : 'Crie um novo usuário e defina suas permissões'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
            <ScrollArea className="flex-1 min-h-0 pr-3">
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
                    {selectedUser.email && <span className="block">{selectedUser.email}</span>}
                    Usuário desde {new Date(selectedUser.created_at).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              )}

              {selectedUser && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5" />
                    Nova Senha
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Deixe vazio para manter a atual"
                      minLength={6}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!newPassword || newPassword.length < 6 || isChangingPassword}
                      onClick={async () => {
                        if (!selectedUser || !newPassword || newPassword.length < 6) return;
                        setIsChangingPassword(true);
                        try {
                          const { data, error } = await supabase.functions.invoke('create-user', {
                            body: { action: 'update-password', user_id: selectedUser.user_id, new_password: newPassword },
                          });
                          if (error) throw error;
                          if (data?.error) throw new Error(data.error);
                          toast({ title: 'Senha atualizada com sucesso!' });
                          setNewPassword('');
                        } catch (err: any) {
                          toast({ title: 'Erro ao atualizar senha', description: err.message, variant: 'destructive' });
                        } finally {
                          setIsChangingPassword(false);
                        }
                      }}
                    >
                      {isChangingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Alterar'}
                    </Button>
                  </div>
                  {newPassword && newPassword.length < 6 && (
                    <p className="text-xs text-destructive">Mínimo 6 caracteres</p>
                  )}
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

              {/* Menu Permissions */}
              {formData.role !== 'admin' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Acesso ao Menu</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setFormData({ ...formData, allowed_menus: allMenuItems.map(i => i.menuKey) })}
                      >
                        Marcar todos
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setFormData({ ...formData, allowed_menus: [] })}
                      >
                        Desmarcar
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Selecione quais páginas este usuário poderá acessar. Se nenhuma for selecionada, o acesso padrão da role será aplicado.
                  </p>
                  <ScrollArea className="h-[200px] rounded-md border p-3">
                    <div className="grid gap-2">
                      {allMenuItems.map((item) => (
                        <label key={item.menuKey} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1">
                          <Checkbox
                            checked={formData.allowed_menus.includes(item.menuKey)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setFormData({ ...formData, allowed_menus: [...formData.allowed_menus, item.menuKey] });
                              } else {
                                setFormData({ ...formData, allowed_menus: formData.allowed_menus.filter(k => k !== item.menuKey) });
                              }
                            }}
                          />
                          <item.icon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Permissions Preview */}
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="text-sm font-medium mb-2">Permissões de {roleLabels[formData.role]}:</div>
                <div className="grid gap-1 text-sm">
                  {formData.role === 'admin' && (
                    <>
                      <div className="flex items-center gap-2 text-primary">✓ Controle total do sistema</div>
                      <div className="flex items-center gap-2 text-primary">✓ Acesso a todos os menus</div>
                    </>
                  )}
                  {formData.role !== 'admin' && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {formData.allowed_menus.length > 0
                        ? `${formData.allowed_menus.length} menu(s) selecionado(s)`
                        : 'Acesso padrão da role (todos os menus permitidos)'}
                    </div>
                  )}
                </div>
              </div>
            </div>
            </ScrollArea>
            <DialogFooter className="shrink-0 pt-4">
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
