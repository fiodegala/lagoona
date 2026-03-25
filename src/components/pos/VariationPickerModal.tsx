import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ProductResult } from '@/components/pos/ProductSearch';
import { Search } from 'lucide-react';

interface VariationPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductResult | null;
  onSelectVariation: (product: ProductResult, variationId: string) => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const VariationPickerModal = ({
  open,
  onOpenChange,
  product,
  onSelectVariation,
}: VariationPickerModalProps) => {
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!open) {
      setSearchTerm('');
    }
  }, [open, product?.id]);

  if (!product) return null;

  const activeVariations = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return product.variations.filter((variation) => {
      if (!variation.is_active) return false;
      if (!normalizedSearch) return true;

      return [variation.label, variation.sku, variation.id]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedSearch));
    });
  }, [product.variations, searchTerm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {product.image_url && (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-10 h-10 rounded object-cover"
              />
            )}
            <span className="truncate">{product.name}</span>
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">Selecione a variação:</p>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar variação por nome, SKU ou código..."
            className="pl-9"
          />
        </div>

        <ScrollArea className="max-h-80">
          <div className="space-y-2">
            {activeVariations.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                Nenhuma variação encontrada.
              </div>
            ) : activeVariations.map((variation) => {
              const hasStock = variation.stock > 0;
              const price = variation.price ?? product.price;

              return (
                <button
                  key={variation.id}
                  className={cn(
                    'w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left',
                    hasStock
                      ? 'hover:border-primary/50 hover:bg-accent cursor-pointer'
                      : 'opacity-50 cursor-not-allowed',
                  )}
                  onClick={() => {
                    if (hasStock) {
                      onSelectVariation(product, variation.id);
                      onOpenChange(false);
                    }
                  }}
                  disabled={!hasStock}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">
                      {variation.label || variation.sku || variation.id.slice(0, 8)}
                    </div>
                    {variation.sku && variation.label && (
                      <div className="text-xs text-muted-foreground">SKU: {variation.sku}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 ml-3">
                    <Badge
                      variant={hasStock ? (variation.stock <= 3 ? 'secondary' : 'outline') : 'destructive'}
                      className={cn(
                        'text-xs',
                        variation.stock <= 3 && hasStock && 'bg-orange-500/20 text-orange-700 border-orange-500/30',
                      )}
                    >
                      {hasStock ? `${variation.stock} un.` : 'Sem estoque'}
                    </Badge>
                    <span className="font-semibold text-sm text-primary whitespace-nowrap">
                      {formatCurrency(price)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default VariationPickerModal;
