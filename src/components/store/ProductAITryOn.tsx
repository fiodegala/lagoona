import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles, Upload, X, RefreshCw, Download, ImageIcon, Loader2, Camera, ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type TryOnState = 'idle' | 'photo_uploaded' | 'generating' | 'success' | 'error';

interface ProductAITryOnProps {
  productName: string;
  productImage: string | null;
  selectedColor?: string;
  selectedSize?: string;
}

const ProductAITryOn = ({
  productName,
  productImage,
  selectedColor,
  selectedSize,
}: ProductAITryOnProps) => {
  const [state, setState] = useState<TryOnState>('idle');
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, envie apenas arquivos de imagem.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 10MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setUserPhoto(e.target?.result as string);
      setState('photo_uploaded');
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [handleFile]);

  const handleRemovePhoto = useCallback(() => {
    setUserPhoto(null);
    setGeneratedImage(null);
    setState('idle');
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!userPhoto) {
      toast.error('Envie uma foto para continuar.');
      return;
    }
    setState('generating');

    // TODO: integrate with AI backend
    // Simulating API call for now
    await new Promise((r) => setTimeout(r, 3000));

    // For now, show error state to demonstrate the flow
    // Replace with real API call when backend is ready
    setState('error');
    // On success, would do:
    // setGeneratedImage(resultUrl);
    // setState('success');
  }, [userPhoto]);

  const handleRetry = useCallback(() => {
    setState('photo_uploaded');
    setGeneratedImage(null);
  }, []);

  const handleDownload = useCallback(() => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `provador-ia-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [generatedImage]);

  return (
    <section className="mt-16 mb-8">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-store-gold/30 to-transparent" />
        <Badge className="bg-store-gold/10 text-store-gold border-store-gold/20 hover:bg-store-gold/10 gap-1.5 px-3 py-1 text-xs font-medium uppercase tracking-wider">
          <Sparkles className="h-3 w-3" />
          Novidade
        </Badge>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-store-gold/30 to-transparent" />
      </div>

      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-display font-bold text-store-accent">
          Experimente com IA
        </h2>
        <p className="text-muted-foreground text-sm mt-2 max-w-md mx-auto">
          Envie sua foto e veja uma prévia visual usando esta peça.
        </p>
      </div>

      <div className="rounded-2xl border border-store-gold/15 bg-gradient-to-b from-store-gold/[0.03] to-transparent p-5 md:p-8">
        <div className="grid md:grid-cols-2 gap-6 md:gap-8">
          {/* Left — User Photo Upload */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Sua Foto
            </h3>

            {!userPhoto ? (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'relative aspect-[3/4] rounded-xl border-2 border-dashed cursor-pointer transition-all duration-300',
                  'flex flex-col items-center justify-center gap-3 text-center p-6',
                  'hover:border-store-gold/50 hover:bg-store-gold/[0.03]',
                  isDragging
                    ? 'border-store-gold bg-store-gold/5 scale-[1.01]'
                    : 'border-muted-foreground/20'
                )}
              >
                <div className="h-14 w-14 rounded-full bg-store-gold/10 flex items-center justify-center">
                  <Camera className="h-6 w-6 text-store-gold" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Arraste uma foto aqui
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ou clique para selecionar
                  </p>
                </div>
                <p className="text-[11px] text-muted-foreground/70 mt-2 leading-relaxed">
                  Use uma foto frontal, com boa iluminação e corpo visível.
                </p>
              </div>
            ) : (
              <div className="relative aspect-[3/4] rounded-xl overflow-hidden border bg-muted group">
                <img
                  src={userPhoto}
                  alt="Sua foto"
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={handleRemovePhoto}
                  className="absolute top-2 right-2 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="absolute bottom-2 left-2">
                  <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm text-xs">
                    Foto enviada ✓
                  </Badge>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* Right — Product Info + Result */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Peça Selecionada
            </h3>

            {/* Product Card */}
            <div className="flex items-start gap-3 p-3 rounded-xl border bg-card">
              {productImage ? (
                <img
                  src={productImage}
                  alt={productName}
                  className="w-16 h-20 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-20 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium line-clamp-2">{productName}</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  {selectedColor && (
                    <Badge variant="outline" className="text-[11px] px-2 py-0">
                      {selectedColor}
                    </Badge>
                  )}
                  {selectedSize && (
                    <Badge variant="outline" className="text-[11px] px-2 py-0">
                      {selectedSize}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Result Area or Placeholder */}
            {state === 'success' && generatedImage ? (
              <div className="space-y-3">
                {/* Generated Image */}
                <div className="aspect-[3/4] rounded-xl overflow-hidden border bg-muted relative">
                  <img
                    src={generatedImage}
                    alt="Resultado do provador IA"
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5 text-xs"
                    onClick={handleRetry}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Gerar novamente
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5 text-xs"
                    onClick={handleRemovePhoto}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Outra foto
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 gap-1.5 text-xs bg-store-gold text-store-dark hover:bg-store-gold/90"
                    onClick={handleDownload}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Baixar
                  </Button>
                </div>
              </div>
            ) : state === 'generating' ? (
              <div className="aspect-[3/4] rounded-xl border bg-muted/50 flex flex-col items-center justify-center gap-4">
                <div className="relative">
                  <div className="h-16 w-16 rounded-full border-2 border-store-gold/20 border-t-store-gold animate-spin" />
                  <Sparkles className="h-5 w-5 text-store-gold absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Estamos criando sua prévia...</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Isso pode levar alguns segundos
                  </p>
                </div>
              </div>
            ) : state === 'error' ? (
              <div className="aspect-[3/4] rounded-xl border border-destructive/20 bg-destructive/[0.03] flex flex-col items-center justify-center gap-4 p-6 text-center">
                <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
                  <X className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    Não foi possível gerar sua imagem agora.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tente novamente em alguns instantes.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleRetry}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Tentar novamente
                </Button>
              </div>
            ) : (
              <div className="aspect-[3/4] rounded-xl border border-dashed border-muted-foreground/15 bg-muted/30 flex flex-col items-center justify-center gap-3 p-6 text-center">
                <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <p className="text-xs text-muted-foreground">
                  O resultado da IA aparecerá aqui
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Generate Button */}
        {(state === 'idle' || state === 'photo_uploaded') && (
          <div className="mt-6 flex justify-center">
            <Button
              onClick={handleGenerate}
              disabled={!userPhoto}
              className="gap-2 px-8 h-12 text-sm font-semibold bg-store-gold text-store-dark hover:bg-store-gold/90 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-store-gold/20 transition-all hover:shadow-xl hover:shadow-store-gold/30"
            >
              <Sparkles className="h-4 w-4" />
              Gerar provador com IA
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Disclaimer */}
        {(state === 'success' || state === 'generating') && (
          <p className="text-[11px] text-muted-foreground/60 text-center mt-5 max-w-lg mx-auto leading-relaxed">
            A imagem gerada por IA é uma simulação visual e pode apresentar variações de caimento, proporção e tonalidade.
          </p>
        )}
      </div>
    </section>
  );
};

export default ProductAITryOn;
