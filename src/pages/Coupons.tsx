import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Search, MoreHorizontal, Plus, Pencil, Trash2, 
  Loader2, Tag, Percent, DollarSign, Calendar,
  Copy, CheckCircle, Users, ShoppingBag
} from 'lucide-react';
import { toast } from 'sonner';
import { couponsService, Coupon, CreateCouponData } from '@/services/coupons';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const Coupons = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Coupon | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState<CreateCouponData>({
    code: '',
    description: '',
    discount_type: 'percentage',
    discount_value: 10,
    minimum_order_value: 0,
    maximum_discount: undefined,
    max_uses: undefined,
    max_uses_per_customer: 1,
    starts_at: undefined,
    expires_at: undefined,
    is_active: true,
    show_in_wheel: false,
  });

  useEffect(() => {
    loadCoupons();
  }, []);

  const loadCoupons = async () => {
    try {
      setIsLoading(true);
      const data = await couponsService.getAll();
      setCoupons(data);
    } catch (error) {
      console.error('Error loading coupons:', error);
      toast.error('Erro ao carregar cupons');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      description: '',
      discount_type: 'percentage',
      discount_value: 10,
      minimum_order_value: 0,
      maximum_discount: undefined,
      max_uses: undefined,
      max_uses_per_customer: 1,
      starts_at: undefined,
      expires_at: undefined,
      is_active: true,
      show_in_wheel: false,
    });
    setEditingCoupon(null);
  };

  const openModal = (coupon?: Coupon) => {
    if (coupon) {
      setEditingCoupon(coupon);
      setFormData({
        code: coupon.code,
        description: coupon.description || '',
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        minimum_order_value: coupon.minimum_order_value || 0,
        maximum_discount: coupon.maximum_discount || undefined,
        max_uses: coupon.max_uses || undefined,
        max_uses_per_customer: coupon.max_uses_per_customer || 1,
        starts_at: coupon.starts_at ? coupon.starts_at.split('T')[0] : undefined,
        expires_at: coupon.expires_at ? coupon.expires_at.split('T')[0] : undefined,
        is_active: coupon.is_active,
        show_in_wheel: (coupon as any).show_in_wheel ?? false,
      });
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.code.trim()) {
      toast.error('Código do cupom é obrigatório');
      return;
    }

    if (formData.discount_value <= 0) {
      toast.error('Valor do desconto deve ser maior que zero');
      return;
    }

    if (formData.discount_type === 'percentage' && formData.discount_value > 100) {
      toast.error('Desconto percentual não pode ser maior que 100%');
      return;
    }

    setIsSubmitting(true);

    try {
      const data: CreateCouponData = {
        ...formData,
        starts_at: formData.starts_at ? new Date(formData.starts_at).toISOString() : undefined,
        expires_at: formData.expires_at ? new Date(formData.expires_at + 'T23:59:59').toISOString() : undefined,
      };

      if (editingCoupon) {
        await couponsService.update(editingCoupon.id, data);
        toast.success('Cupom atualizado com sucesso!');
      } else {
        await couponsService.create(data);
        toast.success('Cupom criado com sucesso!');
      }

      setIsModalOpen(false);
      resetForm();
      loadCoupons();
    } catch (error: any) {
      console.error('Error saving coupon:', error);
      if (error.code === '23505') {
        toast.error('Já existe um cupom com este código');
      } else {
        toast.error('Erro ao salvar cupom');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      setIsSubmitting(true);
      await couponsService.delete(deleteConfirm.id);
      toast.success('Cupom excluído com sucesso!');
      setDeleteConfirm(null);
      loadCoupons();
    } catch (error) {
      console.error('Error deleting coupon:', error);
      toast.error('Erro ao excluir cupom');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (coupon: Coupon) => {
    try {
      await couponsService.toggleActive(coupon.id, !coupon.is_active);
      setCoupons(prev => prev.map(c => 
        c.id === coupon.id ? { ...c, is_active: !c.is_active } : c
      ));
      toast.success(coupon.is_active ? 'Cupom desativado' : 'Cupom ativado');
    } catch (error) {
      console.error('Error toggling coupon:', error);
      toast.error('Erro ao atualizar cupom');
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Código copiado!');
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, code }));
  };

  const filteredCoupons = coupons.filter(coupon => {
    const matchesSearch = 
      coupon.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      coupon.description?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = 
      statusFilter === 'all' ||
      (statusFilter === 'active' && coupon.is_active) ||
      (statusFilter === 'inactive' && !coupon.is_active);

    return matchesSearch && matchesStatus;
  });

  const formatDiscount = (coupon: Coupon) => {
    if (coupon.discount_type === 'percentage') {
      return `${coupon.discount_value}%`;
    }
    return `R$ ${coupon.discount_value.toFixed(2)}`;
  };

  const getCouponStatus = (coupon: Coupon) => {
    if (!coupon.is_active) return { label: 'Inativo', variant: 'secondary' as const };
    
    const now = new Date();
    if (coupon.expires_at && new Date(coupon.expires_at) < now) {
      return { label: 'Expirado', variant: 'destructive' as const };
    }
    if (coupon.starts_at && new Date(coupon.starts_at) > now) {
      return { label: 'Agendado', variant: 'outline' as const };
    }
    if (coupon.max_uses && coupon.uses_count >= coupon.max_uses) {
      return { label: 'Esgotado', variant: 'secondary' as const };
    }
    return { label: 'Ativo', variant: 'default' as const };
  };

  // Stats
  const activeCoupons = coupons.filter(c => c.is_active).length;
  const totalUses = coupons.reduce((acc, c) => acc + c.uses_count, 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Cupons</h1>
            <p className="text-muted-foreground">
              Gerencie cupons e códigos promocionais
            </p>
          </div>
          <Button onClick={() => openModal()}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Cupom
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{coupons.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{activeCoupons}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Usos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUses}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Inativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">
                {coupons.length - activeCoupons}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por código ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredCoupons.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Tag className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">Nenhum cupom encontrado</p>
                <Button variant="outline" className="mt-4" onClick={() => openModal()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar primeiro cupom
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Desconto</TableHead>
                    <TableHead>Usos</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCoupons.map((coupon) => {
                    const status = getCouponStatus(coupon);
                    return (
                      <TableRow key={coupon.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="bg-muted px-2 py-1 rounded font-mono text-sm font-bold">
                              {coupon.code}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyCode(coupon.code)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          {coupon.description && (
                            <p className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate">
                              {coupon.description}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {coupon.discount_type === 'percentage' ? (
                              <Percent className="h-4 w-4 text-primary" />
                            ) : (
                              <DollarSign className="h-4 w-4 text-primary" />
                            )}
                            <span className="font-medium">{formatDiscount(coupon)}</span>
                          </div>
                          {coupon.minimum_order_value > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Mín: R$ {coupon.minimum_order_value.toFixed(2)}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>{coupon.uses_count}</span>
                            {coupon.max_uses && (
                              <span className="text-muted-foreground">/ {coupon.max_uses}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {coupon.expires_at ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {format(new Date(coupon.expires_at), "dd/MM/yy", { locale: ptBR })}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Sem prazo</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openModal(coupon)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleActive(coupon)}>
                                {coupon.is_active ? (
                                  <>
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Desativar
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Ativar
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteConfirm(coupon)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCoupon ? 'Editar Cupom' : 'Novo Cupom'}</DialogTitle>
            <DialogDescription>
              {editingCoupon ? 'Atualize as informações do cupom' : 'Crie um novo cupom de desconto'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Código *</Label>
              <div className="flex gap-2">
                <Input
                  id="code"
                  placeholder="PROMO10"
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  className="font-mono uppercase"
                  required
                />
                <Button type="button" variant="outline" onClick={generateCode}>
                  Gerar
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                placeholder="Descrição do cupom..."
                value={formData.description || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="discount_type">Tipo de desconto</Label>
                <Select 
                  value={formData.discount_type} 
                  onValueChange={(v: 'percentage' | 'fixed') => setFormData(prev => ({ ...prev, discount_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                    <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="discount_value">Valor do desconto *</Label>
                <Input
                  id="discount_value"
                  type="number"
                  min="0"
                  step={formData.discount_type === 'percentage' ? '1' : '0.01'}
                  value={formData.discount_value}
                  onChange={(e) => setFormData(prev => ({ ...prev, discount_value: parseFloat(e.target.value) || 0 }))}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minimum_order_value">Valor mínimo do pedido</Label>
                <Input
                  id="minimum_order_value"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.minimum_order_value || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, minimum_order_value: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maximum_discount">Desconto máximo (R$)</Label>
                <Input
                  id="maximum_discount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Sem limite"
                  value={formData.maximum_discount || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, maximum_discount: parseFloat(e.target.value) || undefined }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max_uses">Limite de usos total</Label>
                <Input
                  id="max_uses"
                  type="number"
                  min="1"
                  placeholder="Ilimitado"
                  value={formData.max_uses || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, max_uses: parseInt(e.target.value) || undefined }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_uses_per_customer">Usos por cliente</Label>
                <Input
                  id="max_uses_per_customer"
                  type="number"
                  min="1"
                  value={formData.max_uses_per_customer || 1}
                  onChange={(e) => setFormData(prev => ({ ...prev, max_uses_per_customer: parseInt(e.target.value) || 1 }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="starts_at">Data de início</Label>
                <Input
                  id="starts_at"
                  type="date"
                  value={formData.starts_at || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, starts_at: e.target.value || undefined }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expires_at">Data de expiração</Label>
                <Input
                  id="expires_at"
                  type="date"
                  value={formData.expires_at || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, expires_at: e.target.value || undefined }))}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="is_active" className="font-medium">Cupom ativo</Label>
                <p className="text-sm text-muted-foreground">
                  Cupons inativos não podem ser usados
                </p>
              </div>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="show_in_wheel" className="font-medium">Exibir na Roleta</Label>
                <p className="text-sm text-muted-foreground">
                  Mostrar este cupom na roleta de prêmios da loja
                </p>
              </div>
              <Switch
                id="show_in_wheel"
                checked={formData.show_in_wheel ?? false}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, show_in_wheel: checked }))}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : editingCoupon ? (
                  'Atualizar'
                ) : (
                  'Criar Cupom'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Cupom</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o cupom <strong>{deleteConfirm?.code}</strong>? 
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default Coupons;
