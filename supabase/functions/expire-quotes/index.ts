import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { restoreStockForOrder } from "../_shared/stockUtils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Find pending quotes that have expired (past expires_at or older than 3 days if no expires_at)
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    const { data: expiredQuotes, error: fetchError } = await supabase
      .from('quotes')
      .select('id, items, expires_at')
      .eq('status', 'pending')
      .or(`expires_at.lt.${new Date().toISOString()},and(expires_at.is.null,created_at.lt.${threeDaysAgo})`);

    if (fetchError) throw fetchError;

    if (!expiredQuotes || expiredQuotes.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No quotes to expire', count: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let expiredCount = 0;

    for (const quote of expiredQuotes) {
      // Restore stock using shared utility (restores to store with highest quantity)
      const items = (quote.items || []) as any[];
      await restoreStockForOrder(supabase, quote.id, items);

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
