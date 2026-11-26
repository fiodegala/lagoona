import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SaleActionTag { id: string; name: string; is_active: boolean }
export const saleActionTagsKey = ['sale-action-tags'];

export function useSaleActionTags() {
  return useQuery({
    queryKey: saleActionTagsKey,
    queryFn: async (): Promise<SaleActionTag[]> => {
      const tags: SaleActionTag[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from('sale_action_tags')
          .select('id, name, is_active').order('name').order('id').range(offset, offset + 999);
        if (error) throw error;
        tags.push(...(data || []));
        if (!data || data.length < 1000) return tags;
      }
    },
  });
}