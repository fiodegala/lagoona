import { supabase } from '@/integrations/supabase/client';

export interface ProductAttribute {
  id: string;
  product_id: string;
  name: string;
  created_at: string;
  values?: ProductAttributeValue[];
}

export interface ProductAttributeValue {
  id: string;
  attribute_id: string;
  value: string;
  created_at: string;
}

export interface ProductVariation {
  id: string;
  product_id: string;
  sku: string | null;
  barcode: string | null;
  price: number | null;
  wholesale_price: number | null;
  exclusive_price: number | null;
  stock: number;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  attribute_values?: { attribute_name: string; value: string }[];
}

export interface CreateAttributeData {
  product_id: string;
  name: string;
  values: string[];
}

export interface CreateVariationData {
  product_id: string;
  sku?: string;
  barcode?: string;
  price?: number;
  wholesale_price?: number;
  exclusive_price?: number;
  stock?: number;
  image_url?: string;
  is_active?: boolean;
  attribute_value_ids: string[];
}

export const variationsService = {
  // Attributes
  async getAttributesByProduct(productId: string): Promise<ProductAttribute[]> {
    const { data: attributes, error: attrError } = await supabase
      .from('product_attributes')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: true });

    if (attrError) throw attrError;

    // Get values for each attribute
    const attributesWithValues = await Promise.all(
      (attributes || []).map(async (attr) => {
        const { data: values, error: valError } = await supabase
          .from('product_attribute_values')
          .select('*')
          .eq('attribute_id', attr.id)
          .order('created_at', { ascending: true });

        if (valError) throw valError;

        return {
          ...attr,
          values: values || [],
        } as ProductAttribute;
      })
    );

    return attributesWithValues;
  },

  async createAttribute(data: CreateAttributeData): Promise<ProductAttribute> {
    // Create attribute
    const { data: attribute, error: attrError } = await supabase
      .from('product_attributes')
      .insert({
        product_id: data.product_id,
        name: data.name,
      })
      .select()
      .single();

    if (attrError) throw attrError;

    // Create values
    if (data.values.length > 0) {
      const valuesData = data.values.map((value) => ({
        attribute_id: attribute.id,
        value: value.trim(),
      }));

      const { error: valError } = await supabase
        .from('product_attribute_values')
        .insert(valuesData);

      if (valError) throw valError;
    }

    return attribute as ProductAttribute;
  },

  async deleteAttribute(attributeId: string): Promise<void> {
    const { error } = await supabase
      .from('product_attributes')
      .delete()
      .eq('id', attributeId);

    if (error) throw error;
  },

  async addAttributeValue(attributeId: string, value: string): Promise<ProductAttributeValue> {
    const { data, error } = await supabase
      .from('product_attribute_values')
      .insert({
        attribute_id: attributeId,
        value: value.trim(),
      })
      .select()
      .single();

    if (error) throw error;
    return data as ProductAttributeValue;
  },

  async deleteAttributeValue(valueId: string): Promise<void> {
    const { error } = await supabase
      .from('product_attribute_values')
      .delete()
      .eq('id', valueId);

    if (error) throw error;
  },

  // Variations
  async getVariationsByProduct(productId: string): Promise<ProductVariation[]> {
    const { data: variations, error: varError } = await supabase
      .from('product_variations')
      .select('*')
      .eq('product_id', productId)
      .order('sort_order', { ascending: true });

    if (varError) throw varError;

    // Get attribute values for each variation
    const variationsWithValues = await Promise.all(
      (variations || []).map(async (variation) => {
        const { data: valueLinks, error: linkError } = await supabase
          .from('product_variation_values')
          .select(`
            attribute_value_id,
            product_attribute_values (
              id,
              value,
              attribute_id,
              product_attributes (
                name
              )
            )
          `)
          .eq('variation_id', variation.id);

        if (linkError) throw linkError;

        const attributeValues = (valueLinks || []).map((link: any) => ({
          attribute_name: link.product_attribute_values?.product_attributes?.name || '',
          value: link.product_attribute_values?.value || '',
        }));

        return {
          ...variation,
          attribute_values: attributeValues,
        } as ProductVariation;
      })
    );

    return variationsWithValues;
  },

  async createVariation(data: CreateVariationData): Promise<ProductVariation> {
    // Get max sort_order for this product
    const { data: maxOrderData } = await supabase
      .from('product_variations')
      .select('sort_order')
      .eq('product_id', data.product_id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const nextSortOrder = (maxOrderData?.sort_order ?? -1) + 1;

    // Create variation
    const { data: variation, error: varError } = await supabase
      .from('product_variations')
      .insert({
        product_id: data.product_id,
        sku: data.sku || null,
        barcode: data.barcode || null,
        price: data.price ?? null,
        stock: data.stock ?? 0,
        image_url: data.image_url || null,
        is_active: data.is_active ?? true,
        sort_order: nextSortOrder,
      })
      .select()
      .single();

    if (varError) throw varError;

    // Link attribute values
    if (data.attribute_value_ids.length > 0) {
      const links = data.attribute_value_ids.map((valueId) => ({
        variation_id: variation.id,
        attribute_value_id: valueId,
      }));

      const { error: linkError } = await supabase
        .from('product_variation_values')
        .insert(links);

      if (linkError) throw linkError;
    }

    return variation as ProductVariation;
  },

  async updateVariation(
    variationId: string,
    data: Partial<Omit<CreateVariationData, 'product_id' | 'attribute_value_ids'>>
  ): Promise<ProductVariation> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (data.sku !== undefined) updateData.sku = data.sku;
    if ((data as { barcode?: string }).barcode !== undefined) updateData.barcode = (data as { barcode?: string }).barcode;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.stock !== undefined) updateData.stock = data.stock;
    if (data.image_url !== undefined) updateData.image_url = data.image_url;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;

    const { data: variation, error } = await supabase
      .from('product_variations')
      .update(updateData)
      .eq('id', variationId)
      .select()
      .single();

    if (error) throw error;
    return variation as ProductVariation;
  },

  async deleteVariation(variationId: string): Promise<void> {
    const { error } = await supabase
      .from('product_variations')
      .delete()
      .eq('id', variationId);

    if (error) throw error;
  },

  async reorderVariations(variationIds: string[]): Promise<void> {
    // Update sort_order for each variation based on new order
    const updates = variationIds.map((id, index) => 
      supabase
        .from('product_variations')
        .update({ sort_order: index, updated_at: new Date().toISOString() })
        .eq('id', id)
    );

    const results = await Promise.all(updates);
    const error = results.find((r) => r.error)?.error;
    if (error) throw error;
  },

  // Generate all combinations
  generateCombinations(attributes: ProductAttribute[]): { values: ProductAttributeValue[]; label: string }[] {
    if (attributes.length === 0 || attributes.some(a => !a.values || a.values.length === 0)) {
      return [];
    }

    const combine = (
      attrIndex: number,
      currentCombo: ProductAttributeValue[]
    ): { values: ProductAttributeValue[]; label: string }[] => {
      if (attrIndex >= attributes.length) {
        const label = currentCombo.map(v => v.value).join(' / ');
        return [{ values: [...currentCombo], label }];
      }

      const attr = attributes[attrIndex];
      const results: { values: ProductAttributeValue[]; label: string }[] = [];

      for (const value of attr.values || []) {
        results.push(...combine(attrIndex + 1, [...currentCombo, value]));
      }

      return results;
    };

    return combine(0, []);
  },
};
