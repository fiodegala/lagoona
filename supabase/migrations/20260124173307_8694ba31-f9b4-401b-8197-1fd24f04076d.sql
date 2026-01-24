-- Create product_reviews table
CREATE TABLE public.product_reviews (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title TEXT,
    comment TEXT,
    is_verified_purchase BOOLEAN NOT NULL DEFAULT false,
    is_approved BOOLEAN NOT NULL DEFAULT false,
    helpful_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create review_media table for images and videos
CREATE TABLE public.review_media (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    review_id UUID NOT NULL REFERENCES public.product_reviews(id) ON DELETE CASCADE,
    media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_media ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_reviews
CREATE POLICY "Anyone can view approved reviews"
ON public.product_reviews
FOR SELECT
USING (is_approved = true);

CREATE POLICY "Admin/Manager can manage reviews"
ON public.product_reviews
FOR ALL
USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Anyone can create reviews"
ON public.product_reviews
FOR INSERT
WITH CHECK (true);

-- RLS Policies for review_media
CREATE POLICY "Anyone can view media of approved reviews"
ON public.review_media
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.product_reviews 
        WHERE id = review_id AND is_approved = true
    )
);

CREATE POLICY "Admin/Manager can manage review media"
ON public.review_media
FOR ALL
USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Anyone can create review media"
ON public.review_media
FOR INSERT
WITH CHECK (true);

-- Create storage bucket for review media
INSERT INTO storage.buckets (id, name, public)
VALUES ('review-media', 'review-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for review-media bucket
CREATE POLICY "Anyone can view review media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'review-media');

CREATE POLICY "Anyone can upload review media"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'review-media');

-- Create index for faster queries
CREATE INDEX idx_product_reviews_product_id ON public.product_reviews(product_id);
CREATE INDEX idx_product_reviews_rating ON public.product_reviews(rating);
CREATE INDEX idx_review_media_review_id ON public.review_media(review_id);

-- Trigger for updated_at
CREATE TRIGGER update_product_reviews_updated_at
BEFORE UPDATE ON public.product_reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();