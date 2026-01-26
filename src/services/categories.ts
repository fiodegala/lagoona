import { supabase } from '@/integrations/supabase/client';

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  parent_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCategoryData {
  name: string;
  slug: string;
  description?: string;
  image_url?: string;
  parent_id?: string;
  is_active?: boolean;
}

export const categoriesService = {
  async getAll(): Promise<Category[]> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return (data || []) as Category[];
  },

  async getById(id: string): Promise<Category | null> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data as Category | null;
  },

  async create(input: CreateCategoryData): Promise<Category> {
    const insertData = {
      name: input.name,
      slug: input.slug,
      description: input.description || null,
      image_url: input.image_url || null,
      parent_id: input.parent_id || null,
      is_active: input.is_active ?? true,
    };

    const { data, error } = await supabase
      .from('categories')
      .insert(insertData as never)
      .select()
      .single();

    if (error) throw error;
    return data as Category;
  },

  async update(id: string, input: Partial<CreateCategoryData>): Promise<Category> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    
    if (input.name !== undefined) updateData.name = input.name;
    if (input.slug !== undefined) updateData.slug = input.slug;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.image_url !== undefined) updateData.image_url = input.image_url;
    if (input.parent_id !== undefined) updateData.parent_id = input.parent_id;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;

    const { data, error } = await supabase
      .from('categories')
      .update(updateData as never)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Category;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async toggleActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('categories')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error) throw error;
  },
};
