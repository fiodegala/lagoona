import { supabase } from '@/integrations/supabase/client';

export interface ReviewMedia {
  id: string;
  review_id: string;
  media_type: 'image' | 'video';
  url: string;
  thumbnail_url: string | null;
  created_at: string;
}

export interface ProductReview {
  id: string;
  product_id: string;
  customer_name: string;
  customer_email: string;
  rating: number;
  title: string | null;
  comment: string | null;
  is_verified_purchase: boolean;
  is_approved: boolean;
  helpful_count: number;
  created_at: string;
  updated_at: string;
  media?: ReviewMedia[];
}

export interface CreateReviewData {
  product_id: string;
  customer_name: string;
  customer_email: string;
  rating: number;
  title?: string;
  comment?: string;
}

export const reviewsService = {
  async getByProduct(productId: string): Promise<ProductReview[]> {
    const { data: reviews, error } = await supabase
      .from('product_reviews_public' as any)
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false }) as { data: any[] | null; error: any };

    if (error) throw error;

    // Get media for each review
    const reviewsWithMedia = await Promise.all(
      (reviews || []).map(async (review: any) => {
        const { data: media } = await supabase
          .from('review_media')
          .select('*')
          .eq('review_id', review.id);

        return {
          ...review,
          media: media || [],
        } as ProductReview;
      })
    );

    return reviewsWithMedia;
  },

  async getProductStats(productId: string): Promise<{ average: number; count: number; distribution: { 1: number; 2: number; 3: number; 4: number; 5: number } }> {
    const { data: reviews, error } = await supabase
      .from('product_reviews_public' as any)
      .select('rating')
      .eq('product_id', productId) as { data: any[] | null; error: any };

    if (error) throw error;

    const count = reviews?.length || 0;
    if (count === 0) {
      return { average: 0, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
    }

    const sum = reviews!.reduce((acc: number, r: any) => acc + r.rating, 0);
    const average = sum / count;

    const distribution: { 1: number; 2: number; 3: number; 4: number; 5: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews!.forEach((r: any) => {
      if (r.rating >= 1 && r.rating <= 5) {
        distribution[r.rating as 1 | 2 | 3 | 4 | 5] = (distribution[r.rating as 1 | 2 | 3 | 4 | 5] || 0) + 1;
      }
    });

    return { average, count, distribution };
  },

  async create(data: CreateReviewData): Promise<ProductReview> {
    const { error } = await supabase
      .from('product_reviews')
      .insert({
        product_id: data.product_id,
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        rating: data.rating,
        title: data.title || null,
        comment: data.comment || null,
        is_approved: false,
      });

    if (error) throw error;
    return {
      id: '',
      product_id: data.product_id,
      customer_name: data.customer_name,
      customer_email: '',
      rating: data.rating,
      title: data.title || null,
      comment: data.comment || null,
      is_verified_purchase: false,
      is_approved: false,
      helpful_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as ProductReview;
  },

  async uploadMedia(reviewId: string, file: File, type: 'image' | 'video'): Promise<ReviewMedia> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${reviewId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('review-media')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('review-media')
      .getPublicUrl(fileName);

    const { data: media, error: insertError } = await supabase
      .from('review_media')
      .insert({
        review_id: reviewId,
        media_type: type,
        url: urlData.publicUrl,
      })
      .select()
      .single();

    if (insertError) throw insertError;
    return media as ReviewMedia;
  },

  async incrementHelpful(reviewId: string): Promise<void> {
    // Get current count and increment
    const { data: review } = await supabase
      .from('product_reviews')
      .select('helpful_count')
      .eq('id', reviewId)
      .single();

    if (review) {
      await supabase
        .from('product_reviews')
        .update({ helpful_count: (review.helpful_count || 0) + 1 })
        .eq('id', reviewId);
    }
  },
};
