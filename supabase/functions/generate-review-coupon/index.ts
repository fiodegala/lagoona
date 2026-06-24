import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function genCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `FOTO10-${s}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const customerEmail = String(body.customer_email || '').trim().toLowerCase();
    const productId = String(body.product_id || '').trim();

    if (!customerEmail || !productId) {
      return new Response(JSON.stringify({ error: 'customer_email e product_id obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Find a recent review (last 30 min) for this email/product that has at least one image
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: reviews, error: rErr } = await supabase
      .from('product_reviews')
      .select('id, created_at, review_media:review_media(id, media_type)')
      .eq('customer_email', customerEmail)
      .eq('product_id', productId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(5);

    if (rErr) {
      console.error('review lookup error', rErr);
      return new Response(JSON.stringify({ error: 'Erro ao validar review' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const reviewWithPhoto = (reviews || []).find((r: any) =>
      Array.isArray(r.review_media) && r.review_media.some((m: any) => m.media_type === 'image')
    );

    if (!reviewWithPhoto) {
      return new Response(JSON.stringify({ error: 'Nenhum review com foto encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Dedupe: one coupon per (email, product_id) — identified via description tag
    const tag = `[REVIEW_PHOTO:${productId}:${customerEmail}]`;
    const { data: existing } = await supabase
      .from('coupons')
      .select('code')
      .ilike('description', `%${tag}%`)
      .limit(1)
      .maybeSingle();

    if (existing?.code) {
      return new Response(JSON.stringify({ code: existing.code, reused: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create unique code (retry on collision)
    let code = genCode();
    for (let i = 0; i < 5; i++) {
      const { data: clash } = await supabase.from('coupons').select('id').eq('code', code).maybeSingle();
      if (!clash) break;
      code = genCode();
    }

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error: cErr } = await supabase.from('coupons').insert({
      code,
      description: `Cupom R$10 por review com foto ${tag}`,
      discount_type: 'fixed',
      discount_value: 10,
      minimum_order_value: 50,
      max_uses: 1,
      max_uses_per_customer: 1,
      expires_at: expiresAt,
      is_active: true,
      applicable_to_combos: true,
      applicable_to_promotional: true,
    });

    if (cErr) {
      console.error('coupon insert error', cErr);
      return new Response(JSON.stringify({ error: 'Erro ao criar cupom' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ code, expires_at: expiresAt, reused: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('generate-review-coupon error', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
