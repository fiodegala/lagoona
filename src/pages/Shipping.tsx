import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus, MoreHorizontal, Pencil, Trash2, Loader2, Truck, MapPin, Package,
} from 'lucide-react';
import { toast } from 'sonner';
import { shippingService, ShippingZone, CreateShippingZoneData } from '@/services/shipping';
import AdminShippingQuote from '@/components/AdminShippingQuote';

const Shipping = () => {
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<ShippingZone | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ShippingZone | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<CreateShippingZoneData>({
    name: '',
    zip_start: '',
    zip_end: '',
    base_price: 0,
    price_per_kg: 0,
    free_shipping_min_value: null,
    estimated_days_min: 3,
    estimated_days_max: 7,
    is_active: true,
  });

  useEffect(() => { loadZones(); }, []);

  const loadZones = async () => {
    try {
      setIsLoading(true);
      setZones(await shippingService.getAll());
    } catch (error) {
      console.error('Error loading shipping zones:', error);
      toast.error('Erro ao carregar zonas de frete');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '', zip_start: '', zip_end: '', base_price: 0,
      price_per_kg: 0, free_shipping_min_value: null,
      estimated_days_min: 3, estimated_days_max: 7, is_active: true,
    });
    setEditingZone(null);
  };

  const openModal = (zone?: ShippingZone) => {
    if (zone) {
      setEditingZone(zone);
      setFormData({
        name: zone.name,
        zip_start: zone.zip_start,
        zip_end: zone.zip_end,
        base_price: zone.base_price,
        price_per_kg: zone.price_per_kg,
        free_shipping_min_value: zone.free_shipping_min_value,
        estimated_days_min: zone.estimated_days_min,
        estimated_days_max: zone.estimated_days_max,
        is_active: zone.is_active,
      });
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error('Nome da zona é obrigatório'); return; }
    if (!formData.zip_start || !formData.zip_end) { toast.error('Faixa de CEP é obrigatória'); return; }

    setIsSubmitting(true);
    try {
      if (editingZone) {
        await shippingService.update(editingZone.id, formData);
        toast.success('Zona de frete atualizada!');
      } else {
        await shippingService.create(formData);
        toast.success('Zona de frete criada!');
      }
      setIsModalOpen(false);
      resetForm();
      loadZones();
    } catch (error) {
      console.error('Error saving shipping zone:', error);
      toast.error('Erro ao salvar zona de frete');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      setIsSubmitting(true);
      await shippingService.delete(deleteConfirm.id);
      toast.success('Zona de frete excluída!');
      setDeleteConfirm(null);
      loadZones();
    } catch (error) {
      console.error('Error deleting zone:', error);
      toast.error('Erro ao excluir zona');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (zone: ShippingZone) => {
    try {
      await shippingService.toggleActive(zone.id, !zone.is_active);
      setZones(prev => prev.map(z => z.id === zone.id ? { ...z, is_active: !z.is_active } : z));
      toast.success(zone.is_active ? 'Zona desativada' : 'Zona ativada');
    } catch (error) {
      toast.error('Erro ao atualizar zona');
    }
  };

  const formatCep = (v: string) => {
    const clean = v.replace(/\D/g, '').slice(0, 8);
    return clean.length > 5 ? `${clean.slice(0, 5)}-${clean.slice(5)}` : clean;
  };

  const activeZones = zones.filter(z => z.is_active).length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Frete</h1>
            <p className="text-muted-foreground">Configure zonas de frete por faixa de CEP</p>
          </div>
          <Button onClick={() => openModal()}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Zona
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total de Zonas</CardTitle>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{zones.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Ativas</CardTitle>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-success">{activeZones}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Inativas</CardTitle>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold text-muted-foreground">{zones.length - activeZones}</div></CardContent>
          </Card>
        </div>

        <AdminShippingQuote />

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : zones.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Truck className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">Nenhuma zona de frete configurada</p>
                <Button variant="outline" className="mt-4" onClick={() => openModal()}>
                  <Plus className="h-4 w-4 mr-2" /> Criar primeira zona
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zona</TableHead>
                    <TableHead>Faixa de CEP</TableHead>
                    <TableHead>Preço Base</TableHead>
                    <TableHead>Por Kg</TableHead>
                    <TableHead>Frete Grátis</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {zones.map(zone => (
                    <TableRow key={zone.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{zone.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="bg-muted px-2 py-1 rounded text-sm">
                          {formatCep(zone.zip_start)} — {formatCep(zone.zip_end)}
                        </code>
                      </TableCell>
                      <TableCell className="font-medium">R$ {zone.base_price.toFixed(2)}</TableCell>
                      <TableCell>
                        {zone.price_per_kg > 0 ? `R$ ${zone.price_per_kg.toFixed(2)}` : '—'}
                      </TableCell>
                      <TableCell>
                        {zone.free_shipping_min_value != null
                          ? <span className="text-success font-medium">Acima de R$ {zone.free_shipping_min_value.toFixed(2)}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          {zone.estimated_days_min === zone.estimated_days_max
                            ? `${zone.estimated_days_min} dias`
                            : `${zone.estimated_days_min}-${zone.estimated_days_max} dias`}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={zone.is_active ? 'default' : 'secondary'}>
                          {zone.is_active ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openModal(zone)}>
                              <Pencil className="h-4 w-4 mr-2" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleActive(zone)}>
                              {zone.is_active ? 'Desativar' : 'Ativar'}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteConfirm(zone)}>
                              <Trash2 className="h-4 w-4 mr-2" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
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
            <DialogTitle>{editingZone ? 'Editar Zona de Frete' : 'Nova Zona de Frete'}</DialogTitle>
            <DialogDescription>
              {editingZone ? 'Atualize as configurações da zona' : 'Configure uma nova faixa de CEP para cálculo de frete'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da zona *</Label>
              <Input
                id="name"
                placeholder="Ex: São Paulo Capital"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="zip_start">CEP inicial *</Label>
                <Input
                  id="zip_start"
                  placeholder="00000-000"
                  value={formatCep(formData.zip_start)}
                  onChange={e => setFormData(prev => ({ ...prev, zip_start: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip_end">CEP final *</Label>
                <Input
                  id="zip_end"
                  placeholder="99999-999"
                  value={formatCep(formData.zip_end)}
                  onChange={e => setFormData(prev => ({ ...prev, zip_end: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="base_price">Preço base (R$) *</Label>
                <Input
                  id="base_price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.base_price}
                  onChange={e => setFormData(prev => ({ ...prev, base_price: parseFloat(e.target.value) || 0 }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price_per_kg">Preço por kg (R$)</Label>
                <Input
                  id="price_per_kg"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.price_per_kg || ''}
                  onChange={e => setFormData(prev => ({ ...prev, price_per_kg: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="free_shipping_min_value">Frete grátis acima de (R$)</Label>
              <Input
                id="free_shipping_min_value"
                type="number"
                min="0"
                step="0.01"
                placeholder="Deixe vazio para desativar"
                value={formData.free_shipping_min_value ?? ''}
                onChange={e => {
                  const val = e.target.value;
                  setFormData(prev => ({
                    ...prev,
                    free_shipping_min_value: val === '' ? null : parseFloat(val) || 0,
                  }));
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="estimated_days_min">Prazo mínimo (dias)</Label>
                <Input
                  id="estimated_days_min"
                  type="number"
                  min="1"
                  value={formData.estimated_days_min}
                  onChange={e => setFormData(prev => ({ ...prev, estimated_days_min: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimated_days_max">Prazo máximo (dias)</Label>
                <Input
                  id="estimated_days_max"
                  type="number"
                  min="1"
                  value={formData.estimated_days_max}
                  onChange={e => setFormData(prev => ({ ...prev, estimated_days_max: parseInt(e.target.value) || 1 }))}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="is_active" className="font-medium">Zona ativa</Label>
                <p className="text-sm text-muted-foreground">Zonas inativas não são usadas no cálculo</p>
              </div>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={checked => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
                  : editingZone ? 'Atualizar' : 'Criar Zona'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Zona de Frete</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a zona <strong>{deleteConfirm?.name}</strong>? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
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

export default Shipping;
