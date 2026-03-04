import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ShoppingCart } from 'lucide-react';
import ProductSearch, { ProductResult } from '@/components/pos/ProductSearch';
import ProductGrid from '@/components/pos/ProductGrid';
import POSCart, { CartItem } from '@/components/pos/POSCart';
import VariationPickerModal from '@/components/pos/VariationPickerModal';

interface ProductsStepProps {
  cartItems: CartItem[];
  onProductSelect: (product: ProductResult, variationId?: string) => void;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onApplyItemDiscount: (itemId: string, discountType: 'percentage' | 'fixed' | undefined, discountValue: number) => void;
  generalDiscount: { type: 'percentage' | 'fixed'; value: number };
  onApplyGeneralDiscount: (type: 'percentage' | 'fixed', value: number) => void;
  subtotal: number;
  discountAmount: number;
  total: number;
  isOnline: boolean;
  onNext: () => void;
  onBack: () => void;
}

const ProductsStep = ({
  cartItems,
  onProductSelect,
  onUpdateQuantity,
  onRemoveItem,
  onApplyItemDiscount,
  generalDiscount,
  onApplyGeneralDiscount,
  subtotal,
  discountAmount,
  total,
  isOnline,
  onNext,
  onBack,
}: ProductsStepProps) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [variationPickerProduct, setVariationPickerProduct] = useState<ProductResult | null>(null);

  const handleProductClick = (product: ProductResult, variationId?: string) => {
    // If a specific variation was already identified (e.g. barcode scan), use it directly
    if (variationId) {
      onProductSelect(product, variationId);
      return;
    }
    const activeVariations = product.variations.filter((v) => v.is_active && v.stock > 0);
    if (activeVariations.length > 1) {
      setVariationPickerProduct(product);
    } else if (activeVariations.length === 1) {
      onProductSelect(product, activeVariations[0].id);
    } else {
      onProductSelect(product);
    }
  };

  const handleVariationSelect = (product: ProductResult, variationId: string) => {
    onProductSelect(product, variationId);
  };

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* Left - Products */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Selecione os Produtos</h2>
            <p className="text-sm text-muted-foreground">Busque ou selecione os produtos da venda</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onBack}>
              <ChevronLeft className="h-4 w-4 mr-2" /> Voltar
            </Button>
            <Button onClick={onNext} disabled={cartItems.length === 0}>
              <ShoppingCart className="h-4 w-4 mr-2" />
              Prosseguir
              {cartItems.length > 0 && (
                <Badge variant="secondary" className="ml-2">{cartItems.length}</Badge>
              )}
            </Button>
          </div>
        </div>
        <div className="px-4 pt-3">
          <ProductSearch onProductSelect={handleProductClick} isOnline={isOnline} />
        </div>
        <ProductGrid
          selectedCategoryId={selectedCategoryId}
          onCategoryChange={setSelectedCategoryId}
          onProductSelect={handleProductClick}
          isOnline={isOnline}
        />
      </div>

      {/* Right - Cart */}
      <div className="w-96 flex flex-col border-l">
        <POSCart
          items={cartItems}
          onUpdateQuantity={onUpdateQuantity}
          onRemoveItem={onRemoveItem}
          onApplyItemDiscount={onApplyItemDiscount}
          generalDiscount={generalDiscount}
          onApplyGeneralDiscount={onApplyGeneralDiscount}
          subtotal={subtotal}
          discountAmount={discountAmount}
          total={total}
        />
      </div>

      {/* Variation Picker Modal */}
      <VariationPickerModal
        open={!!variationPickerProduct}
        onOpenChange={(open) => !open && setVariationPickerProduct(null)}
        product={variationPickerProduct}
        onSelectVariation={handleVariationSelect}
      />
    </div>
  );
};

export default ProductsStep;
