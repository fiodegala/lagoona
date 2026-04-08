import { useState } from 'react';
import { PricingMode } from '@/components/pos/POSCart';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ShoppingCart, RotateCcw, Plus } from 'lucide-react';
import ProductSearch, { ProductResult } from '@/components/pos/ProductSearch';
import ProductGrid from '@/components/pos/ProductGrid';
import POSCart, { CartItem } from '@/components/pos/POSCart';
import VariationPickerModal from '@/components/pos/VariationPickerModal';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface ProductsStepProps {
  cartItems: CartItem[];
  onProductSelect: (product: ProductResult, variationId?: string) => void;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onUpdatePrice: (itemId: string, newPrice: number) => void;
  onApplyItemDiscount: (itemId: string, discountType: 'percentage' | 'fixed' | undefined, discountValue: number) => void;
  onTogglePromoPrice: (itemId: string, usePromo: boolean) => void;
  generalDiscount: { type: 'percentage' | 'fixed'; value: number };
  onApplyGeneralDiscount: (type: 'percentage' | 'fixed', value: number) => void;
  subtotal: number;
  discountAmount: number;
  total: number;
  isOnline: boolean;
  onNext: () => void;
  onBack: () => void;
  pricingMode?: PricingMode;
  onChangePricingMode?: (mode: PricingMode) => void;
  showPricingModeSwitcher?: boolean;
  saleType?: string;
  onReturnProductSelect?: (product: ProductResult, variationId?: string) => void;
}

const ProductsStep = ({
  cartItems,
  onProductSelect,
  onUpdateQuantity,
  onRemoveItem,
  onUpdatePrice,
  onApplyItemDiscount,
  onTogglePromoPrice,
  generalDiscount,
  onApplyGeneralDiscount,
  subtotal,
  discountAmount,
  total,
  isOnline,
  onNext,
  onBack,
  pricingMode,
  onChangePricingMode,
  showPricingModeSwitcher,
  saleType,
  onReturnProductSelect,
}: ProductsStepProps) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [variationPickerProduct, setVariationPickerProduct] = useState<ProductResult | null>(null);
  const [variationPickerIsReturn, setVariationPickerIsReturn] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [addMode, setAddMode] = useState<'new' | 'return'>('new');
  const isMobile = useIsMobile();
  const isExchange = saleType === 'troca';

  const handleProductClick = (product: ProductResult, variationId?: string) => {
    if (addMode === 'return' && isExchange && onReturnProductSelect) {
      // Return mode
      if (variationId) {
        onReturnProductSelect(product, variationId);
        return;
      }
      const variations = product.variations.filter((v) => v.is_active);
      if (variations.length > 1) {
        setVariationPickerProduct(product);
        setVariationPickerIsReturn(true);
      } else if (variations.length === 1) {
        onReturnProductSelect(product, variations[0].id);
      } else {
        onReturnProductSelect(product);
      }
      return;
    }

    // Normal mode
    if (variationId) {
      onProductSelect(product, variationId);
      return;
    }
    const activeVariations = product.variations.filter((v) => v.is_active && v.stock > 0);
    if (activeVariations.length > 1) {
      setVariationPickerProduct(product);
      setVariationPickerIsReturn(false);
    } else if (activeVariations.length === 1) {
      onProductSelect(product, activeVariations[0].id);
    } else {
      onProductSelect(product);
    }
  };

  const handleVariationSelect = (product: ProductResult, variationId: string) => {
    if (variationPickerIsReturn && onReturnProductSelect) {
      onReturnProductSelect(product, variationId);
    } else {
      onProductSelect(product, variationId);
    }
  };

  // Validation for exchange mode
  const hasNewItems = cartItems.some(i => !i.is_return);
  const hasReturnItems = cartItems.some(i => i.is_return);
  const canProceed = isExchange ? (hasNewItems && hasReturnItems) : cartItems.length > 0;

  const cartContent = (
    <POSCart
      items={cartItems}
      onUpdateQuantity={onUpdateQuantity}
      onRemoveItem={onRemoveItem}
      onUpdatePrice={onUpdatePrice}
      onApplyItemDiscount={onApplyItemDiscount}
      onTogglePromoPrice={onTogglePromoPrice}
      generalDiscount={generalDiscount}
      onApplyGeneralDiscount={onApplyGeneralDiscount}
      subtotal={subtotal}
      discountAmount={discountAmount}
      total={total}
      pricingMode={pricingMode}
      onChangePricingMode={onChangePricingMode}
      showPricingModeSwitcher={showPricingModeSwitcher}
    />
  );

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* Left - Products */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-3 sm:p-4 border-b flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold truncate">
              {isExchange ? 'Troca de Produtos' : 'Selecione os Produtos'}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
              {isExchange ? 'Adicione itens novos e devoluções' : 'Busque ou selecione os produtos da venda'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size={isMobile ? 'sm' : 'default'} onClick={onBack}>
              <ChevronLeft className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Voltar</span>
            </Button>
            {isMobile ? (
              <Sheet open={cartOpen} onOpenChange={setCartOpen}>
                <SheetTrigger asChild>
                  <Button size="sm" variant="outline" className="relative">
                    <ShoppingCart className="h-4 w-4" />
                    {cartItems.length > 0 && (
                      <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                        {cartItems.reduce((sum, i) => sum + i.quantity, 0)}
                      </Badge>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[85vw] sm:w-96 p-0 flex flex-col">
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {cartContent}
                  </div>
                  <div className="p-3 border-t">
                    <Button className="w-full" onClick={() => { setCartOpen(false); onNext(); }} disabled={!canProceed}>
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Prosseguir
                    </Button>
                    {isExchange && !canProceed && (
                      <p className="text-xs text-muted-foreground text-center mt-1">
                        Adicione ao menos 1 item novo e 1 devolução
                      </p>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            ) : (
              <Button onClick={onNext} disabled={!canProceed}>
                <ShoppingCart className="h-4 w-4 mr-2" />
                Prosseguir
                {cartItems.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{cartItems.reduce((sum, i) => sum + i.quantity, 0)}</Badge>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Exchange mode toggle */}
        {isExchange && (
          <div className="px-3 sm:px-4 pt-3 flex gap-2">
            <Button
              variant={addMode === 'new' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAddMode('new')}
              className="flex-1"
            >
              <Plus className="h-4 w-4 mr-1" />
              Produto Novo
            </Button>
            <Button
              variant={addMode === 'return' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAddMode('return')}
              className={cn("flex-1", addMode === 'return' && "bg-blue-600 hover:bg-blue-700")}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Devolução
            </Button>
          </div>
        )}

        <div className="px-3 sm:px-4 pt-3">
          <ProductSearch onProductSelect={handleProductClick} isOnline={isOnline} />
        </div>
        <ProductGrid
          selectedCategoryId={selectedCategoryId}
          onCategoryChange={setSelectedCategoryId}
          onProductSelect={handleProductClick}
          isOnline={isOnline}
        />

        {isExchange && !canProceed && !isMobile && (
          <div className="px-4 py-2 text-xs text-muted-foreground text-center border-t">
            Adicione ao menos 1 item novo e 1 devolução para prosseguir
          </div>
        )}
      </div>

      {/* Right - Cart (desktop only) */}
      {!isMobile && (
        <div className="w-80 lg:w-96 flex flex-col border-l">
          {cartContent}
        </div>
      )}

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
