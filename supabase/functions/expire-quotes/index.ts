import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STORE_PRIORITY = [
  '351fbca7-44d9-42eb-8a77-76fa9fc3227c', // Hyper Modas 44
  'ad756bb1-e8ff-43a7-ac5c-c600ba7bd0e3', // Bernardo Sayão
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Find pending quotes older than 3 days
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    const { data: expiredQuotes, error: fetchError } = await supabase
      .from('quotes')
      .select('id, items')
      .eq('status', 'pending')
      .lt('created_at', threeDaysAgo);

    if (fetchError) throw fetchError;

    if (!expiredQuotes || expiredQuotes.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No quotes to expire', count: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let expiredCount = 0;

    for (const quote of expiredQuotes) {
      // Restore stock for each item
      const items = (quote.items || []) as any[];
      for (const item of items) {
        const productId = item.product_id;
        const variationId = item.variation_id || null;
        const quantity = item.quantity || 1;
        if (!productId) continue;

        for (const storeId of STORE_PRIORITY) {
          let query = supabase
            .from('store_stock')
            .select('id, quantity')
            .eq('store_id', storeId)
            .eq('product_id', productId);

          if (variationId) {
            query = query.eq('variation_id', variationId);
          } else {
            query = query.is('variation_id', null);
          }

          const { data: stockRow } = await query.single();
          if (stockRow) {
            await supabase
              .from('store_stock')
              .update({ quantity: stockRow.quantity + quantity, updated_at: new Date().toISOString() })
              .eq('id', stockRow.id);
            console.log(`Stock restored: product=${productId}, variation=${variationId}, store=${storeId}, qty=+${quantity}`);
            break;
          }
        }
      }

      // Mark quote as expired
      await supabase
        .from('quotes')
        .update({ status: 'expired' })
        .eq('id', quote.id);

      expiredCount++;
      console.log(`Quote ${quote.id} expired and stock restored`);
    }

    return new Response(
      JSON.stringify({ message: `Expired ${expiredCount} quotes`, count: expiredCount }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error expiring quotes:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
