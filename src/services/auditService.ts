import { supabase } from '@/integrations/supabase/client';

export interface AuditLogEntry {
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: Record<string, any>;
}

export const auditService = {
  async log(entry: AuditLogEntry) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user name from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single();

      await supabase.from('audit_logs' as any).insert({
        user_id: user.id,
        user_name: profile?.full_name || user.email || 'Desconhecido',
        action: entry.action,
        entity_type: entry.entity_type,
        entity_id: entry.entity_id || null,
        details: entry.details || {},
      });
    } catch (e) {
      console.error('Audit log error:', e);
    }
  },
};
