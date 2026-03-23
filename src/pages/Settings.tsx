import { useState, useEffect, useRef } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Shield, MapPin, Camera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import SalesGoalsSettings from '@/components/settings/SalesGoalsSettings';
import WhatsAppTemplatesSettings from '@/components/settings/WhatsAppTemplatesSettings';
import DealsCountdownSettings from '@/components/settings/DealsCountdownSettings';
import FeaturedProductSettings from '@/components/settings/FeaturedProductSettings';
import VideoTestimonialsSettings from '@/components/settings/VideoTestimonialsSettings';

import SpinWheelSettings from '@/components/settings/SpinWheelSettings';
import WholesaleVideoSettings from '@/components/settings/WholesaleVideoSettings';
import LowStockAlertSettings from '@/components/settings/LowStockAlertSettings';
import AITryOnSettings from '@/components/settings/AITryOnSettings';
import PushNotificationSettings from '@/components/settings/PushNotificationSettings';
import CustomerFeedbackSettings from '@/components/settings/CustomerFeedbackSettings';
import InstagramIntegrationSettings from '@/components/settings/InstagramIntegrationSettings';

const Settings = () => {
  const { profile, isAdmin, user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [document, setDocument] = useState('');
  const [birthday, setBirthday] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [zipCode, setZipCode] = useState('');
  const [address, setAddress] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isLoadingCep, setIsLoadingCep] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setAvatarUrl(profile.avatar_url || null);
      loadExtraProfile();
    }
  }, [profile]);

  const loadExtraProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('phone, document, birthday, address, address_number, complement, neighborhood, city, state, zip_code')
      .eq('user_id', user.id)
      .single();
    if (data) {
      setPhone((data as any).phone || '');
      setDocument((data as any).document || '');
      setBirthday((data as any).birthday || '');
      setZipCode((data as any).zip_code || '');
      setAddress((data as any).address || '');
      setAddressNumber((data as any).address_number || '');
      setComplement((data as any).complement || '');
      setNeighborhood((data as any).neighborhood || '');
      setCity((data as any).city || '');
      setState((data as any).state || '');
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione uma imagem válida');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }
    setIsUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `avatars/${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(filePath);
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl } as any)
        .eq('user_id', user.id);
      if (updateError) throw updateError;
      setAvatarUrl(publicUrl);
      toast.success('Foto atualizada!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao enviar foto');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          phone,
          document,
          birthday: birthday || null,
        } as any)
        .eq('user_id', user.id);
      if (error) throw error;
      toast.success('Dados pessoais salvos!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar dados');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveAddress = async () => {
    if (!user) return;
    setIsSavingAddress(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          zip_code: zipCode,
          address,
          address_number: addressNumber,
          complement,
          neighborhood,
          city,
          state,
        } as any)
        .eq('user_id', user.id);
      if (error) throw error;
      toast.success('Endereço salvo!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar endereço');
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleCepLookup = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    setZipCode(cleanCep);
    if (cleanCep.length !== 8) return;
    setIsLoadingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setAddress(data.logradouro || '');
        setNeighborhood(data.bairro || '');
        setCity(data.localidade || '');
        setState(data.uf || '');
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingCep(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Senha atualizada!');
      setNewPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar senha');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const initials = fullName
    ? fullName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground mt-1">Gerencie suas preferências e conta</p>
        </div>

        <PushNotificationSettings />
        <SalesGoalsSettings />

        {isAdmin && (
          <>
            <DealsCountdownSettings />
            <FeaturedProductSettings />
            <VideoTestimonialsSettings />
            <CustomerFeedbackSettings />
            <SpinWheelSettings />
            
            <WholesaleVideoSettings />
            <WhatsAppTemplatesSettings />
            <LowStockAlertSettings />
            <AITryOnSettings />
            <InstagramIntegrationSettings />
          </>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Profile & Personal Data */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Dados Pessoais
              </CardTitle>
              <CardDescription>Suas informações e foto de perfil</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <Avatar className="h-20 w-20">
                    {avatarUrl ? (
                      <AvatarImage src={avatarUrl} alt={fullName} />
                    ) : null}
                    <AvatarFallback className="text-lg bg-primary/10 text-primary">{initials}</AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {isUploadingAvatar ? (
                      <Loader2 className="h-5 w-5 text-white animate-spin" />
                    ) : (
                      <Camera className="h-5 w-5 text-white" />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                </div>
                <div>
                  <p className="font-medium">{fullName || 'Seu nome'}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Nome completo</Label>
                <Input value={fullName} onChange={e => setFullName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>CPF/CNPJ</Label>
                  <Input value={document} onChange={e => setDocument(e.target.value)} placeholder="000.000.000-00" />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Data de nascimento</Label>
                <Input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} />
              </div>
              <Button onClick={handleSaveProfile} disabled={isSavingProfile}>
                {isSavingProfile ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : 'Salvar dados'}
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {/* Address */}
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Endereço
                </CardTitle>
                <CardDescription>Seu endereço principal</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2 col-span-1">
                    <Label>CEP</Label>
                    <Input
                      value={zipCode}
                      onChange={e => handleCepLookup(e.target.value)}
                      placeholder="00000-000"
                      maxLength={9}
                    />
                    {isLoadingCep && <p className="text-xs text-muted-foreground">Buscando...</p>}
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Rua</Label>
                    <Input value={address} onChange={e => setAddress(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Número</Label>
                    <Input value={addressNumber} onChange={e => setAddressNumber(e.target.value)} />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Complemento</Label>
                    <Input value={complement} onChange={e => setComplement(e.target.value)} placeholder="Apto, Bloco..." />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Bairro</Label>
                    <Input value={neighborhood} onChange={e => setNeighborhood(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input value={city} onChange={e => setCity(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Input value={state} onChange={e => setState(e.target.value)} maxLength={2} />
                  </div>
                </div>
                <Button onClick={handleSaveAddress} disabled={isSavingAddress}>
                  {isSavingAddress ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : 'Salvar endereço'}
                </Button>
              </CardContent>
            </Card>

            {/* Security */}
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Segurança
                </CardTitle>
                <CardDescription>Configurações de segurança da conta</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nova senha</Label>
                  <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
                </div>
                <Button variant="outline" onClick={handleChangePassword} disabled={isChangingPassword}>
                  {isChangingPassword ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Atualizando...</> : 'Atualizar senha'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Settings;
