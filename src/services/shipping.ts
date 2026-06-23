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

export const MIN_FREE_SHIPPING_VALUE = 499;

function validateZoneInput(input: Partial<CreateShippingZoneData>) {
  if (input.free_shipping_min_value != null && input.free_shipping_min_value < MIN_FREE_SHIPPING_VALUE) {
    throw new Error(`Frete grátis só pode ser configurado a partir de R$ ${MIN_FREE_SHIPPING_VALUE.toFixed(2).replace('.', ',')}.`);
  }
  if (input.base_price != null && input.base_price < 0) throw new Error('Preço base não pode ser negativo.');
  if (input.price_per_kg != null && input.price_per_kg < 0) throw new Error('Preço por kg não pode ser negativo.');
  if (input.estimated_days_min != null && input.estimated_days_min < 1) throw new Error('Prazo mínimo deve ser pelo menos 1 dia.');
  if (
    input.estimated_days_min != null &&
    input.estimated_days_max != null &&
    input.estimated_days_max < input.estimated_days_min
  ) throw new Error('Prazo máximo não pode ser menor que o prazo mínimo.');
  if (input.zip_start && input.zip_end) {
    const a = input.zip_start.replace(/\D/g, '');
    const b = input.zip_end.replace(/\D/g, '');
    if (a.length !== 8 || b.length !== 8) throw new Error('CEPs devem ter 8 dígitos.');
    if (a > b) throw new Error('CEP inicial deve ser menor ou igual ao CEP final.');
  }
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
