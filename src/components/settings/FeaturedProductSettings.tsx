import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Star, Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { productsService, Product } from '@/services/products';
import { toast } from 'sonner';

const FeaturedProductSettings = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [allProducts, configRes] = await Promise.all([
          productsService.getAll(),
          supabase
            .from('store_config')
            .select('value')
            .eq('key', 'featured_product')
            .maybeSingle(),
        ]);
        setProducts(allProducts.filter(p => p.is_active));
        if (configRes.data?.value) {
          const val = configRes.data.value as { product_id?: string };
          setSelectedProductId(val.product_id || '');
        }
      } catch (err) {
        console.error('Error loading featured product settings:', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const value = { product_id: selectedProductId || null };

      const { data: existing } = await supabase
        .from('store_config')
        .select('id')
        .eq('key', 'featured_product')
        .maybeSingle();

      if (existing) {
        await supabase
          .from('store_config')
          .update({ value: value as any, is_public: true, updated_at: new Date().toISOString() })
          .eq('key', 'featured_product');
      } else {
        await supabase
          .from('store_config')
          .insert({ key: 'featured_product', value: value as any, is_public: true } as any);
      }

      toast.success('Produto em destaque atualizado!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar configuração');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="card-elevated">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5" />
          Produto em Destaque
        </CardTitle>
        <CardDescription>
          Selecione o produto que aparecerá na seção de destaque na página inicial com compra rápida
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={selectedProductId} onValueChange={setSelectedProductId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione um produto..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhum (ocultar seção)</SelectItem>
            {products.map((product) => (
              <SelectItem key={product.id} value={product.id}>
                {product.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Salvar
        </Button>
      </CardContent>
    </Card>
  );
};

export default FeaturedProductSettings;
