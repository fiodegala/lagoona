import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Package, Truck, Sparkles, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import StoreLayout from '@/components/store/StoreLayout';
import { combosService, Combo } from '@/services/combos';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';

interface ComboWithProducts extends Combo {
  productDetails?: {
    id: string;
    name: string;
    price: number;
    image_url: string | null;
    variationLabel?: string;
  }[];
  originalPrice?: number;
}

const CombosPage = () => {
  const [combos, setCombos] = useState<ComboWithProducts[]>([]);
  const [loading, setLoading] = useState(true);
  const { addItem } = useCart();

  useEffect(() => {
    const load = async () => {
      try {
        const data = await combosService.listActiveWithItems();

        // Enrich with product details
        const enriched = await Promise.all(
          data.map(async (combo) => {
            if (!combo.items?.length) return { ...combo, productDetails: [], originalPrice: 0 };

            const productIds = [...new Set(combo.items.map(i => i.product_id))];
            const { data: products } = await supabase
              .from('products')
              .select('id, name, price, image_url')
              .in('id', productIds);

            const productMap = new Map((products || []).map(p => [p.id, p]));
            let originalPrice = 0;

            const details = combo.items.map(item => {
              const product = productMap.get(item.product_id);
              if (!product) return null;
              const unitPrice = product.price;
              originalPrice += unitPrice * item.quantity;
              return {
                id: product.id,
                name: product.name,
                price: unitPrice,
                image_url: product.image_url,
              };
            }).filter(Boolean) as ComboWithProducts['productDetails'];

            return { ...combo, productDetails: details, originalPrice };
          })
        );

        setCombos(enriched);
      } catch (err) {
        console.error('Error loading combos:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);

  const handleViewCombo = (combo: ComboWithProducts) => {
    // Navigate to the first product in the combo
    if (combo.productDetails?.[0]) {
      window.location.href = `/produto/${combo.productDetails[0].id}`;
    }
  };

  if (loading) {
    return (
      <StoreLayout>
        <div className="container mx-auto px-4 py-12">
          <h1 className="text-3xl font-bold mb-8">Combos & Kits</h1>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-96 rounded-xl" />
            ))}
          </div>
        </div>
      </StoreLayout>
    );
  }

  if (combos.length === 0) {
    return (
      <StoreLayout>
        <div className="container mx-auto px-4 py-24 text-center">
          <Package className="h-20 w-20 mx-auto text-muted-foreground/30 mb-6" />
          <h1 className="text-2xl font-bold mb-2">Nenhum combo disponível</h1>
          <p className="text-muted-foreground mb-8">
            Fique de olho! Em breve teremos novos combos.
          </p>
          <Button asChild>
            <Link to="/loja">Ver Produtos</Link>
          </Button>
        </div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout>
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="h-6 w-6 text-store-gold" />
            <h1 className="text-3xl font-bold">Combos & Kits</h1>
            <Sparkles className="h-6 w-6 text-store-gold" />
          </div>
          <p className="text-muted-foreground max-w-md mx-auto">
            Aproveite nossos kits especiais com preços exclusivos e economize!
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {combos.map(combo => {
            const savings = (combo.originalPrice || 0) - combo.combo_price;
            const savingsPercent = combo.originalPrice
              ? Math.round((savings / combo.originalPrice) * 100)
              : 0;

            return (
              <Card
                key={combo.id}
                className="group overflow-hidden border hover:shadow-lg transition-all duration-300"
              >
                {/* Combo Image */}
                <div className="relative aspect-square bg-muted overflow-hidden">
                  {combo.image_url ? (
                    <img
                      src={combo.image_url}
                      alt={combo.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : combo.productDetails && combo.productDetails.length > 0 ? (
                    <div className="w-full h-full grid grid-cols-2 gap-0.5 p-1">
                      {combo.productDetails.slice(0, 4).map((p, idx) => (
                        <div key={idx} className="bg-muted rounded overflow-hidden">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="h-8 w-8 text-muted-foreground/30" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-16 w-16 text-muted-foreground/20" />
                    </div>
                  )}

                  {/* Discount badge */}
                  {savingsPercent > 0 && (
                    <Badge className="absolute top-3 left-3 bg-destructive text-destructive-foreground text-sm px-2.5 py-1">
                      -{savingsPercent}%
                    </Badge>
                  )}

                  {/* Free shipping badge */}
                  {combo.free_shipping && (
                    <Badge className="absolute top-3 right-3 bg-green-600 text-white gap-1">
                      <Truck className="h-3 w-3" /> Frete Grátis
                    </Badge>
                  )}
                </div>

                <CardContent className="p-5 space-y-3">
                  <h3 className="font-bold text-lg line-clamp-2">{combo.name}</h3>

                  {combo.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {combo.description}
                    </p>
                  )}

                  {/* Products list */}
                  {combo.productDetails && combo.productDetails.length > 0 && (
                    <div className="space-y-1">
                      {combo.productDetails.slice(0, 3).map((p, idx) => (
                        <p key={idx} className="text-xs text-muted-foreground truncate">
                          • {p.name}
                        </p>
                      ))}
                      {combo.productDetails.length > 3 && (
                        <p className="text-xs text-muted-foreground">
                          +{combo.productDetails.length - 3} mais
                        </p>
                      )}
                    </div>
                  )}

                  {/* Pricing */}
                  <div className="space-y-1 pt-2 border-t">
                    {combo.originalPrice && combo.originalPrice > combo.combo_price && (
                      <p className="text-sm text-muted-foreground line-through">
                        {formatPrice(combo.originalPrice)}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <p className="text-2xl font-bold text-primary">
                        {formatPrice(combo.combo_price)}
                      </p>
                      {savings > 0 && (
                        <Badge variant="secondary" className="text-green-600">
                          Economize {formatPrice(savings)}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <Button
                    className="w-full gap-2"
                    onClick={() => handleViewCombo(combo)}
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Ver Combo
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </StoreLayout>
  );
};

export default CombosPage;
