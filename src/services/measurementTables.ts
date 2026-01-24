import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';

export interface MeasurementColumn {
  name: string;
  unit?: string;
}

export interface MeasurementRow {
  size: string;
  values: Record<string, string>;
}

export interface MeasurementTable {
  id: string;
  category_id: string;
  name: string;
  columns: MeasurementColumn[];
  rows: MeasurementRow[];
  created_at: string;
  updated_at: string;
}

export interface CreateMeasurementTableData {
  category_id: string;
  name?: string;
  columns?: MeasurementColumn[];
  rows?: MeasurementRow[];
}

const parseColumns = (columns: Json): MeasurementColumn[] => {
  if (Array.isArray(columns)) {
    return columns as unknown as MeasurementColumn[];
  }
  return [];
};

const parseRows = (rows: Json): MeasurementRow[] => {
  if (Array.isArray(rows)) {
    return rows as unknown as MeasurementRow[];
  }
  return [];
};

export const measurementTablesService = {
  async getByCategory(categoryId: string): Promise<MeasurementTable | null> {
    const { data, error } = await supabase
      .from('measurement_tables')
      .select('*')
      .eq('category_id', categoryId)
      .maybeSingle();

    if (error) throw error;
    
    if (data) {
      return {
        ...data,
        columns: parseColumns(data.columns),
        rows: parseRows(data.rows),
      };
    }
    return null;
  },

  async getAll(): Promise<MeasurementTable[]> {
    const { data, error } = await supabase
      .from('measurement_tables')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    return (data || []).map((item) => ({
      ...item,
      columns: parseColumns(item.columns),
      rows: parseRows(item.rows),
    }));
  },

  async create(input: CreateMeasurementTableData): Promise<MeasurementTable> {
    const { data, error } = await supabase
      .from('measurement_tables')
      .insert({
        category_id: input.category_id,
        name: input.name || 'Tabela de Medidas',
        columns: (input.columns || []) as unknown as Json,
        rows: (input.rows || []) as unknown as Json,
      })
      .select()
      .single();

    if (error) throw error;
    
    return {
      ...data,
      columns: parseColumns(data.columns),
      rows: parseRows(data.rows),
    };
  },

  async update(id: string, input: Partial<CreateMeasurementTableData>): Promise<MeasurementTable> {
    const updateData: Record<string, unknown> = {};
    
    if (input.name !== undefined) updateData.name = input.name;
    if (input.columns !== undefined) updateData.columns = input.columns as unknown as Json;
    if (input.rows !== undefined) updateData.rows = input.rows as unknown as Json;

    const { data, error } = await supabase
      .from('measurement_tables')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    
    return {
      ...data,
      columns: parseColumns(data.columns),
      rows: parseRows(data.rows),
    };
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('measurement_tables')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
