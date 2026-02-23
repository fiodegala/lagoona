import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Plus, Trash2, X, Loader2, Wand2, PlusCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  variationsService,
  ProductAttribute,
  ProductVariation,
} from '@/services/variations';
import VariationRow from './VariationRow';
import ManualVariationModal from './ManualVariationModal';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

interface StoreInfo {
  id: string;
  name: string;
  type: string;
}

interface ProductVariationsEditorProps {
  productId: string;
  basePrice: number;
}

const ProductVariationsEditor = ({ productId, basePrice }: ProductVariationsEditorProps) => {
  const [attributes, setAttributes] = useState<ProductAttribute[]>([]);
  const [variations, setVariations] = useState<ProductVariation[]>([]);
  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [storeStockMap, setStoreStockMap] = useState<Record<string, Record<string, number>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // New attribute form
  const [newAttrName, setNewAttrName] = useState('');
  const [newAttrValues, setNewAttrValues] = useState('');

  // New value for existing attribute
  const [addingValueTo, setAddingValueTo] = useState<string | null>(null);
  const [newValueInput, setNewValueInput] = useState('');

  // Manual variation modal
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [attrs, vars, storesRes] = await Promise.all([
        variationsService.getAttributesByProduct(productId),
        variationsService.getVariationsByProduct(productId),
        supabase.from('stores').select('id, name, type').eq('is_active', true).order('name'),
      ]);
      setAttributes(attrs);
      setVariations(vars);

      const physicalStores = (storesRes.data || []).filter((s) => s.type === 'physical') as StoreInfo[];
      setStores(physicalStores);

      // Load store_stock for all variations
      if (vars.length > 0 && physicalStores.length > 0) {
        const { data: stockData } = await supabase
          .from('store_stock')
          .select('store_id, variation_id, quantity')
          .eq('product_id', productId)
          .not('variation_id', 'is', null);

        const stockMap: Record<string, Record<string, number>> = {};
        (stockData || []).forEach((s) => {
          if (s.variation_id) {
            if (!stockMap[s.variation_id]) stockMap[s.variation_id] = {};
            stockMap[s.variation_id][s.store_id] = s.quantity;
          }
        });
        setStoreStockMap(stockMap);
      }
    } catch (error) {
      console.error('Error loading variations data:', error);
      toast.error('Erro ao carregar variações');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (productId) {
      loadData();
    }
  }, [productId]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = variations.findIndex((v) => v.id === active.id);
      const newIndex = variations.findIndex((v) => v.id === over.id);

      const newVariations = arrayMove(variations, oldIndex, newIndex);
      setVariations(newVariations);

      // Persist the new order
      try {
        await variationsService.reorderVariations(newVariations.map((v) => v.id));
        toast.success('Ordem atualizada');
      } catch (error) {
        console.error('Error reordering variations:', error);
        toast.error('Erro ao reordenar variações');
        // Revert on error
        await loadData();
      }
    }
  };

  const handleAddAttribute = async () => {
    if (!newAttrName.trim()) {
      toast.error('Nome do atributo é obrigatório');
      return;
    }

    const values = newAttrValues
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v);

    if (values.length === 0) {
      toast.error('Adicione pelo menos um valor');
      return;
    }

    setIsSaving(true);
    try {
      await variationsService.createAttribute({
        product_id: productId,
        name: newAttrName.trim(),
        values,
      });
      toast.success('Atributo adicionado');
      setNewAttrName('');
      setNewAttrValues('');
      await loadData();
    } catch (error) {
      console.error('Error creating attribute:', error);
      toast.error('Erro ao criar atributo');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAttribute = async (attributeId: string) => {
    try {
      await variationsService.deleteAttribute(attributeId);
      toast.success('Atributo removido');
      await loadData();
    } catch (error) {
      console.error('Error deleting attribute:', error);
      toast.error('Erro ao remover atributo');
    }
  };

  const handleAddValue = async (attributeId: string) => {
    if (!newValueInput.trim()) return;

    try {
      await variationsService.addAttributeValue(attributeId, newValueInput.trim());
      toast.success('Valor adicionado');
      setNewValueInput('');
      setAddingValueTo(null);
      await loadData();
    } catch (error) {
      console.error('Error adding value:', error);
      toast.error('Erro ao adicionar valor');
    }
  };

  const handleDeleteValue = async (valueId: string) => {
    try {
      await variationsService.deleteAttributeValue(valueId);
      toast.success('Valor removido');
      await loadData();
    } catch (error) {
      console.error('Error deleting value:', error);
      toast.error('Erro ao remover valor');
    }
  };

  const handleGenerateVariations = async () => {
    const combinations = variationsService.generateCombinations(attributes);

    if (combinations.length === 0) {
      toast.error('Adicione atributos com valores primeiro');
      return;
    }

    if (combinations.length > 100) {
      toast.error('Muitas combinações. Reduza os valores dos atributos.');
      return;
    }

    setIsSaving(true);
    try {
      for (const combo of combinations) {
        // Check if variation already exists
        const exists = variations.some((v) => {
          const existingValues = (v.attribute_values || []).map((av) => av.value).sort();
          const newValues = combo.values.map((cv) => cv.value).sort();
          return JSON.stringify(existingValues) === JSON.stringify(newValues);
        });

        if (!exists) {
          await variationsService.createVariation({
            product_id: productId,
            price: basePrice,
            stock: 0,
            attribute_value_ids: combo.values.map((v) => v.id),
          });
        }
      }
      toast.success('Variações geradas com sucesso!');
      await loadData();
    } catch (error) {
      console.error('Error generating variations:', error);
      toast.error('Erro ao gerar variações');
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualVariation = async (data: {
    attributeValueIds: string[];
    sku?: string;
    barcode?: string;
    price?: number;
    wholesale_price?: number;
    exclusive_price?: number;
    stock?: number;
  }) => {
    // Check if variation already exists
    const existingValueIds = variations.map((v) =>
      (v.attribute_values || [])
        .map((av) => {
          // Find the attribute value ID from our attributes
          for (const attr of attributes) {
            const found = attr.values?.find((val) => val.value === av.value);
            if (found) return found.id;
          }
          return '';
        })
        .filter(Boolean)
        .sort()
    );

    const newValueIds = [...data.attributeValueIds].sort();
    const alreadyExists = existingValueIds.some(
      (existing) => JSON.stringify(existing) === JSON.stringify(newValueIds)
    );

    if (alreadyExists) {
      toast.error('Esta combinação já existe');
      throw new Error('Combination already exists');
    }

    await variationsService.createVariation({
      product_id: productId,
      sku: data.sku,
      barcode: data.barcode,
      price: data.price ?? basePrice,
      wholesale_price: data.wholesale_price,
      exclusive_price: data.exclusive_price,
      stock: data.stock ?? 0,
      attribute_value_ids: data.attributeValueIds,
    });

    toast.success('Variação adicionada!');
    await loadData();
  };

  const handleUpdateVariation = async (
    variationId: string,
    field: 'price' | 'wholesale_price' | 'exclusive_price' | 'stock' | 'sku' | 'barcode' | 'is_active' | 'image_url',
    value: string | number | boolean
  ) => {
    try {
      await variationsService.updateVariation(variationId, { [field]: value });
      setVariations((prev) =>
        prev.map((v) => (v.id === variationId ? { ...v, [field]: value } : v))
      );
    } catch (error) {
      console.error('Error updating variation:', error);
      toast.error('Erro ao atualizar variação');
    }
  };

  const handleUpdateStoreStock = async (variationId: string, storeId: string, quantity: number) => {
    try {
      const { error } = await supabase
        .from('store_stock')
        .upsert(
          {
            store_id: storeId,
            product_id: productId,
            variation_id: variationId,
            quantity,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'store_id,product_id,variation_id' }
        );

      if (error) throw error;

      setStoreStockMap((prev) => ({
        ...prev,
        [variationId]: {
          ...(prev[variationId] || {}),
          [storeId]: quantity,
        },
      }));
    } catch (error) {
      console.error('Error updating store stock:', error);
      toast.error('Erro ao atualizar estoque');
    }
  };

  const handleDeleteVariation = async (variationId: string) => {
    try {
      await variationsService.deleteVariation(variationId);
      toast.success('Variação removida');
      setVariations((prev) => prev.filter((v) => v.id !== variationId));
    } catch (error) {
      console.error('Error deleting variation:', error);
      toast.error('Erro ao remover variação');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Attributes Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Atributos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {attributes.map((attr) => (
            <div key={attr.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-medium">{attr.name}</Label>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover atributo?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Isso também removerá todas as variações associadas.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDeleteAttribute(attr.id)}
                        className="bg-destructive text-destructive-foreground"
                      >
                        Remover
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <div className="flex flex-wrap gap-2">
                {attr.values?.map((val) => (
                  <Badge key={val.id} variant="secondary" className="gap-1 pr-1">
                    {val.value}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 hover:bg-transparent"
                      onClick={() => handleDeleteValue(val.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
                {addingValueTo === attr.id ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={newValueInput}
                      onChange={(e) => setNewValueInput(e.target.value)}
                      placeholder="Novo valor"
                      className="h-6 w-24 text-xs"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddValue(attr.id)}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => handleAddValue(attr.id)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => {
                        setAddingValueTo(null);
                        setNewValueInput('');
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => setAddingValueTo(attr.id)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Adicionar
                  </Button>
                )}
              </div>
            </div>
          ))}

          {/* Add new attribute */}
          <div className="border-t pt-4 space-y-3">
            <Label className="text-sm text-muted-foreground">Novo Atributo</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Ex: Cor"
                value={newAttrName}
                onChange={(e) => setNewAttrName(e.target.value)}
                className="w-32"
              />
              <Input
                placeholder="Valores separados por vírgula (ex: Azul, Vermelho)"
                value={newAttrValues}
                onChange={(e) => setNewAttrValues(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleAddAttribute} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Variations Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Variações ({variations.length})</CardTitle>
            {attributes.length > 0 && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={() => setIsManualModalOpen(true)}
                >
                  <PlusCircle className="h-4 w-4" />
                  Adicionar Manual
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={handleGenerateVariations}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4" />
                  )}
                  Gerar Combinações
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {variations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma variação criada. Adicione atributos e clique em "Gerar Combinações".
            </p>
          ) : (
            <div className="overflow-x-scroll scrollbar-always-visible">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Variação</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Código de Barras</TableHead>
                      <TableHead>Varejo</TableHead>
                      <TableHead>Atacado</TableHead>
                      <TableHead>Exclusivo</TableHead>
                      {stores.map((store) => (
                        <TableHead key={store.id}>{store.name}</TableHead>
                      ))}
                      <TableHead>Ativo</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <SortableContext
                      items={variations.map((v) => v.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {variations.map((variation) => (
                        <VariationRow
                          key={variation.id}
                          variation={variation}
                          stores={stores}
                          storeStock={storeStockMap[variation.id] || {}}
                          onUpdate={handleUpdateVariation}
                          onUpdateStoreStock={handleUpdateStoreStock}
                          onDelete={handleDeleteVariation}
                        />
                      ))}
                    </SortableContext>
                  </TableBody>
                </Table>
              </DndContext>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Variation Modal */}
      <ManualVariationModal
        open={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onConfirm={handleManualVariation}
        attributes={attributes}
        basePrice={basePrice}
      />
    </div>
  );
};

export default ProductVariationsEditor;
