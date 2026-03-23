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
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Search, MoreHorizontal, Plus, Pencil, Trash2, 
  Loader2, Tag, Percent, DollarSign, Calendar,
  Copy, CheckCircle, Users, Truck, TrendingUp, MapPin
} from 'lucide-react';
import { toast } from 'sonner';
import { couponsService, Coupon, CreateCouponData, DiscountType, DISCOUNT_TYPE_LABELS, ProgressiveConfig, ProgressiveTier } from '@/services/coupons';
import { shippingService, ShippingZone } from '@/services/shipping';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const DEFAULT_PROGRESSIVE: ProgressiveConfig = {
  basis: 'quantity',
  tiers: [
    { min: 2, discount_type: 'percentage', discount_value: 5 },
    { min: 3, discount_type: 'percentage', discount_value: 10 },
    { min: 5, discount_type: 'percentage', discount_value: 15 },
  ],
};

const Coupons = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [shippingZones, setShippingZones] = useState<ShippingZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Coupon | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

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
    applicable_to_combos: false,
    progressive_tiers: null,
    applicable_shipping_zones: [],
  });

  useEffect(() => {
    loadCoupons();
    loadShippingZones();
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

  const loadShippingZones = async () => {
    try {
      const zones = await shippingService.getAll();
      setShippingZones(zones);
    } catch (error) {
      console.error('Error loading shipping zones:', error);
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
      applicable_to_combos: false,
      progressive_tiers: null,
      applicable_shipping_zones: [],
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
        show_in_wheel: coupon.show_in_wheel ?? false,
        applicable_to_combos: coupon.applicable_to_combos ?? false,
        progressive_tiers: coupon.progressive_tiers || null,
        applicable_shipping_zones: coupon.applicable_shipping_zones || [],
      });
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  };

  const handleDiscountTypeChange = (type: DiscountType) => {
    const updates: Partial<CreateCouponData> = { discount_type: type };
    if (type === 'free_shipping') {
      updates.discount_value = 0;
      updates.progressive_tiers = null;
    } else if (type === 'progressive') {
      updates.discount_value = 0;
      updates.progressive_tiers = formData.progressive_tiers || DEFAULT_PROGRESSIVE;
    } else {
      updates.progressive_tiers = null;
    }
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.code.trim()) {
      toast.error('Código do cupom é obrigatório');
      return;
    }

    const isShippingType = ['free_shipping', 'shipping_fixed', 'shipping_percentage'].includes(formData.discount_type);
    const isProgressive = formData.discount_type === 'progressive';

    if (!isShippingType && !isProgressive && formData.discount_value <= 0) {
      toast.error('Valor do desconto deve ser maior que zero');
      return;
    }

    if ((formData.discount_type === 'percentage' || formData.discount_type === 'shipping_percentage') && formData.discount_value > 100) {
      toast.error('Desconto percentual não pode ser maior que 100%');
      return;
    }

    if (isProgressive && formData.progressive_tiers) {
      const tiers = formData.progressive_tiers.tiers;
      if (tiers.length < 2) {
        toast.error('Desconto progressivo precisa de pelo menos 2 faixas');
        return;
      }
      for (const tier of tiers) {
        if (tier.min <= 0 || tier.discount_value <= 0) {
          toast.error('Todas as faixas devem ter valores maiores que zero');
          return;
        }
      }
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

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredCoupons.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCoupons.map(c => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    try {
      setIsSubmitting(true);
      await Promise.all(Array.from(selectedIds).map(id => couponsService.delete(id)));
      toast.success(`${selectedIds.size} cupons excluídos com sucesso!`);
      setSelectedIds(new Set());
      setBulkDeleteConfirm(false);
      loadCoupons();
    } catch (error) {
      console.error('Error bulk deleting coupons:', error);
      toast.error('Erro ao excluir cupons');
    } finally {
      setIsSubmitting(false);
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
    switch (coupon.discount_type) {
      case 'percentage':
        return `${coupon.discount_value}%`;
      case 'fixed':
        return `R$ ${coupon.discount_value.toFixed(2)}`;
      case 'free_shipping':
        return 'Frete Grátis';
      case 'shipping_fixed':
        return `R$ ${coupon.discount_value.toFixed(2)} no frete`;
      case 'shipping_percentage':
        return `${coupon.discount_value}% no frete`;
      case 'progressive':
        return 'Progressivo';
      default:
        return `${coupon.discount_value}`;
    }
  };

  const getDiscountIcon = (type: DiscountType) => {
    switch (type) {
      case 'percentage':
      case 'shipping_percentage':
        return <Percent className="h-4 w-4 text-primary" />;
      case 'free_shipping':
      case 'shipping_fixed':
        return <Truck className="h-4 w-4 text-primary" />;
      case 'progressive':
        return <TrendingUp className="h-4 w-4 text-primary" />;
      default:
        return <DollarSign className="h-4 w-4 text-primary" />;
    }
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

  // Progressive tiers helpers
  const updateTier = (index: number, field: keyof ProgressiveTier, value: any) => {
    if (!formData.progressive_tiers) return;
    const newTiers = [...formData.progressive_tiers.tiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    setFormData(prev => ({
      ...prev,
      progressive_tiers: { ...prev.progressive_tiers!, tiers: newTiers },
    }));
  };

  const addTier = () => {
    if (!formData.progressive_tiers) return;
    const tiers = formData.progressive_tiers.tiers;
    const lastMin = tiers.length > 0 ? tiers[tiers.length - 1].min + 1 : 1;
    const lastDiscount = tiers.length > 0 ? tiers[tiers.length - 1].discount_value + 5 : 5;
    setFormData(prev => ({
      ...prev,
      progressive_tiers: {
        ...prev.progressive_tiers!,
        tiers: [...tiers, { min: lastMin, discount_type: 'percentage', discount_value: lastDiscount }],
      },
    }));
  };

  const removeTier = (index: number) => {
    if (!formData.progressive_tiers) return;
    const newTiers = formData.progressive_tiers.tiers.filter((_, i) => i !== index);
    setFormData(prev => ({
      ...prev,
      progressive_tiers: { ...prev.progressive_tiers!, tiers: newTiers },
    }));
  };

  const isShippingType = ['free_shipping', 'shipping_fixed', 'shipping_percentage'].includes(formData.discount_type);
  const isProgressive = formData.discount_type === 'progressive';
  const needsDiscountValue = !['free_shipping', 'progressive'].includes(formData.discount_type);

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
              <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{coupons.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Ativos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{activeCoupons}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total de Usos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUses}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Inativos</CardTitle>
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
                    <TableHead>Tipo / Desconto</TableHead>
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
                            {getDiscountIcon(coupon.discount_type)}
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
                                <CheckCircle className="h-4 w-4 mr-2" />
                                {coupon.is_active ? 'Desativar' : 'Ativar'}
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCoupon ? 'Editar Cupom' : 'Novo Cupom'}</DialogTitle>
            <DialogDescription>
              {editingCoupon ? 'Atualize as informações do cupom' : 'Crie um novo cupom de desconto'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Code */}
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

            {/* Description */}
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

            {/* Discount Type */}
            <div className="space-y-2">
              <Label>Tipo de desconto</Label>
              <Select 
                value={formData.discount_type} 
                onValueChange={(v) => handleDiscountTypeChange(v as DiscountType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">
                    <span className="flex items-center gap-2"><Percent className="h-3.5 w-3.5" /> Porcentagem (%)</span>
                  </SelectItem>
                  <SelectItem value="fixed">
                    <span className="flex items-center gap-2"><DollarSign className="h-3.5 w-3.5" /> Valor fixo (R$)</span>
                  </SelectItem>
                  <SelectItem value="free_shipping">
                    <span className="flex items-center gap-2"><Truck className="h-3.5 w-3.5" /> Frete Grátis</span>
                  </SelectItem>
                  <SelectItem value="shipping_fixed">
                    <span className="flex items-center gap-2"><Truck className="h-3.5 w-3.5" /> Desconto fixo no frete (R$)</span>
                  </SelectItem>
                  <SelectItem value="shipping_percentage">
                    <span className="flex items-center gap-2"><Truck className="h-3.5 w-3.5" /> Desconto % no frete</span>
                  </SelectItem>
                  <SelectItem value="progressive">
                    <span className="flex items-center gap-2"><TrendingUp className="h-3.5 w-3.5" /> Desconto Progressivo</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Discount Value (hidden for free_shipping and progressive) */}
            {needsDiscountValue && (
              <div className="space-y-2">
                <Label htmlFor="discount_value">
                  {isShippingType ? 'Valor do desconto no frete *' : 'Valor do desconto *'}
                </Label>
                <Input
                  id="discount_value"
                  type="number"
                  min="0"
                  step={['percentage', 'shipping_percentage'].includes(formData.discount_type) ? '1' : '0.01'}
                  value={formData.discount_value}
                  onChange={(e) => setFormData(prev => ({ ...prev, discount_value: parseFloat(e.target.value) || 0 }))}
                  required
                />
              </div>
            )}

            {/* Shipping Zones Selector */}
            {isShippingType && shippingZones.length > 0 && (
              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <Label className="font-medium">Zonas de frete aplicáveis</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Selecione as zonas onde este cupom será válido. Deixe vazio para aplicar em todas as zonas.
                </p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {shippingZones.map(zone => (
                    <div key={zone.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`zone-${zone.id}`}
                        checked={(formData.applicable_shipping_zones || []).includes(zone.id)}
                        onCheckedChange={(checked) => {
                          setFormData(prev => {
                            const current = prev.applicable_shipping_zones || [];
                            const updated = checked
                              ? [...current, zone.id]
                              : current.filter(id => id !== zone.id);
                            return { ...prev, applicable_shipping_zones: updated };
                          });
                        }}
                      />
                      <Label htmlFor={`zone-${zone.id}`} className="text-sm cursor-pointer flex-1">
                        {zone.name}
                        <span className="text-xs text-muted-foreground ml-2">
                          ({zone.zip_start} — {zone.zip_end})
                        </span>
                      </Label>
                    </div>
                  ))}
                </div>
                {(formData.applicable_shipping_zones || []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(formData.applicable_shipping_zones || []).map(zoneId => {
                      const zone = shippingZones.find(z => z.id === zoneId);
                      return zone ? (
                        <Badge key={zoneId} variant="secondary" className="text-xs">
                          {zone.name}
                        </Badge>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Progressive Tiers Editor */}
            {isProgressive && formData.progressive_tiers && (
              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <Label className="font-medium">Faixas de Desconto</Label>
                  <Select
                    value={formData.progressive_tiers.basis}
                    onValueChange={(v) => setFormData(prev => ({
                      ...prev,
                      progressive_tiers: { ...prev.progressive_tiers!, basis: v as 'quantity' | 'order_value' },
                    }))}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quantity">Por quantidade de itens</SelectItem>
                      <SelectItem value="order_value">Por valor do pedido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  {formData.progressive_tiers.tiers.map((tier, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="flex-1">
                        <Input
                          type="number"
                          min="1"
                          step={formData.progressive_tiers!.basis === 'order_value' ? '0.01' : '1'}
                          value={tier.min}
                          onChange={(e) => updateTier(index, 'min', parseFloat(e.target.value) || 0)}
                          placeholder={formData.progressive_tiers!.basis === 'quantity' ? 'Qtd mín' : 'Valor mín'}
                        />
                      </div>
                      <span className="text-muted-foreground text-xs whitespace-nowrap">
                        {formData.progressive_tiers!.basis === 'quantity' ? 'itens →' : 'R$ →'}
                      </span>
                      <div className="w-20">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={tier.discount_value}
                          onChange={(e) => updateTier(index, 'discount_value', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <Select
                        value={tier.discount_type}
                        onValueChange={(v) => updateTier(index, 'discount_type', v)}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">%</SelectItem>
                          <SelectItem value="fixed">R$</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => removeTier(index)}
                        disabled={formData.progressive_tiers!.tiers.length <= 2}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Button type="button" variant="outline" size="sm" onClick={addTier} className="w-full">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar faixa
                </Button>

                <p className="text-xs text-muted-foreground">
                  {formData.progressive_tiers.basis === 'quantity'
                    ? 'O desconto será aplicado com base na quantidade total de itens no carrinho.'
                    : 'O desconto será aplicado com base no valor total do pedido.'}
                </p>
              </div>
            )}

            {/* Min order & Max discount */}
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
              {!isShippingType && (
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
              )}
            </div>

            {/* Usage limits */}
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

            {/* Dates */}
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

            {/* Toggles */}
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
                <Label htmlFor="applicable_to_combos" className="font-medium">Aplicável em Combos</Label>
                <p className="text-sm text-muted-foreground">
                  Permitir que este cupom seja usado junto com combos de produtos
                </p>
              </div>
              <Switch
                id="applicable_to_combos"
                checked={formData.applicable_to_combos ?? false}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, applicable_to_combos: checked }))}
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
