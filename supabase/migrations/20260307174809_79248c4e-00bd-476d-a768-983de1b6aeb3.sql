
-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function to call low-stock-alert edge function when stock changes
CREATE OR REPLACE FUNCTION public.notify_low_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _min_stock integer;
  _supabase_url text;
  _anon_key text;
BEGIN
  -- Only act on updates that decrease quantity
  IF TG_OP = 'UPDATE' AND NEW.quantity >= OLD.quantity THEN
    RETURN NEW;
  END IF;

  -- Get product min_stock
  SELECT min_stock INTO _min_stock FROM public.products WHERE id = NEW.product_id;
  
  -- Default min_stock is 0, skip if not configured
  IF _min_stock IS NULL OR _min_stock <= 0 THEN
    RETURN NEW;
  END IF;

  -- Quick check: if new quantity is already above min, skip
  IF NEW.quantity > _min_stock THEN
    RETURN NEW;
  END IF;

  -- Get Supabase URL and key from vault or use hardcoded project values
  _supabase_url := 'https://krlnrzwshjwupiklzblz.supabase.co';
  _anon_key := current_setting('supabase.anon_key', true);

  -- Call edge function asynchronously
  PERFORM net.http_post(
    url := _supabase_url || '/functions/v1/low-stock-alert',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    ),
    body := jsonb_build_object(
      'product_id', NEW.product_id,
      'variation_id', NEW.variation_id,
      'new_quantity', NEW.quantity
    )
  );

  RETURN NEW;
END;
$$;

-- Create trigger on store_stock
CREATE TRIGGER trg_low_stock_alert
  AFTER UPDATE OF quantity ON public.store_stock
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_low_stock();
