import { useState, useEffect } from 'react';
import { Star, ThumbsUp, Image as ImageIcon, Video, User, Loader2, Gift, Copy, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { reviewsService, ProductReview } from '@/services/reviews';
import { supabase } from '@/integrations/supabase/client';

interface ProductReviewsProps {
  productId: string;
}

export interface ProductReviewsHandle {
  openForm: () => void;
}

const ProductReviews = ({ productId, onReady }: ProductReviewsProps & { onReady?: (h: ProductReviewsHandle) => void }) => {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [stats, setStats] = useState({ average: 0, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    rating: 5,
    title: '',
    comment: '',
  });
  const [photos, setPhotos] = useState<File[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [issuedCoupon, setIssuedCoupon] = useState<string | null>(null);

  useEffect(() => {
    onReady?.({ openForm: () => setIsFormOpen(true) });
  }, [onReady]);

  useEffect(() => {
    loadReviews();
  }, [productId]);

  const loadReviews = async () => {
    try {
      setIsLoading(true);
      const [reviewsData, statsData] = await Promise.all([
        reviewsService.getByProduct(productId),
        reviewsService.getProductStats(productId),
      ]);
      setReviews(reviewsData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.rating) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    // Require authentication; use the logged-in user's email (RLS enforces match)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      toast.error('Faça login para enviar uma avaliação.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await reviewsService.create({
        product_id: productId,
        customer_name: formData.name,
        customer_email: user.email,
        rating: formData.rating,
        title: formData.title || undefined,
        comment: formData.comment || undefined,
      });

      // Fetch newly inserted review id (create() doesn't return id reliably)
      const { data: latest } = await supabase
        .from('product_reviews')
        .select('id')
        .eq('product_id', productId)
        .eq('customer_email', user.email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const reviewId = latest?.id;
      let uploadedPhoto = false;

      if (reviewId) {
        for (const f of photos) {
          try {
            await reviewsService.uploadMedia(reviewId, f, 'image');
            uploadedPhoto = true;
          } catch (err) { console.error('photo upload failed', err); }
        }
        if (video) {
          try { await reviewsService.uploadMedia(reviewId, video, 'video'); } catch (err) { console.error('video upload failed', err); }
        }
      }

      if (uploadedPhoto) {
        try {
          const { data, error } = await supabase.functions.invoke('generate-review-coupon', {
            body: { customer_email: user.email, product_id: productId },
          });
          if (!error && data?.code) {
            setIssuedCoupon(data.code);
          } else {
            toast.success('Avaliação enviada! Será publicada após moderação.');
          }
        } catch (err) {
          console.error('coupon error', err);
          toast.success('Avaliação enviada! Será publicada após moderação.');
        }
      } else {
        toast.success('Avaliação enviada! Será publicada após moderação.');
      }

      setIsFormOpen(false);
      setFormData({ name: '', email: '', rating: 5, title: '', comment: '' });
      setPhotos([]);
      setVideo(null);
    } catch (error) {
      console.error('Error submitting review:', error);
      toast.error('Erro ao enviar avaliação. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleHelpful = async (reviewId: string) => {
    try {
      await reviewsService.incrementHelpful(reviewId);
      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId ? { ...r, helpful_count: r.helpful_count + 1 } : r
        )
      );
    } catch (error) {
      console.error('Error marking as helpful:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const StarRating = ({ rating, size = 'sm', interactive = false, onRatingChange }: { 
    rating: number; 
    size?: 'sm' | 'lg'; 
    interactive?: boolean;
    onRatingChange?: (rating: number) => void;
  }) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            size === 'sm' ? 'h-4 w-4' : 'h-6 w-6',
            star <= rating ? 'fill-warning text-warning' : 'text-muted-foreground/30',
            interactive && 'cursor-pointer hover:scale-110 transition-transform'
          )}
          onClick={() => interactive && onRatingChange?.(star)}
        />
      ))}
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stats Summary */}
      <div className="grid md:grid-cols-2 gap-8">
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-5xl font-bold text-store-accent">
              {stats.average.toFixed(1)}
            </div>
            <StarRating rating={Math.round(stats.average)} size="lg" />
            <div className="text-sm text-muted-foreground mt-1">
              {stats.count} {stats.count === 1 ? 'avaliação' : 'avaliações'}
            </div>
          </div>

          <div className="flex-1 space-y-2">
            {[5, 4, 3, 2, 1].map((star) => (
              <div key={star} className="flex items-center gap-2">
                <span className="text-sm w-3">{star}</span>
                <Star className="h-3 w-3 fill-warning text-warning" />
                <Progress 
                  value={stats.count > 0 ? (stats.distribution[star] / stats.count) * 100 : 0} 
                  className="flex-1 h-2" 
                />
                <span className="text-xs text-muted-foreground w-8">
                  {stats.distribution[star]}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-center">
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="bg-store-primary text-store-accent hover:bg-store-primary/90">
                Escrever Avaliação
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Escrever Avaliação</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmitReview} className="space-y-4">
                <div className="space-y-2">
                  <Label>Sua Nota *</Label>
                  <StarRating 
                    rating={formData.rating} 
                    size="lg" 
                    interactive 
                    onRatingChange={(r) => setFormData(prev => ({ ...prev, rating: r }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    O e-mail da sua conta será usado automaticamente. Faça login para enviar.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Título da Avaliação</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Resumo da sua experiência"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="comment">Comentário</Label>
                  <Textarea
                    id="comment"
                    value={formData.comment}
                    onChange={(e) => setFormData(prev => ({ ...prev, comment: e.target.value }))}
                    placeholder="Conte sua experiência com o produto..."
                    rows={4}
                  />
                </div>

                <div className="rounded-lg border border-store-gold/40 bg-store-gold/5 p-3 space-y-3">
                  <div className="flex items-start gap-2">
                    <Gift className="h-4 w-4 text-store-gold mt-0.5 shrink-0" />
                    <p className="text-xs text-store-accent">
                      Envie pelo menos <strong>1 foto</strong> com sua avaliação e ganhe um cupom de <strong>R$ 10 OFF</strong> (mín. R$ 50) na sua próxima compra.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col items-center justify-center gap-1 border border-dashed rounded-md p-3 cursor-pointer hover:bg-muted/40 transition-colors">
                      <ImageIcon className="h-4 w-4" />
                      <span className="text-xs">{photos.length > 0 ? `${photos.length} foto(s)` : 'Adicionar Fotos'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []).slice(0, 5);
                          setPhotos(files);
                        }}
                      />
                    </label>
                    <label className="flex flex-col items-center justify-center gap-1 border border-dashed rounded-md p-3 cursor-pointer hover:bg-muted/40 transition-colors">
                      <Video className="h-4 w-4" />
                      <span className="text-xs truncate max-w-full">{video ? video.name : 'Adicionar Vídeo'}</span>
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => setVideo(e.target.files?.[0] || null)}
                      />
                    </label>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-store-primary text-store-accent hover:bg-store-primary/90"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Enviar Avaliação
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          <p className="text-sm text-muted-foreground mt-2 text-center">
            Compartilhe sua experiência com outros clientes
          </p>
        </div>
      </div>

      <Separator />

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma avaliação ainda. Seja o primeiro a avaliar!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {reviews.map((review) => (
            <div key={review.id} className="space-y-3 pb-6 border-b last:border-0">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-store-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-store-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{review.customer_name}</span>
                      {review.is_verified_purchase && (
                        <Badge variant="secondary" className="text-xs">
                          Compra verificada
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <StarRating rating={review.rating} />
                      <span className="text-xs text-muted-foreground">
                        {formatDate(review.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {review.title && (
                <h4 className="font-semibold">{review.title}</h4>
              )}

              {review.comment && (
                <p className="text-muted-foreground">{review.comment}</p>
              )}

              {/* Media Grid */}
              {review.media && review.media.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {review.media.map((media) => (
                    <button
                      key={media.id}
                      onClick={() => setSelectedMedia(media.url)}
                      className="relative w-20 h-20 rounded-lg overflow-hidden border hover:opacity-80 transition-opacity"
                    >
                      {media.media_type === 'image' ? (
                        <img src={media.url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <Video className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-4 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground gap-1"
                  onClick={() => handleHelpful(review.id)}
                >
                  <ThumbsUp className="h-4 w-4" />
                  Útil ({review.helpful_count})
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Media Lightbox */}
      <Dialog open={!!selectedMedia} onOpenChange={() => setSelectedMedia(null)}>
        <DialogContent className="max-w-3xl p-0">
          {selectedMedia && (
            <img src={selectedMedia} alt="" className="w-full h-auto" />
          )}
        </DialogContent>
      </Dialog>

      {/* Coupon Reward Dialog */}
      <Dialog open={!!issuedCoupon} onOpenChange={(o) => !o && setIssuedCoupon(null)}>
        <DialogContent className="max-w-md text-center">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-store-gold" />
              Avaliação enviada!
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Obrigado por compartilhar sua experiência com foto! Aqui está seu cupom de <strong className="text-foreground">R$ 10 OFF</strong> (mín. R$ 50, válido por 30 dias):
            </p>
            <div className="rounded-lg border-2 border-dashed border-store-gold bg-store-gold/5 p-4 flex items-center justify-between gap-3">
              <code className="text-lg font-bold tracking-wider text-store-accent">{issuedCoupon}</code>
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => {
                  if (issuedCoupon) {
                    navigator.clipboard.writeText(issuedCoupon);
                    toast.success('Cupom copiado!');
                  }
                }}
              >
                <Copy className="h-3.5 w-3.5" /> Copiar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Sua avaliação será publicada após moderação.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductReviews;
