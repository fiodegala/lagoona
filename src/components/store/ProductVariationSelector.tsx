import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { variationsService, ProductVariation, ProductAttribute } from '@/services/variations';
import { supabase } from '@/integrations/supabase/client';
import { COLOR_MAP, isLightColor } from '@/lib/colorMap';

interface ProductVariationSelectorProps {
  productId: string;
  onVariationSelect: (variation: ProductVariation | null) => void;
  onHasVariations?: (has: boolean) => void;
}

const ProductVariationSelector = ({ productId, onVariationSelect, onHasVariations }: ProductVariationSelectorProps) => {
  const [attributes, setAttributes] = useState<ProductAttribute[]>([]);
  const [variations, setVariations] = useState<ProductVariation[]>([]);
  const [selectedValues, setSelectedValues] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [stockTrusted, setStockTrusted] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setStockTrusted(false);
        const [attrs, vars, stockRes] = await Promise.all([
          variationsService.getAttributesByProduct(productId),
          variationsService.getVariationsByProduct(productId),
          supabase.rpc('get_product_stock' as any, { _product_id: productId }),
        ]);
        setAttributes(attrs);
        const activeVars = vars.filter(v => v.is_active);
        setVariations(activeVars);
        onHasVariations?.(activeVars.length > 0);

        // Build stock map. If the store_stock query errored (e.g. RLS blocks
        // the visitor) or returned NO rows at all for a product that has
        // active variations, we cannot trust it — fall back to the legacy
        // `stock` field on each variation so the storefront never marks
        // everything as "Esgotado" by mistake.
        const rows = stockRes.data || [];
        const queryFailed = !!stockRes.error;
        const noRowsAtAll = !queryFailed && rows.length === 0 && activeVars.length > 0;
        const useFallback = queryFailed || noRowsAtAll;

        const map: Record<string, number> = {};
        if (useFallback) {
          if (queryFailed) {
            console.warn('[ProductVariationSelector] store_stock query failed, falling back to legacy stock:', stockRes.error);
          } else {
            console.warn('[ProductVariationSelector] store_stock returned no rows, falling back to legacy stock');
          }
          activeVars.forEach(v => {
            map[v.id] = typeof v.stock === 'number' ? v.stock : 1;
          });
          setStockTrusted(false);
        } else {
          rows.forEach((row: any) => {
            if (row.variation_id) {
              map[row.variation_id] = (map[row.variation_id] || 0) + row.quantity;
            }
          });
          // For active variations missing in store_stock, fall back to legacy
          // stock instead of silently treating them as out of stock.
          activeVars.forEach(v => {
            if (map[v.id] === undefined) {
              map[v.id] = typeof v.stock === 'number' ? v.stock : 0;
            }
          });
          setStockTrusted(true);
        }
        setStockMap(map);
      } catch (error) {
        console.error('Error loading variations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [productId]);

  useEffect(() => {
    if (Object.keys(selectedValues).length === attributes.length && attributes.length > 0) {
      const matchingVariation = variations.find((variation) => {
        return variation.attribute_values?.every((av) => {
          return selectedValues[av.attribute_name] === av.value;
        });
      });
      if (matchingVariation) {
        // Enrich with real stock before passing
        const realStock = stockMap[matchingVariation.id] || 0;
        onVariationSelect({ ...matchingVariation, stock: realStock });
      } else {
        onVariationSelect(null);
      }
    } else {
      onVariationSelect(null);
    }
  }, [selectedValues, variations, attributes, onVariationSelect, stockMap]);

  const handleValueSelect = (attributeName: string, value: string) => {
    setSelectedValues((prev) => ({
      ...prev,
      [attributeName]: prev[attributeName] === value ? '' : value,
    }));
  };

  const isValueAvailable = (attributeName: string, value: string): boolean => {
    const otherSelections = { ...selectedValues };
    delete otherSelections[attributeName];

    return variations.some((variation) => {
      const hasThisValue = variation.attribute_values?.some(
        (av) => av.attribute_name === attributeName && av.value === value
      );
      
      if (!hasThisValue) return false;

      return Object.entries(otherSelections).every(([attrName, attrValue]) => {
        if (!attrValue) return true;
        return variation.attribute_values?.some(
          (av) => av.attribute_name === attrName && av.value === attrValue
        );
      });
    });
  };

  const getVariationStock = (attributeName: string, value: string): number => {
    const matchingVariations = variations.filter((variation) => {
      return variation.attribute_values?.some(
        (av) => av.attribute_name === attributeName && av.value === value
      );
    });

    return matchingVariations.reduce((total, v) => total + (stockMap[v.id] || 0), 0);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 bg-muted rounded w-20" />
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 w-16 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (attributes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {attributes.map((attribute) => {
        const isColorAttr = attribute.name.toLowerCase().includes('cor');
        return (
          <div key={attribute.id} className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">{attribute.name}:</span>
              {selectedValues[attribute.name] && (
                <span className="text-sm text-muted-foreground">
                  {selectedValues[attribute.name]}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {attribute.values?.map((value) => {
                const isSelected = selectedValues[attribute.name] === value.value;
                const isAvailable = isValueAvailable(attribute.name, value.value);
                const stock = getVariationStock(attribute.name, value.value);
                const isOutOfStock = stock === 0;
                const colorHex = isColorAttr ? ((value as any).color_hex || COLOR_MAP[value.value.toLowerCase().trim()] || null) : null;

                return (
                  <Button
                    key={value.id}
                    variant={isSelected ? 'default' : 'outline'}
                    size="sm"
                    disabled={!isAvailable || isOutOfStock}
                    onClick={() => handleValueSelect(attribute.name, value.value)}
                    className={cn(
                      'relative min-w-[60px] transition-all gap-1.5',
                      isSelected && 'bg-store-primary text-store-accent hover:bg-store-primary/90',
                      !isAvailable && 'opacity-50 line-through',
                      isOutOfStock && 'opacity-40'
                    )}
                  >
                    {colorHex && (
                      <span
                        className={cn(
                          "h-3.5 w-3.5 rounded-full shrink-0 inline-block",
                          isLightColor(colorHex) && "border border-border"
                        )}
                        style={{ backgroundColor: colorHex }}
                      />
                    )}
                    {value.value}
                    {isOutOfStock && isAvailable && (
                      <Badge 
                        variant="secondary" 
                        className="absolute -top-2 -right-2 text-[10px] px-1 py-0"
                      >
                        Esgotado
                      </Badge>
                    )}
                  </Button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProductVariationSelector;
