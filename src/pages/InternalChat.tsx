import { useState, useEffect, useRef, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Send, Plus, Users, MessageCircle, Hash } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

const InternalChat = () => {
  const { user, profile } = useAuth();
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
  const [loading, setLoading] = useState(true);

  // Load admin users (profiles with roles)
  useEffect(() => {
    const loadUsers = async () => {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id');
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
  }, []);

  // Load conversations
  const loadConversations = useCallback(async () => {
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false });
    if (data) {
      setConversations(data as Conversation[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load messages when selecting conversation
  useEffect(() => {
    if (!selectedConversation) return;

    const loadMessages = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', selectedConversation)
        .order('created_at', { ascending: true });
      if (data) setMessages(data as ChatMessage[]);

      // Load members for this conversation
      const { data: mems } = await supabase
        .from('conversation_members')
        .select('user_id')
        .eq('conversation_id', selectedConversation);
      if (mems) setConversationMembers(mems.map(m => m.user_id));
    };
    loadMessages();
  }, [selectedConversation]);

  // Real-time messages subscription
  useEffect(() => {
    const channel = supabase
      .channel('chat-messages-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
      }, (payload) => {
        const newMsg = payload.new as ChatMessage;
        if (newMsg.conversation_id === selectedConversation) {
          setMessages(prev => [...prev, newMsg]);
        }
        // Update conversation order
        setConversations(prev => {
          const updated = prev.map(c => 
            c.id === newMsg.conversation_id ? { ...c, updated_at: newMsg.created_at } : c
          );
          return updated.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedConversation]);

  // Auto-scroll
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
      // Update conversation updated_at
      await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', selectedConversation);
    }
    setSending(false);
  };

  const createConversation = async () => {
    if (!user || selectedUsers.length === 0) return;
    
    const isGroup = selectedUsers.length > 1;
    const convName = isGroup ? newConvName || `Grupo (${selectedUsers.length + 1})` : null;
    const convId = crypto.randomUUID();

    // Insert conversation without .select() to avoid RLS SELECT conflict
    const { error } = await supabase
      .from('conversations')
      .insert({ id: convId, name: convName, type: isGroup ? 'group' : 'direct', created_by: user.id });
    
    if (error) {
      console.error('Create conversation error:', error);
      toast.error('Erro ao criar conversa');
      return;
    }

    // Add members (including self) - now the SELECT policy will work
    const allMembers = [...selectedUsers, user.id].map(uid => ({
      conversation_id: convId,
      user_id: uid,
    }));

    const { error: membersError } = await supabase.from('conversation_members').insert(allMembers);
    if (membersError) {
      console.error('Add members error:', membersError);
      toast.error('Erro ao adicionar membros');
      return;
    }
    
    setShowNewConversation(false);
    setSelectedUsers([]);
    setNewConvName('');
    await loadConversations();
    setSelectedConversation(convId);
    toast.success('Conversa criada!');
  };

  const getConversationDisplayName = (conv: Conversation) => {
    if (conv.name) return conv.name;
    if (conv.type === 'direct') {
      // Find the other member
      const otherMember = conversationMembers.find(id => id !== user?.id);
      if (otherMember && members[otherMember]) return members[otherMember].full_name;
    }
    return 'Conversa';
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const selectedConv = conversations.find(c => c.id === selectedConversation);

  return (
    <AdminLayout>
      <div className="p-4 md:p-6">
        <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <MessageCircle className="h-6 w-6" />
          Chat Interno
        </h1>
        
        <div className="flex h-[calc(100vh-12rem)] border rounded-lg overflow-hidden bg-card">
          {/* Sidebar - Conversations */}
          <div className="w-80 border-r flex flex-col">
            <div className="p-3 border-b flex items-center justify-between">
              <span className="font-semibold text-sm">Conversas</span>
              <Dialog open={showNewConversation} onOpenChange={setShowNewConversation}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="ghost"><Plus className="h-4 w-4" /></Button>
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
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs bg-primary/10">{getInitials(u.full_name)}</AvatarFallback>
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
              {loading ? (
                <div className="p-4 text-center text-muted-foreground text-sm">Carregando...</div>
              ) : conversations.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  Nenhuma conversa ainda. Clique em + para iniciar.
                </div>
              ) : (
                conversations.map(conv => (
                  <button
                    key={conv.id}
                    className={`w-full text-left p-3 border-b hover:bg-muted/50 transition-colors ${
                      selectedConversation === conv.id ? 'bg-muted' : ''
                    }`}
                    onClick={() => setSelectedConversation(conv.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        {conv.type === 'group' ? (
                          <Users className="h-5 w-5 text-primary" />
                        ) : (
                          <MessageCircle className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm truncate">
                            {conv.name || 'Conversa Direta'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(conv.updated_at), 'HH:mm', { locale: ptBR })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-[10px] px-1">
                            {conv.type === 'group' ? 'Grupo' : 'Direto'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </ScrollArea>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            {selectedConv ? (
              <>
                {/* Header */}
                <div className="p-3 border-b flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                    {selectedConv.type === 'group' ? (
                      <Users className="h-4 w-4 text-primary" />
                    ) : (
                      <MessageCircle className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{getConversationDisplayName(selectedConv)}</p>
                    <p className="text-xs text-muted-foreground">
                      {conversationMembers.length} membro{conversationMembers.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-3">
                    {messages.map(msg => {
                      const isMe = msg.sender_id === user?.id;
                      const sender = members[msg.sender_id];
                      return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[70%] ${isMe ? 'order-1' : ''}`}>
                            {!isMe && (
                              <p className="text-xs text-muted-foreground mb-1 ml-1">
                                {sender?.full_name || 'Usuário'}
                              </p>
                            )}
                            <div className={`rounded-2xl px-4 py-2 ${
                              isMe 
                                ? 'bg-primary text-primary-foreground' 
                                : 'bg-muted'
                            }`}>
                              <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                            </div>
                            <p className={`text-[10px] text-muted-foreground mt-1 ${isMe ? 'text-right mr-1' : 'ml-1'}`}>
                              {format(new Date(msg.created_at), 'HH:mm', { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Input */}
                <div className="p-3 border-t">
                  <form
                    onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
                    className="flex gap-2"
                  >
                    <Input
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      placeholder="Digite sua mensagem..."
                      className="flex-1"
                      disabled={sending}
                    />
                    <Button type="submit" disabled={!newMessage.trim() || sending} size="icon">
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-lg font-medium">Selecione uma conversa</p>
                  <p className="text-sm">Ou inicie uma nova clicando no botão +</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default InternalChat;
