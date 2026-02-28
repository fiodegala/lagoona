import { supabase } from '@/integrations/supabase/client';

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  min_stock: number;
  category_id: string | null;
  image_url: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  barcode: string | null;
  wholesale_price: number | null;
  exclusive_price: number | null;
  promotional_price: number | null;
  weight_kg: number | null;
  width_cm: number | null;
  height_cm: number | null;
  depth_cm: number | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateProductData {
  name: string;
  description?: string;
  price: number;
  stock?: number;
  min_stock?: number;
  category_id?: string;
  image_url?: string;
  is_active?: boolean;
  metadata?: Record<string, unknown>;
  wholesale_price?: number;
  exclusive_price?: number;
  promotional_price?: number;
  weight_kg?: number;
  width_cm?: number;
  height_cm?: number;
  depth_cm?: number;
  barcode?: string;
}

export const productsService = {
  async getAll(): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as Product[];
  },

  async getById(id: string): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Product;
  },

  async create(input: CreateProductData): Promise<Product> {
    const insertData = {
      name: input.name,
      description: input.description || null,
      price: input.price,
      stock: input.stock || 0,
      min_stock: input.min_stock ?? 0,
      category_id: input.category_id || null,
      image_url: input.image_url || null,
      is_active: input.is_active ?? true,
      metadata: input.metadata || {},
      wholesale_price: input.wholesale_price ?? null,
      exclusive_price: input.exclusive_price ?? null,
      promotional_price: input.promotional_price ?? null,
      weight_kg: input.weight_kg ?? null,
      width_cm: input.width_cm ?? null,
      height_cm: input.height_cm ?? null,
      depth_cm: input.depth_cm ?? null,
      barcode: input.barcode || null,
    };

    const { data, error } = await supabase
      .from('products')
      .insert(insertData as never)
      .select()
      .single();

    if (error) throw error;
    return data as Product;
  },

  async update(id: string, input: Partial<CreateProductData>): Promise<Product> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.price !== undefined) updateData.price = input.price;
    if (input.stock !== undefined) updateData.stock = input.stock;
    if (input.min_stock !== undefined) updateData.min_stock = input.min_stock;
    if (input.category_id !== undefined) updateData.category_id = input.category_id || null;
    if (input.image_url !== undefined) updateData.image_url = input.image_url;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;
    if (input.metadata !== undefined) updateData.metadata = input.metadata;
    if (input.wholesale_price !== undefined) updateData.wholesale_price = input.wholesale_price;
    if (input.exclusive_price !== undefined) updateData.exclusive_price = input.exclusive_price;
    if (input.promotional_price !== undefined) updateData.promotional_price = input.promotional_price;
    if (input.weight_kg !== undefined) updateData.weight_kg = input.weight_kg;
    if (input.width_cm !== undefined) updateData.width_cm = input.width_cm;
    if (input.height_cm !== undefined) updateData.height_cm = input.height_cm;
    if (input.depth_cm !== undefined) updateData.depth_cm = input.depth_cm;
    if (input.barcode !== undefined) updateData.barcode = input.barcode;

    const { data, error } = await supabase
      .from('products')
      .update(updateData as never)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Product;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async toggleActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('products')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error) throw error;
  },
};

export const categoriesService = {
  async getAll(): Promise<Category[]> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return (data || []) as Category[];
  },

  async create(input: { name: string; slug: string; description?: string }): Promise<Category> {
    const { data, error } = await supabase
      .from('categories')
      .insert({
        name: input.name,
        slug: input.slug,
        description: input.description || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data as Category;
  },
};
