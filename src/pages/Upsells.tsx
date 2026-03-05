import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Loader2, Pencil, ArrowUpDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { productsService, Product } from '@/services/products';
import { toast } from 'sonner';

interface UpsellRule {
  id: string;
  product_id: string;
  upsell_product_id: string;
  sort_order: number;
  discount_percent: number;
  is_active: boolean;
  created_at: string;
  product?: Product;
  upsell_product?: Product;
}

const Upsells = () => {
  const [rules, setRules] = useState<UpsellRule[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingRule, setEditingRule] = useState<UpsellRule | null>(null);
  const [filterProduct, setFilterProduct] = useState<string>('all');

  // Form state
  const [formProductId, setFormProductId] = useState('');
  const [formUpsellProductId, setFormUpsellProductId] = useState('');
  const [formDiscount, setFormDiscount] = useState('5');
  const [formSortOrder, setFormSortOrder] = useState('0');
  const [formIsActive, setFormIsActive] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [prods, rulesRes] = await Promise.all([
        productsService.getAll(),
        supabase.from('product_upsells').select('*').order('sort_order'),
      ]);
      setProducts(prods);

      const prodMap = new Map(prods.map(p => [p.id, p]));
      const enriched = (rulesRes.data || []).map((r: any) => ({
        ...r,
        product: prodMap.get(r.product_id),
        upsell_product: prodMap.get(r.upsell_product_id),
      }));
      setRules(enriched);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const openCreate = () => {
    setEditingRule(null);
    setFormProductId('');
    setFormUpsellProductId('');
    setFormDiscount('5');
    setFormSortOrder('0');
    setFormIsActive(true);
    setModalOpen(true);
  };

  const openEdit = (rule: UpsellRule) => {
    setEditingRule(rule);
    setFormProductId(rule.product_id);
    setFormUpsellProductId(rule.upsell_product_id);
    setFormDiscount(String(rule.discount_percent));
    setFormSortOrder(String(rule.sort_order));
    setFormIsActive(rule.is_active);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formProductId || !formUpsellProductId) {
      return toast.error('Selecione os dois produtos');
    }
    if (formProductId === formUpsellProductId) {
      return toast.error('O produto não pode ser upsell dele mesmo');
    }

    setSaving(true);
    try {
      const payload = {
        product_id: formProductId,
        upsell_product_id: formUpsellProductId,
        discount_percent: parseFloat(formDiscount) || 5,
        sort_order: parseInt(formSortOrder) || 0,
        is_active: formIsActive,
        updated_at: new Date().toISOString(),
      };

      if (editingRule) {
        const { error } = await supabase.from('product_upsells').update(payload).eq('id', editingRule.id);
        if (error) throw error;
        toast.success('Upsell atualizado');
      } else {
        const { error } = await supabase.from('product_upsells').insert(payload);
        if (error) throw error;
        toast.success('Upsell criado');
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error(err);
      if (err.code === '23505') {
        toast.error('Essa combinação de produtos já existe');
      } else {
        toast.error('Erro ao salvar');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este upsell?')) return;
    const { error } = await supabase.from('product_upsells').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir');
    } else {
      toast.success('Upsell excluído');
      loadData();
    }
  };

  const handleToggle = async (id: string, active: boolean) => {
    const { error } = await supabase.from('product_upsells').update({ is_active: active, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) {
      toast.error('Erro ao atualizar');
    } else {
      setRules(prev => prev.map(r => r.id === id ? { ...r, is_active: active } : r));
    }
  };

  const filtered = filterProduct === 'all' ? rules : rules.filter(r => r.product_id === filterProduct);

  const formatPrice = (p: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p);

  // Get unique products that have upsell rules
  const productsWithRules = [...new Set(rules.map(r => r.product_id))];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Compre Junto (Upsell)</h1>
            <p className="text-muted-foreground text-sm">
              Gerencie os produtos sugeridos na seção "Compre junto" das páginas de produto
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Upsell
          </Button>
        </div>

        {/* Filter */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Label className="whitespace-nowrap text-sm">Filtrar por produto:</Label>
              <Select value={filterProduct} onValueChange={setFilterProduct}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue placeholder="Todos os produtos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os produtos</SelectItem>
                  {productsWithRules.map(pid => {
                    const p = products.find(pr => pr.id === pid);
                    return p ? (
                      <SelectItem key={pid} value={pid}>{p.name}</SelectItem>
                    ) : null;
                  })}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ArrowUpDown className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="font-medium">Nenhum upsell configurado</p>
                <p className="text-sm">Clique em "Novo Upsell" para começar</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto Principal</TableHead>
                    <TableHead>Produto Sugerido</TableHead>
                    <TableHead className="text-center">Desconto</TableHead>
                    <TableHead className="text-center">Ordem</TableHead>
                    <TableHead className="text-center">Ativo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(rule => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {rule.product?.image_url && (
                            <img src={rule.product.image_url} alt="" className="w-8 h-8 rounded object-cover" />
                          )}
                          <span className="text-sm font-medium line-clamp-1">{rule.product?.name || 'Produto removido'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {rule.upsell_product?.image_url && (
                            <img src={rule.upsell_product.image_url} alt="" className="w-8 h-8 rounded object-cover" />
                          )}
                          <div>
                            <span className="text-sm font-medium line-clamp-1">{rule.upsell_product?.name || 'Produto removido'}</span>
                            {rule.upsell_product && (
                              <span className="text-xs text-muted-foreground block">{formatPrice(rule.upsell_product.price)}</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{rule.discount_percent}%</Badge>
                      </TableCell>
                      <TableCell className="text-center text-sm">{rule.sort_order}</TableCell>
                      <TableCell className="text-center">
                        <Switch checked={rule.is_active} onCheckedChange={v => handleToggle(rule.id, v)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(rule)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.id)} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Editar Upsell' : 'Novo Upsell'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Produto Principal</Label>
              <Select value={formProductId} onValueChange={setFormProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o produto" />
                </SelectTrigger>
                <SelectContent>
                  {products.filter(p => p.is_active).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Produto Sugerido (Upsell)</Label>
              <Select value={formUpsellProductId} onValueChange={setFormUpsellProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o produto sugerido" />
                </SelectTrigger>
                <SelectContent>
                  {products.filter(p => p.is_active && p.id !== formProductId).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Desconto (%)</Label>
                <Input type="number" value={formDiscount} onChange={e => setFormDiscount(e.target.value)} min="0" max="100" />
              </div>
              <div className="space-y-2">
                <Label>Ordem</Label>
                <Input type="number" value={formSortOrder} onChange={e => setFormSortOrder(e.target.value)} min="0" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={formIsActive} onCheckedChange={setFormIsActive} />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingRule ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default Upsells;
