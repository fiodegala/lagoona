import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Package, Loader2 } from 'lucide-react';
import { productsService, Product } from '@/services/products';
import { categoriesService, Category } from '@/services/categories';
import MeasurementTableDisplay from '@/components/MeasurementTableDisplay';

const ProductDetails = () => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProduct = async () => {
      if (!id) {
        setError('Produto não encontrado');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const productData = await productsService.getById(id);
        
        if (!productData) {
          setError('Produto não encontrado');
          return;
        }

        setProduct(productData);

        // Load category if product has one
        if (productData.category_id) {
          const categories = await categoriesService.getAll();
          const productCategory = categories.find(c => c.id === productData.category_id);
          setCategory(productCategory || null);
        }
      } catch (err) {
        console.error('Error loading product:', err);
        setError('Erro ao carregar produto');
      } finally {
        setIsLoading(false);
      }
    };

    loadProduct();
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Package className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-xl font-semibold">{error || 'Produto não encontrado'}</h1>
        <Button asChild variant="outline">
          <Link to="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Link>
        </Button>
      </div>
    );
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Link>
          </Button>
        </div>
      </header>

      {/* Product Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {/* Product Image */}
          <div className="aspect-square rounded-lg overflow-hidden bg-muted">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="h-24 w-24 text-muted-foreground/50" />
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {category && (
              <Badge variant="secondary" className="mb-2">
                {category.name}
              </Badge>
            )}

            <h1 className="text-3xl font-bold">{product.name}</h1>

            <p className="text-3xl font-semibold text-primary">
              {formatPrice(product.price)}
            </p>

            {product.description && (
              <div className="space-y-2">
                <h2 className="font-semibold">Descrição</h2>
                <p className="text-muted-foreground leading-relaxed">
                  {product.description}
                </p>
              </div>
            )}

            <Separator />

            {/* Stock Status */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Disponibilidade:</span>
              {product.stock > 0 ? (
                <Badge className="bg-success/10 text-success">
                  Em estoque ({product.stock} unidades)
                </Badge>
              ) : (
                <Badge variant="destructive">Fora de estoque</Badge>
              )}
            </div>

            {/* Measurement Table */}
            {product.category_id && (
              <div className="pt-4">
                <MeasurementTableDisplay categoryId={product.category_id} />
              </div>
            )}

            {/* Product Dimensions (if available) */}
            {(product.weight_kg || product.width_cm || product.height_cm || product.depth_cm) && (
              <div className="space-y-2 pt-4">
                <h2 className="font-semibold">Dimensões do Produto</h2>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {product.weight_kg && (
                    <div>
                      <span className="text-muted-foreground">Peso:</span>{' '}
                      <span>{product.weight_kg} kg</span>
                    </div>
                  )}
                  {product.width_cm && (
                    <div>
                      <span className="text-muted-foreground">Largura:</span>{' '}
                      <span>{product.width_cm} cm</span>
                    </div>
                  )}
                  {product.height_cm && (
                    <div>
                      <span className="text-muted-foreground">Altura:</span>{' '}
                      <span>{product.height_cm} cm</span>
                    </div>
                  )}
                  {product.depth_cm && (
                    <div>
                      <span className="text-muted-foreground">Profundidade:</span>{' '}
                      <span>{product.depth_cm} cm</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProductDetails;
