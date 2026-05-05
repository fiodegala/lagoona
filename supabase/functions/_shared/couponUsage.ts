/**
 * Idempotently records coupon usage for a confirmed order.
 * Safe to call multiple times: relies on the unique index
 * `coupon_usage_coupon_order_unique (coupon_id, order_id)`.
 */
export async function recordCouponUsageForOrder(
  supabase: any,
  orderId: string
): Promise<void> {
  try {
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, customer_email, metadata')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      console.error(`recordCouponUsageForOrder: order ${orderId} not found`, orderErr);
      return;
    }

    const meta = (order.metadata || {}) as Record<string, any>;
    const couponId: string | undefined = meta.coupon_id;
    const couponDiscount: number = Number(meta.coupon_discount ?? 0);

    if (!couponId) {
      // No coupon attached
      return;
    }

    const customerEmail = (order.customer_email || '').trim().toLowerCase();
    if (!customerEmail) {
      console.warn(`recordCouponUsageForOrder: order ${orderId} has no customer_email`);
      return;
    }

    // Idempotency check: was this (coupon, order) already recorded?
    const { data: existing } = await supabase
      .from('coupon_usage')
      .select('id')
      .eq('coupon_id', couponId)
      .eq('order_id', orderId)
      .maybeSingle();

    if (existing) {
      console.log(`Coupon usage already recorded for order ${orderId}, coupon ${couponId}`);
      return;
    }

    const { error: insertErr } = await supabase
      .from('coupon_usage')
      .insert({
        coupon_id: couponId,
        order_id: orderId,
        customer_email: customerEmail,
        discount_applied: couponDiscount,
      });

    if (insertErr) {
      // Unique violation = race with concurrent webhook call. Treat as success.
      const code = (insertErr as any).code;
      if (code === '23505') {
        console.log(`Coupon usage race detected for order ${orderId}, coupon ${couponId} - already recorded`);
        return;
      }
      console.error(`Error inserting coupon usage for order ${orderId}:`, insertErr);
      return;
    }

    // Increment uses_count atomically-ish: read + update
    const { data: coupon } = await supabase
      .from('coupons')
      .select('uses_count')
      .eq('id', couponId)
      .single();

    if (coupon) {
      await supabase
        .from('coupons')
        .update({ uses_count: (coupon.uses_count || 0) + 1 })
        .eq('id', couponId);
    }

    console.log(`Coupon usage recorded: order=${orderId}, coupon=${couponId}, discount=${couponDiscount}`);
  } catch (err) {
    console.error(`recordCouponUsageForOrder error for order ${orderId}:`, err);
  }
}
