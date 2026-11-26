import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Tags, Pencil, Check, X, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { saleActionTagsKey, useSaleActionTags } from '@/hooks/useSaleActionTags';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

export function ManageSaleActionTags({ inline = false }: { inline?: boolean }) {
  const { isAdmin, isManager } = useAuth();
  const { data: tags = [], isLoading, isError } = useSaleActionTags();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [busy, setBusy] = useState(false);
  if (!isAdmin && !isManager) return null;

  async function save(id: string | null, value: string, active?: boolean) {
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 80) {
      toast.error('Informe um nome de até 80 caracteres');
      return;
    }
    setBusy(true);
    try {
      const result = id
        ? await supabase.from('sale_action_tags').update({ name: trimmed, ...(active !== undefined ? { is_active: active } : {}) }).eq('id', id).select('id').single()
        : await supabase.from('sale_action_tags').insert({ name: trimmed }).select('id').single();
      if (result.error) throw result.error;
      await client.invalidateQueries({ queryKey: saleActionTagsKey });
      setName('');
      setEditingId(null);
      toast.success(id ? 'Etiqueta atualizada' : 'Etiqueta criada');
    } catch (error) {
      toast.error((error as { code?: string }).code === '23505' ? 'Já existe uma etiqueta com esse nome' : 'Não foi possível salvar a etiqueta');
    } finally { setBusy(false); }
  }

  const editor = <div className="space-y-5">
        <form className="space-y-2" onSubmit={event => { event.preventDefault(); void save(null, name); }}>
          <Label htmlFor="new-action-tag">Nova etiqueta</Label>
          <div className="flex gap-2"><Input id="new-action-tag" placeholder="Ex.: Cashback, Aniversário" maxLength={80} value={name} onChange={event => setName(event.target.value)} />
            <Button type="submit" disabled={busy || !name.trim()}><Plus className="mr-2 h-4 w-4" />Criar</Button></div>
        </form>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {isError && <p role="alert" className="text-destructive">Não foi possível carregar as etiquetas.</p>}
        <div className="divide-y">
          {!isLoading && !isError && tags.length === 0 && <p className="py-4 text-sm text-muted-foreground">Nenhuma etiqueta cadastrada.</p>}
          {tags.map(tag => <div key={tag.id} className="flex items-center gap-2 py-3">
            {editingId === tag.id ? <>
              <Input aria-label="Nome da etiqueta" maxLength={80} value={editingName} onChange={event => setEditingName(event.target.value)} />
              <Button variant="ghost" size="icon" aria-label="Salvar nome" disabled={busy} onClick={() => void save(tag.id, editingName)}><Check className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" aria-label="Cancelar edição" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
            </> : <>
              <span className="flex-1 min-w-0 break-words">{tag.name}</span>
              <Button variant="ghost" size="icon" aria-label={`Renomear ${tag.name}`} disabled={busy} onClick={() => { setEditingId(tag.id); setEditingName(tag.name); }}><Pencil className="h-4 w-4" /></Button>
              <Switch aria-label={`Ativar ${tag.name}`} checked={tag.is_active} disabled={busy} onCheckedChange={active => void save(tag.id, tag.name, active)} />
            </>}
          </div>)}
        </div>
      </div>;
  if (inline) return editor;
  return <>
    <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Tags className="mr-2 h-4 w-4" />Gerenciar etiquetas</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Etiquetas de ações</DialogTitle></DialogHeader>
        {editor}
      </DialogContent>
    </Dialog>
  </>;
}

export function SaleActionTagSelect({ value, onChange, disabled = false }: { value: string | null; onChange: (id: string | null) => void; disabled?: boolean }) {
  const { data: tags = [], isLoading, isError, refetch } = useSaleActionTags();
  const available = tags.filter(tag => tag.is_active || tag.id === value);
  return <div className="space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2"><Label htmlFor="sale-action-tag">Etiqueta da ação</Label><ManageSaleActionTags /></div>
    <Select value={value || 'none'} onValueChange={id => onChange(id === 'none' ? null : id)} disabled={disabled || isLoading || isError}>
      <SelectTrigger id="sale-action-tag" aria-label="Etiqueta da ação"><SelectValue placeholder="Sem etiqueta" /></SelectTrigger>
      <SelectContent><SelectItem value="none">Sem etiqueta</SelectItem>{available.map(tag => <SelectItem key={tag.id} value={tag.id}>{tag.name}{!tag.is_active ? ' (inativa)' : ''}</SelectItem>)}</SelectContent>
    </Select>
    {isError && <div role="alert" className="text-sm text-destructive">Não foi possível carregar as etiquetas. <Button variant="link" size="sm" onClick={() => void refetch()}>Tentar novamente</Button></div>}
  </div>;
}