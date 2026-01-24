import { useState, useEffect } from 'react';
import { Star, ThumbsUp, Image as ImageIcon, Video, User, Loader2 } from 'lucide-react';
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

interface ProductReviewsProps {
  productId: string;
}

const ProductReviews = ({ productId }: ProductReviewsProps) => {
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
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    if (!formData.name || !formData.email || !formData.rating) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setIsSubmitting(true);
    try {
      await reviewsService.create({
        product_id: productId,
        customer_name: formData.name,
        customer_email: formData.email,
        rating: formData.rating,
        title: formData.title || undefined,
        comment: formData.comment || undefined,
      });

      toast.success('Avaliação enviada! Será publicada após moderação.');
      setIsFormOpen(false);
      setFormData({ name: '', email: '', rating: 5, title: '', comment: '' });
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>
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

                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" className="flex-1 gap-2" disabled>
                    <ImageIcon className="h-4 w-4" />
                    Adicionar Foto
                  </Button>
                  <Button type="button" variant="outline" className="flex-1 gap-2" disabled>
                    <Video className="h-4 w-4" />
                    Adicionar Vídeo
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Upload de mídia estará disponível após a moderação inicial
                </p>

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
    </div>
  );
};

export default ProductReviews;
