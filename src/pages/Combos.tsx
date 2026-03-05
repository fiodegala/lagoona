import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Trash2, Edit, Package, Truck, Loader2, X, ImageIcon } from 'lucide-react';
import ImageUpload from '@/components/ImageUpload';
import { toast } from 'sonner';
import { combosService, Combo } from '@/services/combos';
import { supabase } from '@/integrations/supabase/client';

interface ProductOption {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  variations: {
    id: string;
    price: number | null;
    label: string;
  }[];
}

interface ComboFormItem {
  product_id: string;
  variation_id: string | null;
  quantity: number;
  productName?: string;
  variationLabel?: string;
  unitPrice?: number;
}

const Combos = () => {
  const [combos, setCombos] = useState<Combo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCombo, setEditingCombo] = useState<Combo | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [comboPrice, setComboPrice] = useState('');
  const [comboImageUrl, setComboImageUrl] = useState<string | undefined>(undefined);
  const [freeShipping, setFreeShipping] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [formItems, setFormItems] = useState<ComboFormItem[]>([]);

  // Product selector
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);

  const loadCombos = async () => {
    try {
      setLoading(true);
      const data = await combosService.list();
      
      // Load items for each combo
      const combosWithItems = await Promise.all(
        data.map(async (combo) => {
          const full = await combosService.getWithItems(combo.id);
          return full || combo;
        })
      );
      setCombos(combosWithItems);
    } catch (err) {
      toast.error('Erro ao carregar combos');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      setProductsLoading(true);
      const { data: prods } = await supabase
        .from('products')
        .select('id, name, price, image_url')
        .eq('is_active', true)
        .order('name');

      if (!prods) return;

      const productOptions: ProductOption[] = [];
      for (const prod of prods) {
        const { data: vars } = await supabase
          .from('product_variations')
          .select(`
            id, price,
            product_variation_values (
              attribute_value_id,
              product_attribute_values:attribute_value_id (
                value,
                product_attributes:attribute_id ( name )
              )
            )
          `)
          .eq('product_id', prod.id)
          .eq('is_active', true);

        const variations = (vars || []).map((v: any) => {
          const labels = (v.product_variation_values || [])
            .map((pvv: any) => pvv.product_attribute_values?.value)
            .filter(Boolean);
          return {
            id: v.id,
            price: v.price,
            label: labels.join(' / ') || 'Variação',
          };
        });

        productOptions.push({
          id: prod.id,
          name: prod.name,
          price: prod.price,
          image_url: prod.image_url,
          variations,
        });
      }

      setProducts(productOptions);
    } catch {
      toast.error('Erro ao carregar produtos');
    } finally {
      setProductsLoading(false);
    }
  };

  useEffect(() => {
    loadCombos();
  }, []);

  const resetForm = () => {
    setName('');
    setDescription('');
    setComboPrice('');
    setComboImageUrl(undefined);
    setFreeShipping(false);
    setIsActive(true);
    setFormItems([]);
    setEditingCombo(null);
  };

  const openCreateModal = () => {
    resetForm();
    loadProducts();
    setModalOpen(true);
  };

  const openEditModal = async (combo: Combo) => {
    setEditingCombo(combo);
    setName(combo.name);
    setDescription(combo.description || '');
    setComboPrice(String(combo.combo_price));
    setComboImageUrl(combo.image_url || undefined);
    setFreeShipping(combo.free_shipping);
    setIsActive(combo.is_active);

    await loadProducts();

    // Load items with product info
    if (combo.items) {
      const items: ComboFormItem[] = combo.items.map((item) => ({
        product_id: item.product_id,
        variation_id: item.variation_id,
        quantity: item.quantity,
      }));
      setFormItems(items);
    }

    setModalOpen(true);
  };

  const addItem = () => {
    setFormItems([...formItems, { product_id: '', variation_id: null, quantity: 1 }]);
  };

  const removeItem = (index: number) => {
    setFormItems(formItems.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof ComboFormItem, value: any) => {
    const updated = [...formItems];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'product_id') {
      updated[index].variation_id = null;
    }
    setFormItems(updated);
  };

  const getOriginalTotal = () => {
    return formItems.reduce((total, item) => {
      const product = products.find(p => p.id === item.product_id);
      if (!product) return total;
      const variation = product.variations.find(v => v.id === item.variation_id);
      const price = variation?.price ?? product.price;
      return total + price * item.quantity;
    }, 0);
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);

  const handleSave = async () => {
    if (!name.trim()) return toast.error('Informe o nome do combo');
    if (!comboPrice || Number(comboPrice) <= 0) return toast.error('Informe o preço do combo');
    const totalQty = formItems.reduce((sum, i) => sum + i.quantity, 0);
    if (totalQty < 2) return toast.error('O combo precisa ter pelo menos 2 unidades no total');
    if (formItems.some(i => !i.product_id)) return toast.error('Selecione todos os produtos');

    try {
      setSaving(true);
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        combo_price: Number(comboPrice),
        free_shipping: freeShipping,
        image_url: comboImageUrl || undefined,
        is_active: isActive,
        items: formItems.map(i => ({
          product_id: i.product_id,
          variation_id: i.variation_id || null,
          quantity: i.quantity,
        })),
      };

      if (editingCombo) {
        await combosService.update(editingCombo.id, payload);
        toast.success('Combo atualizado!');
      } else {
        await combosService.create(payload);
        toast.success('Combo criado!');
      }

      setModalOpen(false);
      resetForm();
      loadCombos();
    } catch {
      toast.error('Erro ao salvar combo');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este combo?')) return;
    try {
      await combosService.delete(id);
      toast.success('Combo excluído');
      loadCombos();
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  const handleToggleActive = async (combo: Combo) => {
    try {
      await combosService.toggleActive(combo.id, !combo.is_active);
      toast.success(combo.is_active ? 'Combo desativado' : 'Combo ativado');
      loadCombos();
    } catch {
      toast.error('Erro ao alterar status');
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Combos de Produtos</h1>
            <p className="text-muted-foreground">
              Crie combos com desconto automático para seus clientes
            </p>
          </div>
          <Button onClick={openCreateModal} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Combo
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : combos.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="font-semibold text-lg mb-1">Nenhum combo cadastrado</h3>
              <p className="text-muted-foreground text-sm">
                Crie combos de produtos para oferecer descontos automáticos.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Preço Combo</TableHead>
                  <TableHead>Frete Grátis</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {combos.map(combo => (
                  <TableRow key={combo.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{combo.name}</p>
                        {combo.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {combo.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {combo.items?.length || 0} produtos
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-primary">
                      {formatPrice(combo.combo_price)}
                    </TableCell>
                    <TableCell>
                      {combo.free_shipping ? (
                        <Badge variant="default" className="gap-1">
                          <Truck className="h-3 w-3" /> Grátis
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">Não</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={combo.is_active}
                        onCheckedChange={() => handleToggleActive(combo)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditModal(combo)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => handleDelete(combo.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) { setModalOpen(false); resetForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCombo ? 'Editar Combo' : 'Novo Combo'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Nome do Combo *</Label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ex: Kit Verão Completo"
                />
              </div>

              <div className="col-span-2">
                <Label>Descrição</Label>
                <Textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Descrição opcional do combo"
                  rows={2}
                />
              </div>

              <div className="col-span-2">
                <Label>Imagem do Combo</Label>
                <ImageUpload
                  value={comboImageUrl}
                  onChange={setComboImageUrl}
                  bucket="product-images"
                  folder="combos"
                />
              </div>

              <div>
                <Label>Preço do Combo (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={comboPrice}
                  onChange={e => setComboPrice(e.target.value)}
                  placeholder="150.00"
                />
              </div>

              <div className="flex items-end gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={freeShipping} onCheckedChange={setFreeShipping} />
                  <Label className="flex items-center gap-1">
                    <Truck className="h-4 w-4" /> Frete Grátis
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                  <Label>Ativo</Label>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-semibold">Produtos do Combo</Label>
                <Button variant="outline" size="sm" onClick={addItem} disabled={productsLoading}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar Produto
                </Button>
              </div>

              {formItems.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm border rounded-md border-dashed">
                  Adicione produtos ao combo (mínimo 2 unidades no total — pode ser o mesmo produto)
                </div>
              ) : (
                <div className="space-y-3">
                  {formItems.map((item, index) => {
                    const selectedProduct = products.find(p => p.id === item.product_id);
                    return (
                      <div key={index} className="flex gap-2 items-start p-3 border rounded-md bg-muted/30">
                        <div className="flex-1 space-y-2">
                          <Select
                            value={item.product_id || undefined}
                            onValueChange={(val) => updateItem(index, 'product_id', val)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um produto" />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map(p => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name} - {formatPrice(p.price)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {selectedProduct && selectedProduct.variations.length > 0 && (
                            <Select
                              value={item.variation_id || 'any'}
                              onValueChange={(val) => updateItem(index, 'variation_id', val === 'any' ? null : val)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Qualquer variação" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="any">Qualquer variação</SelectItem>
                                {selectedProduct.variations.map(v => (
                                  <SelectItem key={v.id} value={v.id}>
                                    {v.label} {v.price ? `- ${formatPrice(v.price)}` : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>

                        <div className="w-20">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={e => updateItem(index, 'quantity', Math.max(1, Number(e.target.value)))}
                            className="text-center"
                          />
                          <span className="text-xs text-muted-foreground">Qtd</span>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive shrink-0 mt-1"
                          onClick={() => removeItem(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {formItems.length >= 2 && comboPrice && (
                <div className="mt-4 p-3 bg-muted rounded-md space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Preço original:</span>
                    <span className="line-through">{formatPrice(getOriginalTotal())}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold">
                    <span>Preço combo:</span>
                    <span className="text-primary">{formatPrice(Number(comboPrice))}</span>
                  </div>
                  {getOriginalTotal() > Number(comboPrice) && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Economia:</span>
                      <span>{formatPrice(getOriginalTotal() - Number(comboPrice))} ({Math.round(((getOriginalTotal() - Number(comboPrice)) / getOriginalTotal()) * 100)}%)</span>
                    </div>
                  )}
                  {freeShipping && (
                    <div className="flex items-center gap-1 text-sm text-green-600">
                      <Truck className="h-3 w-3" /> + Frete Grátis
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setModalOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingCombo ? 'Salvar' : 'Criar Combo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default Combos;
