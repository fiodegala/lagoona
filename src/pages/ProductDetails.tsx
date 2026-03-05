import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, Package, Loader2, ShoppingCart, Heart, Share2, 
  Minus, Plus, Star, Truck, ShieldCheck, RotateCcw 
} from 'lucide-react';
import { productsService, Product } from '@/services/products';
import { categoriesService, Category } from '@/services/categories';
import { ProductVariation } from '@/services/variations';
import { getProductRealStock } from '@/services/stockService';
import StoreLayout from '@/components/store/StoreLayout';
import ProductVariationSelector from '@/components/store/ProductVariationSelector';
import ShippingCalculator from '@/components/store/ShippingCalculator';
import ProductReviews from '@/components/store/ProductReviews';
import SizeGuideModal from '@/components/store/SizeGuideModal';
import ProductImageGallery from '@/components/store/ProductImageGallery';
import RelatedProducts from '@/components/store/RelatedProducts';
import UpsellSection from '@/components/store/UpsellSection';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const ProductDetails = () => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [showVideoPopup, setShowVideoPopup] = useState(false);
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

        const realStock = await getProductRealStock(productData.id);
        setProduct({ ...productData, stock: realStock });
        setSelectedImage(productData.image_url);

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

  const handleVariationSelect = useCallback((variation: ProductVariation | null) => {
    setSelectedVariation(variation);
    if (variation?.image_url) {
      setSelectedImage(variation.image_url);
    } else if (product?.image_url) {
      setSelectedImage(product.image_url);
    }
  }, [product?.image_url]);

  // Build gallery images array from product and variations
  // All images for navigation (main + gallery)
  const allImages = useMemo(() => {
    const images: string[] = [];
    if (product?.image_url) {
      images.push(product.image_url);
    }
    const metadata = product?.metadata as { gallery_images?: string[]; video_url?: string } | null;
    if (metadata?.gallery_images && Array.isArray(metadata.gallery_images)) {
      metadata.gallery_images.forEach((img: string) => {
        if (img && !images.includes(img)) {
          images.push(img);
        }
      });
    }
    return images;
  }, [product]);

  // Only additional images for thumbnail strip below video
  const galleryImages = useMemo(() => {
    return allImages.filter(img => img !== product?.image_url);
  }, [allImages, product?.image_url]);

  const videoUrl = useMemo(() => {
    const metadata = product?.metadata as { video_url?: string } | null;
    return metadata?.video_url || undefined;
  }, [product]);

  const thumbnailVideoUrl = useMemo(() => {
    const metadata = product?.metadata as { thumbnail_video_url?: string } | null;
    const url = metadata?.thumbnail_video_url?.trim();
    return url && url.length > 0 ? url : undefined;
  }, [product]);

  const basePrice = selectedVariation?.price ?? product?.price ?? 0;
  const promotionalPrice = selectedVariation?.promotional_price ?? product?.promotional_price ?? null;
  const currentPrice = promotionalPrice && promotionalPrice < basePrice ? promotionalPrice : basePrice;
  const hasRealDiscount = promotionalPrice !== null && promotionalPrice < basePrice;
  const currentStock = selectedVariation?.stock ?? product?.stock ?? 0;
  const isOutOfStock = currentStock <= 0;

  const handleAddToCart = () => {
    if (!product) return;
    
    if (isOutOfStock) {
      toast.error('Produto fora de estoque');
      return;
    }

    const variationLabel = selectedVariation?.attribute_values
      ?.map(av => av.value).join(' / ');

    addItem({
      id: selectedVariation?.id || product.id,
      productId: product.id,
      name: variationLabel ? `${product.name} - ${variationLabel}` : product.name,
      price: currentPrice,
      imageUrl: selectedImage || product.image_url || undefined,
      stock: currentStock,
      quantity,
    });

    toast.success('Produto adicionado ao carrinho!', {
      action: {
        label: 'Ver carrinho',
        onClick: () => window.location.href = '/carrinho',
      },
    });
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: product?.name,
        url: window.location.href,
      });
    } catch {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copiado!');
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

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

  const discountPercent = hasRealDiscount ? Math.round(((basePrice - currentPrice) / basePrice) * 100) : 0;

  return (
    <StoreLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:text-store-primary transition-colors">
            Início
          </Link>
          <span>/</span>
          <Link to="/loja" className="hover:text-store-primary transition-colors">
            Loja
          </Link>
          {category && (
            <>
              <span>/</span>
              <Link to={`/loja/categoria/${category.slug}`} className="hover:text-store-primary transition-colors">
                {category.name}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="text-foreground line-clamp-1">{product.name}</span>
        </nav>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Product Images Gallery */}
          <div className="space-y-4">
            {/* Main Product Image with Navigation */}
            {product.image_url && (
              <div className="rounded-xl overflow-hidden border bg-muted relative group">
                <img
                  src={selectedImage || product.image_url}
                  alt={product.name}
                  className="w-full aspect-[4/5] object-cover"
                />
                {allImages.length > 1 && (
                  <>
                    <button
                      onClick={() => {
                        const currentIdx = allImages.indexOf(selectedImage || product.image_url || '');
                        const prevIdx = (currentIdx - 1 + allImages.length) % allImages.length;
                        setSelectedImage(allImages[prevIdx]);
                      }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm hover:bg-background rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => {
                        const currentIdx = allImages.indexOf(selectedImage || product.image_url || '');
                        const nextIdx = (currentIdx + 1) % allImages.length;
                        setSelectedImage(allImages[nextIdx]);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm hover:bg-background rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    </button>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-background/70 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-medium">
                      {allImages.indexOf(selectedImage || product.image_url || '') + 1} / {allImages.length}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Thumbnail Video */}
            {thumbnailVideoUrl && (
              <>
                <div
                  className="rounded-xl overflow-hidden border bg-muted cursor-pointer relative group"
                  onClick={() => setShowVideoPopup(true)}
                >
                  <video
                    src={thumbnailVideoUrl}
                    muted
                    autoPlay
                    loop
                    playsInline
                    className="w-full aspect-[9/16] object-cover max-h-[400px]"
                  />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="bg-background/80 backdrop-blur-sm rounded-full p-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-foreground" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                  </div>
                </div>

                {/* Video Popup 9:16 */}
                {showVideoPopup && (
                  <div
                    className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center"
                    onClick={() => setShowVideoPopup(false)}
                  >
                    <div
                      className="relative w-full max-w-[360px] aspect-[9/16] rounded-2xl overflow-hidden shadow-2xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <video
                        src={thumbnailVideoUrl}
                        autoPlay
                        loop
                        playsInline
                        controls
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => setShowVideoPopup(false)}
                        className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Gallery Thumbnails */}
            {galleryImages.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {galleryImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(img)}
                    className={cn(
                      "rounded-lg overflow-hidden border-2 transition-all aspect-square",
                      (selectedImage || product.image_url) === img
                        ? "border-store-primary ring-2 ring-store-primary/30"
                        : "border-transparent hover:border-muted-foreground/30"
                    )}
                  >
                    <img src={img} alt={`${product.name} ${idx + 2}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Category & Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              {category && (
                <Badge variant="secondary">{category.name}</Badge>
              )}
              {discountPercent > 0 && (
                <Badge className="bg-store-deal text-white">-{discountPercent}% OFF</Badge>
              )}
              {currentStock <= 5 && currentStock > 0 && (
                <Badge variant="outline" className="text-warning border-warning">
                  Últimas unidades!
                </Badge>
              )}
            </div>

            {/* Title */}
            <h1 className="text-2xl md:text-3xl font-display font-bold text-store-accent">
              {product.name}
            </h1>

            {/* Rating Summary */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={cn(
                      "h-4 w-4",
                      star <= 4 ? "fill-warning text-warning" : "text-muted-foreground/30"
                    )}
                  />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">(0 avaliações)</span>
            </div>

            {/* Pricing */}
            <div className="space-y-1">
              {hasRealDiscount && (
                <p className="text-sm text-muted-foreground line-through">
                  {formatPrice(basePrice)}
                </p>
              )}
              <p className="text-3xl font-bold text-store-accent">
                {formatPrice(currentPrice)}
              </p>
              <p className="text-sm text-muted-foreground">
                em até <span className="font-semibold text-foreground">6x de {formatPrice(currentPrice / 6)}</span> sem juros
              </p>
              <p className="text-sm text-success font-medium">
                {formatPrice(currentPrice * 0.95)} à vista no Pix (5% off)
              </p>
            </div>

            <Separator />

            {/* Variations Selector */}
            <ProductVariationSelector
              productId={product.id}
              onVariationSelect={handleVariationSelect}
            />

            {/* Size Guide */}
            {product.category_id && (
              <div>
                <SizeGuideModal categoryId={product.category_id} />
              </div>
            )}

            {/* Quantity Selector */}
            <div className="space-y-2">
              <span className="font-medium text-sm">Quantidade:</span>
              <div className="flex items-center gap-3">
                <div className="flex items-center border rounded-lg">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-12 text-center font-medium">{quantity}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => setQuantity(Math.min(currentStock, quantity + 1))}
                    disabled={quantity >= currentStock}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <span className="text-sm text-muted-foreground">
                  {currentStock > 0 ? `${currentStock} disponíveis` : 'Indisponível'}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                size="lg"
                className="flex-1 gap-2 bg-store-primary text-store-accent hover:bg-store-primary/90 font-semibold"
                onClick={handleAddToCart}
                disabled={isOutOfStock}
              >
                <ShoppingCart className="h-5 w-5" />
                {isOutOfStock ? 'Produto Indisponível' : 'Adicionar ao Carrinho'}
              </Button>
              <Button
                variant="outline"
                size="lg"
                className={cn(
                  "px-4",
                  isWishlisted && "bg-store-primary/10 border-store-primary text-store-primary"
                )}
                onClick={() => {
                  setIsWishlisted(!isWishlisted);
                  toast.success(isWishlisted ? 'Removido dos favoritos' : 'Adicionado aos favoritos');
                }}
              >
                <Heart className={cn("h-5 w-5", isWishlisted && "fill-current")} />
              </Button>
              <Button variant="outline" size="lg" className="px-4" onClick={handleShare}>
                <Share2 className="h-5 w-5" />
              </Button>
            </div>

            <Separator />

            {/* Shipping Calculator */}
            <ShippingCalculator productWeight={product.weight_kg || 0.5} orderTotal={product.promotional_price || product.price} />

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-4 py-4">
              <div className="text-center">
                <Truck className="h-6 w-6 mx-auto mb-1 text-store-primary" />
                <span className="text-xs text-muted-foreground">Entrega Rápida</span>
              </div>
              <div className="text-center">
                <ShieldCheck className="h-6 w-6 mx-auto mb-1 text-store-primary" />
                <span className="text-xs text-muted-foreground">Compra Segura</span>
              </div>
              <div className="text-center">
                <RotateCcw className="h-6 w-6 mx-auto mb-1 text-store-primary" />
                <span className="text-xs text-muted-foreground">30 dias p/ troca</span>
              </div>
            </div>
          </div>
        </div>

        {/* Product Details Tabs */}
        <div className="mt-12">
          <Tabs defaultValue="description" className="w-full">
            <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
              <TabsTrigger 
                value="description" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-store-primary data-[state=active]:text-store-primary px-6 py-3"
              >
                Descrição
              </TabsTrigger>
              <TabsTrigger 
                value="specs" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-store-primary data-[state=active]:text-store-primary px-6 py-3"
              >
                Especificações
              </TabsTrigger>
              <TabsTrigger 
                value="reviews" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-store-primary data-[state=active]:text-store-primary px-6 py-3"
              >
                Avaliações
              </TabsTrigger>
            </TabsList>

            <TabsContent value="description" className="pt-6">
              <div className="prose prose-gray max-w-none">
                {product.description ? (
                  <div className="space-y-4">
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {product.description}
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    Descrição não disponível para este produto.
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="specs" className="pt-6">
              <div className="grid md:grid-cols-2 gap-4">
                {product.weight_kg && (
                  <div className="flex justify-between py-3 border-b">
                    <span className="text-muted-foreground">Peso</span>
                    <span className="font-medium">{product.weight_kg} kg</span>
                  </div>
                )}
                {product.width_cm && (
                  <div className="flex justify-between py-3 border-b">
                    <span className="text-muted-foreground">Largura</span>
                    <span className="font-medium">{product.width_cm} cm</span>
                  </div>
                )}
                {product.height_cm && (
                  <div className="flex justify-between py-3 border-b">
                    <span className="text-muted-foreground">Altura</span>
                    <span className="font-medium">{product.height_cm} cm</span>
                  </div>
                )}
                {product.depth_cm && (
                  <div className="flex justify-between py-3 border-b">
                    <span className="text-muted-foreground">Profundidade</span>
                    <span className="font-medium">{product.depth_cm} cm</span>
                  </div>
                )}
                {category && (
                  <div className="flex justify-between py-3 border-b">
                    <span className="text-muted-foreground">Categoria</span>
                    <span className="font-medium">{category.name}</span>
                  </div>
                )}
                {selectedVariation?.sku && (
                  <div className="flex justify-between py-3 border-b">
                    <span className="text-muted-foreground">SKU</span>
                    <span className="font-medium">{selectedVariation.sku}</span>
                  </div>
                )}
              </div>

              {/* Measurement Table in Specs */}
              {product.category_id && (
                <div className="mt-6">
                  <SizeGuideModal categoryId={product.category_id} />
                </div>
              )}
            </TabsContent>

            <TabsContent value="reviews" className="pt-6">
              <ProductReviews productId={product.id} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Upsell - Buy Together */}
        <UpsellSection
          currentProduct={product}
          currentPrice={currentPrice}
          categoryId={product.category_id}
        />

        {/* Related Products */}
        <RelatedProducts 
          currentProductId={product.id} 
          categoryId={product.category_id}
        />
      </div>
    </StoreLayout>
  );
};

export default ProductDetails;
