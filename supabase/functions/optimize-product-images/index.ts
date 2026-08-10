import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BUCKET = 'product-images';
const MAX_WIDTH = 1200;
const QUALITY = 80;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

/** Converts a public storage URL into an optimized WebP object in the same bucket. */
async function optimize(url: string): Promise<string | null> {
  if (!url || !url.includes('/storage/v1/object/public/' + BUCKET + '/')) return null;
  if (/\.webp($|\?)/i.test(url)) return null;

  const path = decodeURIComponent(url.split(`/object/public/${BUCKET}/`)[1] || '').split('?')[0];
  if (!path) return null;

  const renderUrl =
    `${SUPABASE_URL}/storage/v1/render/image/public/${BUCKET}/${path}` +
    `?width=${MAX_WIDTH}&quality=${QUALITY}&resize=contain`;

  const res = await fetch(renderUrl, {
    headers: { Accept: 'image/webp,image/*', apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
  });
  if (!res.ok) return null;

  const bytes = new Uint8Array(await res.arrayBuffer());
  if (!bytes.length) return null;

  const newPath = path.replace(/\.[^./]+$/, '') + '-opt.webp';
  const { error } = await admin.storage.from(BUCKET).upload(newPath, bytes, {
    contentType: 'image/webp',
    cacheControl: '31536000',
    upsert: true,
  });
  if (error) return null;

  return admin.storage.from(BUCKET).getPublicUrl(newPath).data.publicUrl;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // --- Auth: admin only ---
    const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
    const { data: userData } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: isAdmin } = await admin.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body?.limit) || 25, 1), 100);
    const offset = Math.max(Number(body?.offset) || 0, 0);

    const cache = new Map<string, string | null>();
    const convert = async (u?: string | null) => {
      if (!u) return null;
      if (!cache.has(u)) cache.set(u, await optimize(u));
      return cache.get(u) ?? null;
    };

    let productsUpdated = 0;
    let variationsUpdated = 0;
    let imagesConverted = 0;

    // --- Products (cover + gallery in metadata) ---
    const { data: products } = await admin
      .from('products')
      .select('id, image_url, metadata')
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    for (const p of products ?? []) {
      const patch: Record<string, unknown> = {};
      const newCover = await convert(p.image_url);
      if (newCover) { patch.image_url = newCover; imagesConverted++; }

      const meta = (p.metadata ?? {}) as Record<string, unknown>;
      const gallery = Array.isArray(meta.gallery_images) ? (meta.gallery_images as string[]) : null;
      if (gallery?.length) {
        let changed = false;
        const newGallery: string[] = [];
        for (const g of gallery) {
          const n = await convert(g);
          if (n) { changed = true; imagesConverted++; newGallery.push(n); } else newGallery.push(g);
        }
        if (changed) patch.metadata = { ...meta, gallery_images: newGallery };
      }

      if (Object.keys(patch).length) {
        await admin.from('products').update(patch).eq('id', p.id);
        productsUpdated++;
      }
    }

    // --- Variations ---
    const { data: variations } = await admin
      .from('product_variations')
      .select('id, image_url')
      .not('image_url', 'is', null)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    for (const v of variations ?? []) {
      const n = await convert(v.image_url);
      if (n) {
        await admin.from('product_variations').update({ image_url: n }).eq('id', v.id);
        variationsUpdated++;
        imagesConverted++;
      }
    }

    const done = (products?.length ?? 0) < limit && (variations?.length ?? 0) < limit;

    return new Response(
      JSON.stringify({
        success: true,
        offset,
        limit,
        productsUpdated,
        variationsUpdated,
        imagesConverted,
        done,
        nextOffset: done ? null : offset + limit,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
