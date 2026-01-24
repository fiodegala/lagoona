import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Package, Loader2, ShoppingCart } from 'lucide-react';
import { productsService, Product } from '@/services/products';
import { categoriesService, Category } from '@/services/categories';
import MeasurementTableDisplay from '@/components/MeasurementTableDisplay';
import StoreLayout from '@/components/store/StoreLayout';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';

const ProductDetails = () => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addItem } = useCart();

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
      <StoreLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </StoreLayout>
    );
  }

  if (error || !product) {
    return (
      <StoreLayout>
        <div className="container mx-auto px-4 py-24 text-center">
          <Package className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
          <h1 className="text-xl font-semibold mb-4">{error || 'Produto não encontrado'}</h1>
          <Button asChild variant="outline">
            <Link to="/loja">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para Loja
            </Link>
          </Button>
        </div>
      </StoreLayout>
    );
  }

  const handleAddToCart = () => {
    if (product.stock <= 0) {
      toast.error('Produto fora de estoque');
      return;
    }

    addItem({
      id: product.id,
      productId: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.image_url || undefined,
      stock: product.stock,
    });

    toast.success('Produto adicionado ao carrinho');
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  return (
    <StoreLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:text-foreground transition-colors">
            Início
          </Link>
          <span>/</span>
          <Link to="/loja" className="hover:text-foreground transition-colors">
            Loja
          </Link>
          {category && (
            <>
              <span>/</span>
              <Link to={`/loja/categoria/${category.slug}`} className="hover:text-foreground transition-colors">
                {category.name}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="text-foreground">{product.name}</span>
        </nav>

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

            {/* Add to Cart */}
            <Button
              size="lg"
              className="w-full gap-2"
              onClick={handleAddToCart}
              disabled={product.stock <= 0}
            >
              <ShoppingCart className="h-5 w-5" />
              {product.stock > 0 ? 'Adicionar ao Carrinho' : 'Produto Indisponível'}
            </Button>

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
      </div>
    </StoreLayout>
  );
};

export default ProductDetails;
