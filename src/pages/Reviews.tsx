import { useState, useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Search, MoreHorizontal, Star, CheckCircle, XCircle, 
  Eye, Trash2, Loader2, MessageSquare, Image, Video,
  ThumbsUp, Calendar, Mail, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Review {
  id: string;
  product_id: string;
  customer_name: string;
  customer_email: string;
  rating: number;
  title: string | null;
  comment: string | null;
  is_approved: boolean;
  is_verified_purchase: boolean;
  helpful_count: number;
  created_at: string;
  product?: {
    name: string;
    image_url: string | null;
  };
  media?: {
    id: string;
    url: string;
    media_type: string;
    thumbnail_url: string | null;
  }[];
}

const Reviews = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [selectedReviews, setSelectedReviews] = useState<string[]>([]);
  const [viewReview, setViewReview] = useState<Review | null>(null);
  const [deleteReview, setDeleteReview] = useState<Review | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    avgRating: 0,
  });

  useEffect(() => {
    loadReviews();
  }, []);

  const loadReviews = async () => {
    try {
      setIsLoading(true);
      
      // Fetch all reviews (admin can see all)
      const { data: reviewsData, error } = await supabase
        .from('product_reviews')
        .select(`
          *,
          product:products(name, image_url)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch media for each review
      const reviewIds = reviewsData?.map(r => r.id) || [];
      let mediaData: any[] = [];
      
      if (reviewIds.length > 0) {
        const { data: media } = await supabase
          .from('review_media')
          .select('*')
          .in('review_id', reviewIds);
        mediaData = media || [];
      }

      // Combine reviews with media
      const reviewsWithMedia = (reviewsData || []).map(review => ({
        ...review,
        media: mediaData.filter(m => m.review_id === review.id),
      }));

      setReviews(reviewsWithMedia);

      // Calculate stats
      const total = reviewsWithMedia.length;
      const pending = reviewsWithMedia.filter(r => !r.is_approved).length;
      const approved = reviewsWithMedia.filter(r => r.is_approved).length;
      const avgRating = total > 0 
        ? reviewsWithMedia.reduce((acc, r) => acc + r.rating, 0) / total 
        : 0;

      setStats({ total, pending, approved, avgRating });
    } catch (error) {
      console.error('Error loading reviews:', error);
      toast.error('Erro ao carregar avaliações');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (reviewId: string, approve: boolean) => {
    try {
      setIsSubmitting(true);
      const { error } = await supabase
        .from('product_reviews')
        .update({ is_approved: approve })
        .eq('id', reviewId);

      if (error) throw error;

      setReviews(prev => prev.map(r => 
        r.id === reviewId ? { ...r, is_approved: approve } : r
      ));

      // Update stats
      setStats(prev => ({
        ...prev,
        pending: approve ? prev.pending - 1 : prev.pending + 1,
        approved: approve ? prev.approved + 1 : prev.approved - 1,
      }));

      toast.success(approve ? 'Avaliação aprovada!' : 'Avaliação reprovada');
      setViewReview(null);
    } catch (error) {
      console.error('Error updating review:', error);
      toast.error('Erro ao atualizar avaliação');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkApprove = async (approve: boolean) => {
    if (selectedReviews.length === 0) return;

    try {
      setIsSubmitting(true);
      const { error } = await supabase
        .from('product_reviews')
        .update({ is_approved: approve })
        .in('id', selectedReviews);

      if (error) throw error;

      await loadReviews();
      setSelectedReviews([]);
      toast.success(`${selectedReviews.length} avaliações ${approve ? 'aprovadas' : 'reprovadas'}`);
    } catch (error) {
      console.error('Error bulk updating reviews:', error);
      toast.error('Erro ao atualizar avaliações');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteReview) return;

    try {
      setIsSubmitting(true);
      
      // Delete media first
      await supabase
        .from('review_media')
        .delete()
        .eq('review_id', deleteReview.id);

      // Delete review
      const { error } = await supabase
        .from('product_reviews')
        .delete()
        .eq('id', deleteReview.id);

      if (error) throw error;

      setReviews(prev => prev.filter(r => r.id !== deleteReview.id));
      setStats(prev => ({
        ...prev,
        total: prev.total - 1,
        pending: deleteReview.is_approved ? prev.pending : prev.pending - 1,
        approved: deleteReview.is_approved ? prev.approved - 1 : prev.approved,
      }));

      toast.success('Avaliação excluída');
      setDeleteReview(null);
    } catch (error) {
      console.error('Error deleting review:', error);
      toast.error('Erro ao excluir avaliação');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedReviews.length === filteredReviews.length) {
      setSelectedReviews([]);
    } else {
      setSelectedReviews(filteredReviews.map(r => r.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedReviews(prev => 
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  // Filter reviews
  const filteredReviews = reviews.filter(review => {
    const matchesSearch = 
      review.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.customer_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.product?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.comment?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = 
      statusFilter === 'all' ||
      (statusFilter === 'pending' && !review.is_approved) ||
      (statusFilter === 'approved' && review.is_approved);

    const matchesRating = 
      ratingFilter === 'all' ||
      review.rating === parseInt(ratingFilter);

    return matchesSearch && matchesStatus && matchesRating;
  });

  const renderStars = (rating: number, size: 'sm' | 'md' = 'sm') => {
    const sizeClass = size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5';
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              sizeClass,
              star <= rating ? "fill-warning text-warning" : "text-muted-foreground/30"
            )}
          />
        ))}
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Avaliações</h1>
          <p className="text-muted-foreground">
            Gerencie e aprove as avaliações dos clientes
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Aprovadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{stats.approved}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Média
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{stats.avgRating.toFixed(1)}</span>
                <Star className="h-5 w-5 fill-warning text-warning" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, produto ou comentário..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="approved">Aprovadas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={ratingFilter} onValueChange={setRatingFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Avaliação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="5">5 estrelas</SelectItem>
              <SelectItem value="4">4 estrelas</SelectItem>
              <SelectItem value="3">3 estrelas</SelectItem>
              <SelectItem value="2">2 estrelas</SelectItem>
              <SelectItem value="1">1 estrela</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bulk Actions */}
        {selectedReviews.length > 0 && (
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <span className="text-sm font-medium">
              {selectedReviews.length} selecionada(s)
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkApprove(true)}
              disabled={isSubmitting}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Aprovar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkApprove(false)}
              disabled={isSubmitting}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Reprovar
            </Button>
          </div>
        )}

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredReviews.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">Nenhuma avaliação encontrada</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedReviews.length === filteredReviews.length && filteredReviews.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Avaliação</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReviews.map((review) => (
                    <TableRow key={review.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedReviews.includes(review.id)}
                          onCheckedChange={() => toggleSelect(review.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-md overflow-hidden bg-muted">
                            {review.product?.image_url ? (
                              <img
                                src={review.product.image_url}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-muted-foreground/30">
                                📦
                              </div>
                            )}
                          </div>
                          <span className="font-medium line-clamp-1 max-w-[150px]">
                            {review.product?.name || 'Produto removido'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{review.customer_name}</p>
                          <p className="text-xs text-muted-foreground">{review.customer_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {renderStars(review.rating)}
                          {review.title && (
                            <p className="text-sm line-clamp-1 max-w-[150px]">{review.title}</p>
                          )}
                          <div className="flex items-center gap-2">
                            {review.media && review.media.length > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {review.media.filter(m => m.media_type === 'image').length > 0 && (
                                  <><Image className="h-3 w-3 mr-1" />{review.media.filter(m => m.media_type === 'image').length}</>
                                )}
                              </Badge>
                            )}
                            {review.is_verified_purchase && (
                              <Badge variant="outline" className="text-xs text-success border-success">
                                <ShieldCheck className="h-3 w-3 mr-1" />
                                Verificado
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {review.is_approved ? (
                          <Badge className="bg-success/10 text-success hover:bg-success/20">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Aprovada
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-warning border-warning">
                            Pendente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(review.created_at), "dd/MM/yy", { locale: ptBR })}
                        </span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewReview(review)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Ver detalhes
                            </DropdownMenuItem>
                            {review.is_approved ? (
                              <DropdownMenuItem onClick={() => handleApprove(review.id, false)}>
                                <XCircle className="h-4 w-4 mr-2" />
                                Reprovar
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handleApprove(review.id, true)}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Aprovar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem 
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteReview(review)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* View Review Dialog */}
      <Dialog open={!!viewReview} onOpenChange={() => setViewReview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Avaliação</DialogTitle>
          </DialogHeader>
          
          {viewReview && (
            <div className="space-y-6">
              {/* Product Info */}
              <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                <div className="h-16 w-16 rounded-lg overflow-hidden bg-background">
                  {viewReview.product?.image_url ? (
                    <img
                      src={viewReview.product.image_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-2xl">📦</div>
                  )}
                </div>
                <div>
                  <p className="font-medium">{viewReview.product?.name}</p>
                  <p className="text-sm text-muted-foreground">ID: {viewReview.product_id}</p>
                </div>
              </div>

              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Cliente</Label>
                  <p className="font-medium">{viewReview.customer_name}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="font-medium">{viewReview.customer_email}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Data</Label>
                  <p className="font-medium">
                    {format(new Date(viewReview.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Compra verificada</Label>
                  <p className="font-medium">
                    {viewReview.is_verified_purchase ? 'Sim' : 'Não'}
                  </p>
                </div>
              </div>

              {/* Rating */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">Avaliação</Label>
                <div className="flex items-center gap-3">
                  {renderStars(viewReview.rating, 'md')}
                  <span className="text-lg font-bold">{viewReview.rating}/5</span>
                </div>
              </div>

              {/* Review Content */}
              <div className="space-y-2">
                {viewReview.title && (
                  <>
                    <Label className="text-muted-foreground">Título</Label>
                    <p className="font-medium">{viewReview.title}</p>
                  </>
                )}
                <Label className="text-muted-foreground">Comentário</Label>
                <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-lg">
                  {viewReview.comment || 'Sem comentário'}
                </p>
              </div>

              {/* Media */}
              {viewReview.media && viewReview.media.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Mídia anexada</Label>
                  <div className="flex gap-2 flex-wrap">
                    {viewReview.media.map((media) => (
                      <a
                        key={media.id}
                        href={media.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-20 w-20 rounded-lg overflow-hidden bg-muted border hover:border-primary transition-colors"
                      >
                        {media.media_type === 'video' ? (
                          <div className="h-full w-full flex items-center justify-center bg-muted">
                            <Video className="h-8 w-8 text-muted-foreground" />
                          </div>
                        ) : (
                          <img
                            src={media.thumbnail_url || media.url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <ThumbsUp className="h-4 w-4" />
                  {viewReview.helpful_count} acharam útil
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewReview(null)}>
              Fechar
            </Button>
            {viewReview && !viewReview.is_approved && (
              <Button 
                onClick={() => handleApprove(viewReview.id, true)}
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Aprovar avaliação
              </Button>
            )}
            {viewReview && viewReview.is_approved && (
              <Button 
                variant="outline"
                onClick={() => handleApprove(viewReview.id, false)}
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                Reprovar avaliação
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteReview} onOpenChange={() => setDeleteReview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Avaliação</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir esta avaliação? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteReview(null)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default Reviews;
