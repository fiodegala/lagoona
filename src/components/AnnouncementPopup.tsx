import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { playAnnouncementSound } from '@/lib/alertSounds';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Megaphone } from 'lucide-react';

const AnnouncementPopup = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [open, setOpen] = useState(false);

  const { data: announcements = [] } = useQuery({
    queryKey: ['active-announcements', user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Get active announcements
      const { data: all, error } = await supabase
        .from('admin_announcements')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Get dismissals
      const { data: dismissals } = await supabase
        .from('announcement_dismissals')
        .select('announcement_id')
        .eq('user_id', user!.id);

      const dismissedIds = new Set((dismissals || []).map((d: any) => d.announcement_id));
      const now = new Date();

      return (all || []).filter((a: any) => {
        if (dismissedIds.has(a.id)) return false;
        if (a.expires_at && new Date(a.expires_at) < now) return false;
        if (a.target_type === 'specific' && !(a.target_user_ids || []).includes(user!.id)) return false;
        return true;
      });
    },
    refetchInterval: 60000,
  });

  useEffect(() => {
    if (announcements.length > 0) {
      setCurrentIndex(0);
      setOpen(true);
      playAnnouncementSound();
    }
  }, [announcements.length]);

  const dismissMutation = useMutation({
    mutationFn: async (announcementId: string) => {
      await supabase.from('announcement_dismissals').insert({
        announcement_id: announcementId,
        user_id: user!.id,
      });
    },
    onSuccess: () => {
      if (currentIndex < announcements.length - 1) {
        setCurrentIndex((i) => i + 1);
      } else {
        setOpen(false);
        queryClient.invalidateQueries({ queryKey: ['active-announcements'] });
      }
    },
  });

  if (!announcements.length || !open) return null;

  const current = announcements[currentIndex];
  if (!current) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) dismissMutation.mutate(current.id); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            {current.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {current.video_url && (
            <video src={current.video_url} controls className="w-full rounded-lg max-h-64" />
          )}
          {current.image_url && !current.video_url && (
            <img src={current.image_url} alt={current.title} className="w-full rounded-lg object-cover max-h-48" />
          )}
          <p className="text-sm whitespace-pre-wrap">{current.message}</p>
          <div className="flex items-center justify-between">
            {current.link_url ? (
              <a href={current.link_url} target="_blank" rel="noopener noreferrer">
                <Button size="sm">{current.link_text || 'Saiba mais'}</Button>
              </a>
            ) : <div />}
            <Button variant="outline" size="sm" onClick={() => dismissMutation.mutate(current.id)}>
              {currentIndex < announcements.length - 1 ? 'Próximo' : 'Fechar'}
            </Button>
          </div>
          {announcements.length > 1 && (
            <p className="text-xs text-center text-muted-foreground">{currentIndex + 1} de {announcements.length}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AnnouncementPopup;
