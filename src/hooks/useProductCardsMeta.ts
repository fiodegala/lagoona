import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ProductCardMeta {
  colorValues: string[];
  hasVariations: boolean;
  avgRating: number;
  reviewCount: number;
}

/**
 * Batch-fetches color attributes and variation existence for a list of product IDs.
 * Eliminates N+1 queries from individual ProductCards.
 */
export function useProductCardsMeta(productIds: string[]) {
  const [meta, setMeta] = useState<Record<string, ProductCardMeta>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (productIds.length === 0) {
      setMeta({});
      setIsLoaded(true);
      return;
    }

    // Create a stable key to avoid re-fetching the same set
    const key = productIds.slice().sort().join(',');
    let cancelled = false;

    const fetchMeta = async () => {
      try {
        // 1. Fetch color attributes for all products in one query
        const { data: colorAttrs } = await supabase
          .from('product_attributes')
          .select('id, product_id, name')
          .in('product_id', productIds)
          .ilike('name', '%cor%');

        // 2. If we have color attributes, fetch their values in one query
        let colorValuesMap: Record<string, string[]> = {};
        if (colorAttrs && colorAttrs.length > 0) {
          const attrIds = colorAttrs.map(a => a.id);
          const attrToProduct: Record<string, string> = {};
          colorAttrs.forEach(a => { attrToProduct[a.id] = a.product_id; });

          const { data: values } = await supabase
            .from('product_attribute_values')
            .select('attribute_id, value')
            .in('attribute_id', attrIds);

          if (values) {
            values.forEach(v => {
              const pid = attrToProduct[v.attribute_id];
              if (pid) {
                if (!colorValuesMap[pid]) colorValuesMap[pid] = [];
                colorValuesMap[pid].push(v.value);
              }
            });
          }
        }

        // 3. Fetch which products have active variations (one query)
        const { data: variations } = await supabase
          .from('product_variations')
          .select('product_id')
          .in('product_id', productIds)
          .eq('is_active', true);

        const hasVarSet = new Set<string>();
        variations?.forEach(v => hasVarSet.add(v.product_id));

        // 4. Fetch approved reviews for rating display
        const { data: reviews } = await supabase
          .from('product_reviews')
          .select('product_id, rating')
          .in('product_id', productIds)
          .eq('is_approved', true);

        const reviewMap: Record<string, { sum: number; count: number }> = {};
        reviews?.forEach(r => {
          if (!reviewMap[r.product_id]) reviewMap[r.product_id] = { sum: 0, count: 0 };
          reviewMap[r.product_id].sum += r.rating;
          reviewMap[r.product_id].count += 1;
        });

        if (cancelled) return;

        // Build meta map
        const result: Record<string, ProductCardMeta> = {};
        productIds.forEach(pid => {
          const rv = reviewMap[pid];
          result[pid] = {
            colorValues: colorValuesMap[pid] || [],
            hasVariations: hasVarSet.has(pid),
            avgRating: rv ? rv.sum / rv.count : 0,
            reviewCount: rv ? rv.count : 0,
          };
        });

        setMeta(result);
        setIsLoaded(true);
      } catch (error) {
        console.error('Error batch-fetching product card meta:', error);
        setIsLoaded(true);
      }
    };

    fetchMeta();
    return () => { cancelled = true; };
  }, [productIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  return { meta, isLoaded };
}
