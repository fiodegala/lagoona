import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useChatUnread } from '@/hooks/useChatUnread';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Send, Plus, Users, MessageCircle, X, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Conversation {
  id: string;
  name: string | null;
  type: 'direct' | 'group';
  created_by: string;
  updated_at: string;
}

interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

interface AdminUser {
  id: string;
  full_name: string;
}

const FloatingChatWidget = () => {
  const { user } = useAuth();
  const { unreadCount, resetUnread } = useChatUnread();
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [members, setMembers] = useState<Record<string, AdminUser>>({});
  const [conversationMembers, setConversationMembers] = useState<string[]>([]);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [newConvName, setNewConvName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load admin users
  useEffect(() => {
    if (!open) return;
    const loadUsers = async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id');
      if (!roles) return;
      const userIds = [...new Set(roles.map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);
      if (profiles) {
        const users = profiles.map(p => ({ id: p.user_id, full_name: p.full_name || 'Sem nome' }));
        setAdminUsers(users);
        const map: Record<string, AdminUser> = {};
        users.forEach(u => { map[u.id] = u; });
        setMembers(map);
      }
    };
    loadUsers();
  }, [open]);

  const loadConversations = useCallback(async () => {
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false });
    if (data) setConversations(data as Conversation[]);
  }, []);

  useEffect(() => {
    if (open) {
      loadConversations();
      resetUnread();
    }
  }, [open, loadConversations, resetUnread]);

  // Load messages
  useEffect(() => {
    if (!selectedConversation) return;
    const load = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', selectedConversation)
        .order('created_at', { ascending: true });
      if (data) setMessages(data as ChatMessage[]);
      const { data: mems } = await supabase
        .from('conversation_members')
        .select('user_id')
        .eq('conversation_id', selectedConversation);
      if (mems) setConversationMembers(mems.map(m => m.user_id));
    };
    load();
  }, [selectedConversation]);

  // Realtime
  useEffect(() => {
    if (!open) return;
    const channel = supabase
      .channel('floating-chat-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        const newMsg = payload.new as ChatMessage;
        if (newMsg.conversation_id === selectedConversation) {
          setMessages(prev => [...prev, newMsg]);
        }
        setConversations(prev => {
          const updated = prev.map(c =>
            c.id === newMsg.conversation_id ? { ...c, updated_at: newMsg.created_at } : c
          );
          return updated.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [open, selectedConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user) return;
    setSending(true);
    const { error } = await supabase.from('chat_messages').insert({
      conversation_id: selectedConversation,
      sender_id: user.id,
      content: newMessage.trim(),
    });
    if (error) {
      toast.error('Erro ao enviar mensagem');
    } else {
      setNewMessage('');
      await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', selectedConversation);
    }
    setSending(false);
  };

  const createConversation = async () => {
    if (!user || selectedUsers.length === 0) return;
    const isGroup = selectedUsers.length > 1;
    const convName = isGroup ? newConvName || `Grupo (${selectedUsers.length + 1})` : null;
    const convId = crypto.randomUUID();

    const { error } = await supabase
      .from('conversations')
      .insert({ id: convId, name: convName, type: isGroup ? 'group' : 'direct', created_by: user.id });
    if (error) { toast.error('Erro ao criar conversa'); return; }

    const allMembers = [...selectedUsers, user.id].map(uid => ({
      conversation_id: convId,
      user_id: uid,
    }));
    const { error: membersError } = await supabase.from('conversation_members').insert(allMembers);
    if (membersError) { toast.error('Erro ao adicionar membros'); return; }

    setShowNewConversation(false);
    setSelectedUsers([]);
    setNewConvName('');
    await loadConversations();
    setSelectedConversation(convId);
    toast.success('Conversa criada!');
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const getConversationDisplayName = (conv: Conversation) => {
    if (conv.name) return conv.name;
    return 'Conversa Direta';
  };

  const selectedConv = conversations.find(c => c.id === selectedConversation);

  // Don't render on the chat page itself
  if (typeof window !== 'undefined' && window.location.pathname === '/admin/chat') return null;

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110',
          'bg-primary text-primary-foreground',
          open && 'rotate-0'
        )}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!open && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] flex items-center justify-center rounded-full bg-green-500 text-white text-[11px] font-bold px-1 animate-pulse border-2 border-background">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Chat Popup */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] h-[520px] rounded-2xl shadow-2xl border bg-card flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-300">
          {/* Header */}
          <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {selectedConversation && (
                <button onClick={() => setSelectedConversation(null)} className="hover:opacity-80">
                  <ArrowLeft className="h-5 w-5" />
                </button>
              )}
              <MessageCircle className="h-5 w-5" />
              <span className="font-semibold text-sm">
                {selectedConv ? getConversationDisplayName(selectedConv) : 'Chat Interno'}
              </span>
            </div>
            <button onClick={() => setOpen(false)} className="hover:opacity-80">
              <X className="h-5 w-5" />
            </button>
          </div>

          {!selectedConversation ? (
            /* Conversation List */
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-2 border-b flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground px-2">Conversas</span>
                <Dialog open={showNewConversation} onOpenChange={setShowNewConversation}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Nova Conversa</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      {selectedUsers.length > 1 && (
                        <Input
                          placeholder="Nome do grupo (opcional)"
                          value={newConvName}
                          onChange={e => setNewConvName(e.target.value)}
                        />
                      )}
                      <p className="text-sm text-muted-foreground">Selecione os participantes:</p>
                      <ScrollArea className="h-60">
                        <div className="space-y-2">
                          {adminUsers.filter(u => u.id !== user?.id).map(u => (
                            <label key={u.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer">
                              <Checkbox
                                checked={selectedUsers.includes(u.id)}
                                onCheckedChange={(checked) => {
                                  setSelectedUsers(prev =>
                                    checked ? [...prev, u.id] : prev.filter(id => id !== u.id)
                                  );
                                }}
                              />
                              <Avatar className="h-7 w-7">
                                <AvatarFallback className="text-[10px] bg-primary/10">{getInitials(u.full_name)}</AvatarFallback>
                              </Avatar>
                              <span className="text-sm">{u.full_name}</span>
                            </label>
                          ))}
                        </div>
                      </ScrollArea>
                      <Button onClick={createConversation} disabled={selectedUsers.length === 0} className="w-full">
                        {selectedUsers.length > 1 ? 'Criar Grupo' : 'Iniciar Conversa'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <ScrollArea className="flex-1">
                {conversations.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    Nenhuma conversa. Clique em + para iniciar.
                  </div>
                ) : (
                  conversations.map(conv => (
                    <button
                      key={conv.id}
                      className="w-full text-left px-3 py-2.5 border-b hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedConversation(conv.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          {conv.type === 'group' ? (
                            <Users className="h-4 w-4 text-primary" />
                          ) : (
                            <MessageCircle className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm truncate">{conv.name || 'Conversa Direta'}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(conv.updated_at), 'HH:mm', { locale: ptBR })}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-[9px] px-1 h-4">
                            {conv.type === 'group' ? 'Grupo' : 'Direto'}
                          </Badge>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </ScrollArea>
            </div>
          ) : (
            /* Chat Messages */
            <div className="flex-1 flex flex-col overflow-hidden">
              <ScrollArea className="flex-1 p-3">
                <div className="space-y-2">
                  {messages.map(msg => {
                    const isMe = msg.sender_id === user?.id;
                    const sender = members[msg.sender_id];
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className="max-w-[80%]">
                          {!isMe && (
                            <p className="text-[10px] text-muted-foreground mb-0.5 ml-1">
                              {sender?.full_name || 'Usuário'}
                            </p>
                          )}
                          <div className={cn(
                            'rounded-2xl px-3 py-1.5 text-sm',
                            isMe ? 'bg-primary text-primary-foreground' : 'bg-muted'
                          )}>
                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          </div>
                          <p className={`text-[9px] text-muted-foreground mt-0.5 ${isMe ? 'text-right mr-1' : 'ml-1'}`}>
                            {format(new Date(msg.created_at), 'HH:mm', { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              <div className="p-2 border-t">
                <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder="Mensagem..."
                    className="flex-1 h-9 text-sm"
                    disabled={sending}
                  />
                  <Button type="submit" disabled={!newMessage.trim() || sending} size="icon" className="h-9 w-9">
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default FloatingChatWidget;
