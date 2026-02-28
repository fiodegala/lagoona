import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { variationsService, ProductVariation, ProductAttribute } from '@/services/variations';
import { supabase } from '@/integrations/supabase/client';

interface ProductVariationSelectorProps {
  productId: string;
  onVariationSelect: (variation: ProductVariation | null) => void;
}

const ProductVariationSelector = ({ productId, onVariationSelect }: ProductVariationSelectorProps) => {
  const [attributes, setAttributes] = useState<ProductAttribute[]>([]);
  const [variations, setVariations] = useState<ProductVariation[]>([]);
  const [selectedValues, setSelectedValues] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const [attrs, vars, stockRes] = await Promise.all([
          variationsService.getAttributesByProduct(productId),
          variationsService.getVariationsByProduct(productId),
          supabase
            .from('store_stock')
            .select('variation_id, quantity')
            .eq('product_id', productId)
            .not('variation_id', 'is', null),
        ]);
        setAttributes(attrs);
        setVariations(vars.filter(v => v.is_active));

        // Build stock map: variation_id -> total quantity across stores
        const map: Record<string, number> = {};
        (stockRes.data || []).forEach((row: any) => {
          if (row.variation_id) {
            map[row.variation_id] = (map[row.variation_id] || 0) + row.quantity;
          }
        });
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
      {attributes.map((attribute) => (
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

              return (
                <Button
                  key={value.id}
                  variant={isSelected ? 'default' : 'outline'}
                  size="sm"
                  disabled={!isAvailable || isOutOfStock}
                  onClick={() => handleValueSelect(attribute.name, value.value)}
                  className={cn(
                    'relative min-w-[60px] transition-all',
                    isSelected && 'bg-store-primary text-store-accent hover:bg-store-primary/90',
                    !isAvailable && 'opacity-50 line-through',
                    isOutOfStock && 'opacity-40'
                  )}
                >
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
      ))}
    </div>
  );
};

export default ProductVariationSelector;
