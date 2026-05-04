UPDATE public.api_keys
SET scopes = ARRAY['store:read','products:read','orders:read','prices:read','stock:read','variations:read','webhooks']::text[],
    updated_at = now()
WHERE public_key = 'pk_pvT4md9qT71UfyDPapfXmU5Pma8PSYTu';