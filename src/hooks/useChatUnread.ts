import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { playChatMessageSound } from '@/lib/alertSounds';
import { useLocation } from 'react-router-dom';

export function useChatUnread() {
  const { user } = useAuth();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [userConversationIds, setUserConversationIds] = useState<string[]>([]);

  // Load user's conversation IDs
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id);
      if (data) {
        setUserConversationIds(data.map(d => d.conversation_id));
      }
    };
    load();
  }, [user]);

  // Reset unread when navigating to chat page
  useEffect(() => {
    if (location.pathname === '/admin/chat') {
      setUnreadCount(0);
    }
  }, [location.pathname]);

  // Subscribe to new messages
  useEffect(() => {
    if (!user || userConversationIds.length === 0) return;

    const channel = supabase
      .channel('chat-unread-global')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
      }, (payload) => {
        const msg = payload.new as { sender_id: string; conversation_id: string };
        // Only count messages from others in our conversations
        if (msg.sender_id === user.id) return;
        if (!userConversationIds.includes(msg.conversation_id)) return;

        // If user is NOT on the chat page, increment unread and play sound
        if (window.location.pathname !== '/admin/chat') {
          setUnreadCount(prev => prev + 1);
          playChatMessageSound();
        } else {
          // On chat page but still play sound for messages in other conversations
          playChatMessageSound();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, userConversationIds]);

  const resetUnread = useCallback(() => setUnreadCount(0), []);

  return { unreadCount, resetUnread };
}
