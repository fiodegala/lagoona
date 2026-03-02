import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, X, Video } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface VideoUploadProps {
  value?: string;
  onChange: (url: string | undefined) => void;
  bucket: string;
  folder?: string;
  maxSizeMB?: number;
}

const VideoUpload = ({ value, onChange, bucket, folder = '', maxSizeMB = 50 }: VideoUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      toast.error('Selecione um arquivo de vídeo');
      return;
    }

    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`O vídeo deve ter no máximo ${maxSizeMB}MB`);
      return;
    }

    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const filePath = folder ? `${folder}/${fileName}` : fileName;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      onChange(publicUrl);
      toast.success('Vídeo enviado com sucesso!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Erro ao enviar vídeo');
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = () => {
    onChange(undefined);
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {value ? (
        <div className="relative rounded-lg overflow-hidden border bg-muted aspect-video max-w-xs">
          <video
            src={value}
            muted
            autoPlay
            loop
            playsInline
            className="w-full h-full object-cover"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-7 w-7"
            onClick={handleRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-muted-foreground">
          <Video className="h-10 w-10 mb-2 opacity-50" />
          <p className="text-sm">Nenhum vídeo selecionado</p>
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
      >
        {isUploading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Enviando...
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" />
            {value ? 'Trocar vídeo' : 'Enviar vídeo'}
          </>
        )}
      </Button>
      <p className="text-xs text-muted-foreground">Máx. {maxSizeMB}MB • MP4, WebM, MOV</p>
    </div>
  );
};

export default VideoUpload;
