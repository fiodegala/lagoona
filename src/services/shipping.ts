import { supabase } from '@/integrations/supabase/client';

export interface ShippingZone {
  id: string;
  name: string;
  zip_start: string;
  zip_end: string;
  base_price: number;
  price_per_kg: number;
  free_shipping_min_value: number | null;
  estimated_days_min: number;
  estimated_days_max: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateShippingZoneData {
  name: string;
  zip_start: string;
  zip_end: string;
  base_price: number;
  price_per_kg?: number;
  free_shipping_min_value?: number | null;
  estimated_days_min?: number;
  estimated_days_max?: number;
  is_active?: boolean;
}

export const shippingService = {
  async getAll(): Promise<ShippingZone[]> {
    const { data, error } = await supabase
      .from('shipping_zones')
      .select('*')
      .order('zip_start', { ascending: true });

    if (error) throw error;
    return (data || []) as ShippingZone[];
  },

  async create(input: CreateShippingZoneData): Promise<ShippingZone> {
    const { data, error } = await supabase
      .from('shipping_zones')
      .insert(input)
      .select()
      .single();

    if (error) throw error;
    return data as ShippingZone;
  },

  async update(id: string, input: Partial<CreateShippingZoneData>): Promise<ShippingZone> {
    const { data, error } = await supabase
      .from('shipping_zones')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as ShippingZone;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('shipping_zones')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async toggleActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('shipping_zones')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error) throw error;
  },

  async calculateShipping(zipCode: string, weightKg: number, orderTotal: number): Promise<{
    zone: ShippingZone;
    price: number;
    isFreeShipping: boolean;
    estimatedDays: string;
  } | null> {
    const cleanZip = zipCode.replace(/\D/g, '');
    
    const { data, error } = await supabase
      .from('shipping_zones')
      .select('*')
      .eq('is_active', true)
      .lte('zip_start', cleanZip)
      .gte('zip_end', cleanZip)
      .limit(1);

    if (error) throw error;
    if (!data || data.length === 0) return null;

    const zone = data[0] as ShippingZone;
    const isFreeShipping = zone.free_shipping_min_value !== null && orderTotal >= zone.free_shipping_min_value;
    const price = isFreeShipping ? 0 : zone.base_price + (zone.price_per_kg * weightKg);
    const estimatedDays = zone.estimated_days_min === zone.estimated_days_max
      ? `${zone.estimated_days_min} dias úteis`
      : `${zone.estimated_days_min} a ${zone.estimated_days_max} dias úteis`;

    return { zone, price, isFreeShipping, estimatedDays };
  },
};
