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
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { productsService, categoriesService, Product, Category, CreateProductData } from '@/services/products';
import ImageUpload from './ImageUpload';
import ProductVariationsEditor from './ProductVariationsEditor';

interface ProductFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product?: Product | null;
}

const ProductFormModal = ({ open, onClose, onSuccess, product }: ProductFormModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeTab, setActiveTab] = useState('details');
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('0');
  const [categoryId, setCategoryId] = useState<string>('none');
  const [imageUrl, setImageUrl] = useState('');
  const [isActive, setIsActive] = useState(true);

  const isEditing = !!product;

  useEffect(() => {
    if (open) {
      loadCategories();
      if (product) {
        setName(product.name);
        setDescription(product.description || '');
        setPrice(product.price.toString());
        setStock(product.stock.toString());
        setCategoryId(product.category_id || 'none');
        setImageUrl(product.image_url || '');
        setIsActive(product.is_active);
      } else {
        resetForm();
      }
    }
  }, [open, product]);

  const loadCategories = async () => {
    try {
      const data = await categoriesService.getAll();
      setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setPrice('');
    setStock('0');
    setCategoryId('none');
    setImageUrl('');
    setIsActive(true);
    setActiveTab('details');
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
      };

      if (isEditing && product) {
        await productsService.update(product.id, data);
        toast.success('Produto atualizado com sucesso!');
      } else {
        await productsService.create(data);
        toast.success('Produto criado com sucesso!');
      }
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error(isEditing ? 'Erro ao atualizar produto' : 'Erro ao criar produto');
    } finally {
      setIsLoading(false);
    }
  };

  const renderForm = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
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

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="price">Preço (R$) *</Label>
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
        </div>
        <div className="space-y-2">
          <Label htmlFor="stock">Estoque</Label>
          <Input
            id="stock"
            type="number"
            min="0"
            placeholder="0"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
          />
        </div>
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
        <Label>Imagem do Produto</Label>
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
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : isEditing ? (
            'Atualizar'
          ) : (
            'Criar Produto'
          )}
        </Button>
      </DialogFooter>
    </form>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={`max-h-[90vh] flex flex-col ${isEditing ? 'max-w-3xl' : 'max-w-lg'}`}>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Atualize as informações do produto' : 'Preencha os dados do novo produto'}
          </DialogDescription>
        </DialogHeader>

        {isEditing ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Detalhes</TabsTrigger>
              <TabsTrigger value="variations">Variações</TabsTrigger>
            </TabsList>
            
            <TabsContent value="details" className="flex-1 overflow-y-auto mt-4 pr-2">
              {renderForm()}
            </TabsContent>
            
            <TabsContent value="variations" className="flex-1 overflow-y-auto mt-4 pr-2">
              {product && (
                <ProductVariationsEditor 
                  productId={product.id} 
                  basePrice={product.price}
                />
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
