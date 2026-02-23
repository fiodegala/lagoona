import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Package, Layers, Weight, Warehouse } from 'lucide-react';
import { toast } from 'sonner';
import { productsService, categoriesService, Product, Category, CreateProductData } from '@/services/products';
import { variationsService } from '@/services/variations';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import ImageUpload from './ImageUpload';
import MultiImageUpload from './MultiImageUpload';
import ProductVariationsEditor from './ProductVariationsEditor';

interface StoreInfo {
  id: string;
  name: string;
  type: string;
}

interface ProductFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product?: Product | null;
}

const ProductFormModal = ({ open, onClose, onSuccess, product }: ProductFormModalProps) => {
  const { isAdmin, userStoreId } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeTab, setActiveTab] = useState('details');
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('0');
  const [categoryId, setCategoryId] = useState<string>('none');
  const [imageUrl, setImageUrl] = useState('');
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [productType, setProductType] = useState<'simple' | 'variable'>('simple');
  const [hasVariations, setHasVariations] = useState(false);
  const [barcode, setBarcode] = useState('');
  
  // Shipping fields
  const [weightKg, setWeightKg] = useState('');
  const [widthCm, setWidthCm] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [depthCm, setDepthCm] = useState('');

  // Store stock fields
  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [storeStockQty, setStoreStockQty] = useState<Record<string, string>>({});

  // Auto-created product for variable products
  const [autoCreatedProductId, setAutoCreatedProductId] = useState<string | null>(null);

  const isEditing = !!product;
  const effectiveProductId = product?.id || autoCreatedProductId;

  useEffect(() => {
    if (open) {
      loadCategories();
      loadStores();
      if (product) {
        setName(product.name);
        setDescription(product.description || '');
        setPrice(product.price.toString());
        setStock(product.stock.toString());
        setCategoryId(product.category_id || 'none');
        setImageUrl(product.image_url || '');
        const metadata = product.metadata as { gallery_images?: string[] } | null;
        setGalleryImages(metadata?.gallery_images || []);
        setIsActive(product.is_active);
        setBarcode((product as { barcode?: string }).barcode || '');
        setWeightKg(product.weight_kg?.toString() || '');
        setWidthCm(product.width_cm?.toString() || '');
        setHeightCm(product.height_cm?.toString() || '');
        setDepthCm(product.depth_cm?.toString() || '');
        checkProductVariations(product.id);
        loadStoreStock(product.id);
      } else {
        resetForm();
      }
    }
  }, [open, product]);

  const checkProductVariations = async (productId: string) => {
    try {
      const [attributes, variations] = await Promise.all([
        variationsService.getAttributesByProduct(productId),
        variationsService.getVariationsByProduct(productId),
      ]);
      const hasVars = attributes.length > 0 || variations.length > 0;
      setHasVariations(hasVars);
      setProductType(hasVars ? 'variable' : 'simple');
    } catch (error) {
      console.error('Error checking variations:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await categoriesService.getAll();
      setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadStores = async () => {
    try {
      const { data } = await supabase.from('stores').select('id, name, type').eq('is_active', true).order('name');
      const physical = (data || []).filter(s => s.type === 'physical');
      setStores(physical);
    } catch (error) {
      console.error('Error loading stores:', error);
    }
  };

  const loadStoreStock = async (productId: string) => {
    try {
      const { data } = await supabase
        .from('store_stock')
        .select('store_id, quantity')
        .eq('product_id', productId)
        .is('variation_id', null);
      const qty: Record<string, string> = {};
      (data || []).forEach(s => { qty[s.store_id] = s.quantity.toString(); });
      setStoreStockQty(qty);
    } catch (error) {
      console.error('Error loading store stock:', error);
    }
  };

  const saveStoreStock = async (productId: string) => {
    const storesToSave = isAdmin ? stores : stores.filter(s => s.id === userStoreId);
    for (const store of storesToSave) {
      const qty = parseInt(storeStockQty[store.id] || '0') || 0;
      const { data: existing } = await supabase
        .from('store_stock')
        .select('id')
        .eq('store_id', store.id)
        .eq('product_id', productId)
        .is('variation_id', null)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('store_stock')
          .update({ quantity: qty, updated_at: new Date().toISOString() } as never)
          .eq('id', existing.id);
      } else {
        await supabase
          .from('store_stock')
          .insert({ store_id: store.id, product_id: productId, variation_id: null, quantity: qty } as never);
      }
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setPrice('');
    setStock('0');
    setCategoryId('none');
    setImageUrl('');
    setGalleryImages([]);
    setIsActive(true);
    setActiveTab('details');
    setProductType('simple');
    setHasVariations(false);
    setBarcode('');
    setWeightKg('');
    setWidthCm('');
    setHeightCm('');
    setDepthCm('');
    setAutoCreatedProductId(null);
    setStoreStockQty({});
  };

  // Auto-save product when switching to variations tab for new variable products
  const handleTabChange = async (tab: string) => {
    if (tab === 'variations' && !isEditing && !autoCreatedProductId) {
      // Validate minimum required fields
      if (!name.trim()) {
        toast.error('Preencha o nome do produto primeiro');
        return;
      }
      
      const priceValue = parseFloat(price);
      if (isNaN(priceValue) || priceValue < 0) {
        toast.error('Preencha um preço válido primeiro');
        return;
      }

      // Auto-create the product
      setIsLoading(true);
      try {
        const data: CreateProductData = {
          name: name.trim(),
          description: description.trim() || undefined,
          price: priceValue,
          stock: parseInt(stock) || 0,
          category_id: categoryId === 'none' ? undefined : categoryId,
          image_url: imageUrl.trim() || undefined,
          is_active: isActive,
          barcode: barcode.trim() || undefined,
          weight_kg: weightKg ? parseFloat(weightKg) : undefined,
          width_cm: widthCm ? parseFloat(widthCm) : undefined,
          height_cm: heightCm ? parseFloat(heightCm) : undefined,
          depth_cm: depthCm ? parseFloat(depthCm) : undefined,
          metadata: { gallery_images: galleryImages },
        };

        const newProduct = await productsService.create(data);
        setAutoCreatedProductId(newProduct.id);
        toast.success('Produto criado! Agora adicione as variações.');
        setActiveTab(tab);
      } catch (error) {
        console.error('Error auto-creating product:', error);
        toast.error('Erro ao criar produto');
      } finally {
        setIsLoading(false);
      }
    } else {
      setActiveTab(tab);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    
    const priceValue = parseFloat(price);
    if (isNaN(priceValue) || priceValue < 0) {
      toast.error('Preço inválido');
      return;
    }

    setIsLoading(true);
    
    try {
      const data: CreateProductData = {
        name: name.trim(),
        description: description.trim() || undefined,
        price: priceValue,
        stock: parseInt(stock) || 0,
        category_id: categoryId === 'none' ? undefined : categoryId,
        image_url: imageUrl.trim() || undefined,
        is_active: isActive,
        barcode: barcode.trim() || undefined,
        weight_kg: weightKg ? parseFloat(weightKg) : undefined,
        width_cm: widthCm ? parseFloat(widthCm) : undefined,
        height_cm: heightCm ? parseFloat(heightCm) : undefined,
        depth_cm: depthCm ? parseFloat(depthCm) : undefined,
        metadata: { gallery_images: galleryImages },
      };

      let savedProductId: string;
      if (isEditing && product) {
        await productsService.update(product.id, data);
        savedProductId = product.id;
        toast.success('Produto atualizado com sucesso!');
      } else if (autoCreatedProductId) {
        await productsService.update(autoCreatedProductId, data);
        savedProductId = autoCreatedProductId;
        toast.success('Produto atualizado com sucesso!');
      } else {
        const newProduct = await productsService.create(data);
        savedProductId = newProduct.id;
        toast.success('Produto criado com sucesso!');
      }

      // Save store stock
      await saveStoreStock(savedProductId);
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error(isEditing || autoCreatedProductId ? 'Erro ao atualizar produto' : 'Erro ao criar produto');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (autoCreatedProductId) {
      // Product was auto-created, refresh the list
      onSuccess();
    }
    onClose();
  };

  const renderForm = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Product Type Selector - Only show when creating */}
      {!isEditing && (
        <div className="space-y-3">
          <Label>Tipo de Produto</Label>
          <RadioGroup
            value={productType}
            onValueChange={(value: 'simple' | 'variable') => setProductType(value)}
            className="grid grid-cols-2 gap-4"
          >
            <div>
              <RadioGroupItem
                value="simple"
                id="simple"
                className="peer sr-only"
              />
              <Label
                htmlFor="simple"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <Package className="mb-3 h-6 w-6" />
                <span className="font-medium">Produto Simples</span>
                <span className="text-xs text-muted-foreground text-center mt-1">
                  Sem variações de tamanho, cor, etc.
                </span>
              </Label>
            </div>
            <div>
              <RadioGroupItem
                value="variable"
                id="variable"
                className="peer sr-only"
              />
              <Label
                htmlFor="variable"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <Layers className="mb-3 h-6 w-6" />
                <span className="font-medium">Produto Variável</span>
                <span className="text-xs text-muted-foreground text-center mt-1">
                  Com variações de tamanho, cor, etc.
                </span>
              </Label>
            </div>
          </RadioGroup>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Nome *</Label>
        <Input
          id="name"
          placeholder="Nome do produto"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descrição</Label>
        <Textarea
          id="description"
          placeholder="Descrição do produto..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="price">Preço {productType === 'simple' ? '(R$) *' : 'Base (R$) *'}</Label>
        <Input
          id="price"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />
        {productType === 'variable' && (
          <p className="text-xs text-muted-foreground">
            Preço base usado para novas variações
          </p>
        )}
      </div>

      {/* Store Stock Section */}
      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <Warehouse className="h-4 w-4 text-muted-foreground" />
          <Label className="font-medium">Estoque por Loja</Label>
        </div>
        {(isAdmin ? stores : stores.filter(s => s.id === userStoreId)).map(store => (
          <div key={store.id} className="flex items-center gap-3">
            <Label className="text-sm text-muted-foreground w-40">{store.name}</Label>
            <Input
              type="number"
              min="0"
              placeholder="0"
              value={storeStockQty[store.id] || '0'}
              onChange={(e) => setStoreStockQty(prev => ({ ...prev, [store.id]: e.target.value }))}
              className="w-24"
            />
          </div>
        ))}
        {isAdmin && stores.length > 0 && (
          <div className="flex items-center gap-3 pt-2 border-t">
            <Label className="text-sm font-bold w-40">Estoque Online (Total)</Label>
            <span className="font-bold text-sm">
              {stores.reduce((sum, s) => sum + (parseInt(storeStockQty[s.id] || '0') || 0), 0)}
            </span>
          </div>
        )}
        {productType === 'variable' && (
          <p className="text-xs text-muted-foreground">
            Gerenciado por variação
          </p>
        )}
      </div>

      {/* Barcode field */}
      <div className="space-y-2">
        <Label htmlFor="barcode">Código de Barras</Label>
        <Input
          id="barcode"
          placeholder="Ex: 7891234567890"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
            }
          }}
        />
        <p className="text-xs text-muted-foreground">
          {productType === 'variable' || hasVariations
            ? 'Código do produto principal. Variações têm códigos próprios.'
            : 'EAN-13, EAN-8 ou código interno'}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Categoria</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem categoria</SelectItem>
            {categories.filter(cat => cat.id).map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Imagem Principal</Label>
        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="url">URL</TabsTrigger>
          </TabsList>
          <TabsContent value="upload" className="mt-3">
            <ImageUpload
              value={imageUrl}
              onChange={(url) => setImageUrl(url || '')}
              bucket="product-images"
              folder="products"
            />
          </TabsContent>
          <TabsContent value="url" className="mt-3">
            <Input
              id="imageUrl"
              type="url"
              placeholder="https://exemplo.com/imagem.jpg"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </TabsContent>
        </Tabs>
      </div>

      <div className="space-y-2">
        <Label>Galeria de Imagens</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Adicione imagens extras que serão exibidas na galeria do produto
        </p>
        <MultiImageUpload
          values={galleryImages}
          onChange={setGalleryImages}
          bucket="product-images"
          folder="gallery"
          maxImages={10}
        />
      </div>

      {/* Shipping Section */}
      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <Weight className="h-4 w-4 text-muted-foreground" />
          <Label className="font-medium">Peso e Dimensões (para frete)</Label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="weight" className="text-xs text-muted-foreground">Peso (kg)</Label>
            <Input
              id="weight"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="width" className="text-xs text-muted-foreground">Largura (cm)</Label>
            <Input
              id="width"
              type="number"
              step="0.1"
              min="0"
              placeholder="0"
              value={widthCm}
              onChange={(e) => setWidthCm(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="height" className="text-xs text-muted-foreground">Altura (cm)</Label>
            <Input
              id="height"
              type="number"
              step="0.1"
              min="0"
              placeholder="0"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="depth" className="text-xs text-muted-foreground">Profundidade (cm)</Label>
            <Input
              id="depth"
              type="number"
              step="0.1"
              min="0"
              placeholder="0"
              value={depthCm}
              onChange={(e) => setDepthCm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <Label htmlFor="isActive" className="font-medium">Produto ativo</Label>
          <p className="text-sm text-muted-foreground">
            Produtos inativos não aparecem na loja
          </p>
        </div>
        <Switch
          id="isActive"
          checked={isActive}
          onCheckedChange={setIsActive}
        />
      </div>

      <DialogFooter className="pt-4">
        <Button type="button" variant="outline" onClick={handleClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : isEditing || autoCreatedProductId ? (
            'Atualizar'
          ) : (
            'Criar Produto'
          )}
        </Button>
      </DialogFooter>
    </form>
  );

  const showVariationsTabs = isEditing ? (productType === 'variable' || hasVariations) : (productType === 'variable' || !!autoCreatedProductId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={`max-h-[90vh] flex flex-col ${showVariationsTabs ? 'max-w-3xl' : 'max-w-lg'}`}>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Produto' : autoCreatedProductId ? 'Novo Produto (Variável)' : 'Novo Produto'}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Atualize as informações do produto' 
              : autoCreatedProductId 
                ? 'Configure as variações do produto'
                : 'Preencha os dados do novo produto'}
          </DialogDescription>
        </DialogHeader>

        {showVariationsTabs ? (
          <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Detalhes</TabsTrigger>
              <TabsTrigger value="variations" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Criando...
                  </>
                ) : (
                  'Variações'
                )}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="details" className="flex-1 overflow-y-auto mt-4 pr-2">
              {renderForm()}
            </TabsContent>
            
            <TabsContent value="variations" className="flex-1 overflow-y-auto mt-4 pr-2">
              {effectiveProductId ? (
                <ProductVariationsEditor 
                  productId={effectiveProductId} 
                  basePrice={parseFloat(price) || product?.price || 0}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">Clique na aba Variações</p>
                  <p className="text-sm mt-1">
                    O produto será criado automaticamente e você poderá adicionar as variações.
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex-1 overflow-y-auto py-4 pr-2">
            {renderForm()}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProductFormModal;
