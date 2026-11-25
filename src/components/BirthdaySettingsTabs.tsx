import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, Sparkles, Upload, Trash2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  buildBirthdayMessage,
  DEFAULT_BIRTHDAY_TEMPLATE,
  generateBirthdayMessageFromImage,
  uploadBirthdayGiftImage,
  type BirthdaySettings,
} from '@/lib/birthdays';

interface Store { id: string; name: string; }
interface Viewer { user_id: string; all_stores: boolean; store_ids: string[]; }

export const useBirthdayStores = () =>
  useQuery({
    queryKey: ['birthday-stores'],
    queryFn: async () => {
      const { data } = await supabase.from('stores').select('id, name').eq('is_active', true).order('name');
      return (data || []) as Store[];
    },
  });

export const useBirthdaySettings = () =>
  useQuery({
    queryKey: ['birthday-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('birthday_settings').select('*').eq('id', 1).maybeSingle();
      if (error) throw error;
      return data as BirthdaySettings | null;
    },
  });

/* ---------------- Regras ---------------- */
export const BirthdayRulesTab = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: settings, isLoading } = useBirthdaySettings();

  const [form, setForm] = useState({
    enabled: true,
    days_before: '0',
    days_after: '0',
    message_template: DEFAULT_BIRTHDAY_TEMPLATE,
    gift_image_url: null as string | null,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setForm({
      enabled: settings.enabled,
      days_before: String(settings.days_before ?? 0),
      days_after: String(settings.days_after ?? 0),
      message_template: settings.message_template || DEFAULT_BIRTHDAY_TEMPLATE,
      gift_image_url: settings.gift_image_url ?? null,
    });
  }, [settings]);

  const generateMessageFromImage = async (imageUrl: string) => {
    setGenerating(true);
    try {
      const generated = await generateBirthdayMessageFromImage(imageUrl);
      setForm((prev) => ({ ...prev, message_template: generated }));
      toast.success('Mensagem criada com base na imagem do brinde! Revise e clique em Salvar regras.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível gerar a mensagem a partir da imagem.');
    } finally {
      setGenerating(false);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const publicUrl = await uploadBirthdayGiftImage(file);
      setForm((prev) => ({ ...prev, gift_image_url: publicUrl }));
      toast.success('Imagem anexada! Gerando mensagem automaticamente...');
      await generateMessageFromImage(publicUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar imagem.');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    const daysBefore = Number(form.days_before);
    const daysAfter = Number(form.days_after);
    if (!Number.isInteger(daysBefore) || daysBefore < 0 || daysBefore > 30) {
      return toast.error('Dias antes precisa ser um número inteiro entre 0 e 30.');
    }
    if (!Number.isInteger(daysAfter) || daysAfter < 0 || daysAfter > 30) {
      return toast.error('Dias depois precisa ser um número inteiro entre 0 e 30.');
    }
    setSaving(true);
    const { error } = await supabase.from('birthday_settings').upsert({
      id: 1,
      enabled: form.enabled,
      days_before: daysBefore,
      days_after: daysAfter,
      message_template: form.message_template.trim() || DEFAULT_BIRTHDAY_TEMPLATE,
      gift_image_url: form.gift_image_url,
      updated_at: new Date().toISOString(),
      updated_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Regras de aniversário salvas.');
    queryClient.invalidateQueries({ queryKey: ['birthday-settings'] });
    queryClient.invalidateQueries({ queryKey: ['birthday-template'] });
    queryClient.invalidateQueries({ queryKey: ['birthday-due-reminders'] });
  };

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const sampleMessage = buildBirthdayMessage(form.message_template, {
    customer_name: 'Maria Silva',
    store_name: 'Bernardo Sayão',
    birthday_date: '2026-11-25',
    turning_age: 32,
  });

  const hasUnsavedChanges =
    !!settings &&
    (form.enabled !== settings.enabled ||
      Number(form.days_before) !== (settings.days_before ?? 0) ||
      Number(form.days_after) !== (settings.days_after ?? 0) ||
      (form.message_template || '') !== (settings.message_template || DEFAULT_BIRTHDAY_TEMPLATE) ||
      form.gift_image_url !== (settings.gift_image_url ?? null));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Regras dos avisos de aniversário</CardTitle>
        <CardDescription>
          Anexe a imagem do brinde para gerar a mensagem automaticamente e configure quando o pop-up aparece para a equipe.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 max-w-2xl">
        <div className="flex items-center gap-3">
          <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} id="bday-enabled" />
          <Label htmlFor="bday-enabled">Mostrar pop-up automático para aniversariantes</Label>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Avisar antes (dias)</Label>
            <Input inputMode="numeric" value={form.days_before} onChange={(e) => setForm({ ...form, days_before: e.target.value })} />
            <p className="text-xs text-muted-foreground">Use 0 para aparecer apenas no dia do aniversário.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Continuar avisando depois (dias)</Label>
            <Input inputMode="numeric" value={form.days_after} onChange={(e) => setForm({ ...form, days_after: e.target.value })} />
            <p className="text-xs text-muted-foreground">Use 0 para cobrar só no dia, ou ex.: 3 para não perder quem não foi avisado.</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Imagem do brinde de aniversário</Label>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
          {form.gift_image_url ? (
            <div className="rounded-lg border p-3 space-y-3 bg-muted/20">
              <img
                src={form.gift_image_url}
                alt="Imagem do brinde de aniversário"
                className="w-full max-h-64 object-contain rounded-md bg-background border"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => form.gift_image_url && generateMessageFromImage(form.gift_image_url)}
                  disabled={generating || uploading}
                >
                  {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  {generating ? 'Criando mensagem...' : 'Recriar mensagem com IA'}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading || generating}>
                  <Upload className="h-4 w-4 mr-2" /> Trocar imagem
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setForm((prev) => ({ ...prev, gift_image_url: null }))}
                  disabled={uploading || generating}
                >
                  <Trash2 className="h-4 w-4 mr-1 text-destructive" /> Remover
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || generating}
              className="w-full rounded-lg border-2 border-dashed p-6 text-center hover:bg-muted/40 transition-colors flex flex-col items-center gap-2"
            >
              {uploading ? (
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              ) : (
                <ImageIcon className="h-7 w-7 text-muted-foreground" />
              )}
              <span className="text-sm font-medium">
                {uploading ? 'Enviando imagem...' : 'Clique para anexar a imagem do brinde'}
              </span>
              <span className="text-xs text-muted-foreground">
                Assim que anexar, a mensagem de parabéns sobre o brinde é criada automaticamente.
              </span>
            </button>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label>Mensagem do WhatsApp</Label>
            {generating && (
              <span className="text-xs text-primary flex items-center gap-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Criando mensagem a partir da imagem...
              </span>
            )}
          </div>
          <Textarea
            rows={6}
            value={form.message_template}
            onChange={(e) => setForm({ ...form, message_template: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Campos automáticos: {'{nome}'}, {'{nome_completo}'}, {'{loja}'}, {'{data_aniversario}'}, {'{validade}'}, {'{idade}'}
          </p>
        </div>

        <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Exemplo de como fica a mensagem:</p>
          {form.gift_image_url && (
            <img
              src={form.gift_image_url}
              alt="Prévia da imagem do brinde"
              className="max-h-44 rounded-md border bg-background object-contain"
            />
          )}
          <p className="whitespace-pre-line">{sampleMessage}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} disabled={saving || uploading || generating}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar regras
          </Button>
          {hasUnsavedChanges && (
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              Clique em Salvar regras para aplicar nos avisos da equipe.
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

/* ---------------- Quem recebe ---------------- */
export const BirthdayViewersTab = () => {
  const queryClient = useQueryClient();
  const { data: stores = [] } = useBirthdayStores();

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['birthday-staff'],
    queryFn: async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id');
      const ids = [...new Set((roles || []).map((r) => r.user_id))];
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', ids);
      return (profiles || [])
        .map((p) => ({ user_id: p.user_id, name: p.full_name || 'Sem nome' }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    },
  });

  const { data: viewers = [] } = useQuery({
    queryKey: ['birthday-viewers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('birthday_viewers').select('user_id, all_stores, store_ids');
      if (error) throw error;
      return (data || []) as Viewer[];
    },
  });

  const viewerMap = useMemo(() => new Map(viewers.map((v) => [v.user_id, v])), [viewers]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['birthday-viewers'] });
    queryClient.invalidateQueries({ queryKey: ['birthday-viewer'] });
    queryClient.invalidateQueries({ queryKey: ['birthday-due-reminders'] });
  };

  const saveViewer = async (v: Viewer) => {
    const { error } = await supabase.from('birthday_viewers').upsert({ ...v, updated_at: new Date().toISOString() });
    if (error) return toast.error(error.message);
    refresh();
  };

  const toggleUser = async (userId: string, on: boolean) => {
    if (on) {
      await saveViewer({ user_id: userId, all_stores: true, store_ids: [] });
      toast.success('Usuário passa a receber os avisos de aniversário');
    } else {
      const { error } = await supabase.from('birthday_viewers').delete().eq('user_id', userId);
      if (error) return toast.error(error.message);
      toast.success('Usuário não recebe mais os avisos de aniversário');
      refresh();
    }
  };

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quem recebe os avisos</CardTitle>
        <CardDescription>Ligue os usuários que devem ver o aviso de aniversário e marque de quais lojas cada um acompanha.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {staff.map((u) => {
          const v = viewerMap.get(u.user_id);
          return (
            <div key={u.user_id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{u.name}</span>
                <Switch
                  checked={!!v}
                  onCheckedChange={(on) => toggleUser(u.user_id, on)}
                  aria-label={`Avisos de aniversário para ${u.name}`}
                />
              </div>
              {v && (
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  <label className="flex items-center gap-2 font-medium">
                    <Checkbox checked={v.all_stores} onCheckedChange={(c) => saveViewer({ ...v, all_stores: !!c })} />
                    Todas as lojas
                  </label>
                  {!v.all_stores && stores.map((s) => (
                    <label key={s.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={v.store_ids.includes(s.id)}
                        onCheckedChange={(c) => saveViewer({
                          ...v,
                          store_ids: c ? [...v.store_ids, s.id] : v.store_ids.filter((x) => x !== s.id),
                        })}
                      />
                      {s.name}
                    </label>
                  ))}
                  {!v.all_stores && v.store_ids.length === 0 && (
                    <span className="text-destructive text-xs">Marque pelo menos uma loja</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};