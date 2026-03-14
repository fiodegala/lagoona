CREATE OR REPLACE FUNCTION public.notify_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _title text;
  _message text;
  _type text;
  _entity_id text;
  _supabase_url text;
  _anon_key text;
BEGIN
  _supabase_url := 'https://krlnrzwshjwupiklzblz.supabase.co';
  _anon_key := current_setting('supabase.anon_key', true);

  IF TG_TABLE_NAME = 'orders' THEN
    _type := 'new_order';
    _title := 'Novo Pedido!';
    _message := COALESCE(NEW.customer_name, NEW.customer_email, 'Cliente') || ' - R$ ' || ROUND(NEW.total::numeric, 2)::text;
    _entity_id := NEW.id::text;
  ELSIF TG_TABLE_NAME = 'abandoned_carts' THEN
    _type := 'abandoned_cart';
    _title := 'Carrinho Abandonado';
    _message := COALESCE(NEW.customer_name, 'Visitante') || ' - ' || NEW.item_count::text || ' itens';
    _entity_id := NEW.id::text;
  ELSIF TG_TABLE_NAME = 'pos_sales' THEN
    _type := 'pos_sale';
    _title := 'Nova Venda PDV';
    _message := COALESCE(NEW.customer_name, 'Cliente') || ' - R$ ' || ROUND(NEW.total::numeric, 2)::text;
    _entity_id := NEW.id::text;
  ELSE
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := _supabase_url || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon_key
    ),
    body := jsonb_build_object(
      'title', _title,
      'message', _message,
      'type', _type,
      'entityId', _entity_id
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER push_notify_new_order
    AFTER INSERT ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION notify_push();

CREATE TRIGGER push_notify_abandoned_cart
    AFTER INSERT ON public.abandoned_carts
    FOR EACH ROW
    EXECUTE FUNCTION notify_push();

CREATE TRIGGER push_notify_pos_sale
    AFTER INSERT ON public.pos_sales
    FOR EACH ROW
    EXECUTE FUNCTION notify_push();