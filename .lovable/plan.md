## Correção: trackMetaPurchase deve disparar apenas em pagamentos aprovados

### Problema
Na função `handlePaymentSuccess` de `src/pages/store/CheckoutPage.tsx`, o `trackMetaPurchase` está fora do bloco `if (paymentData?.status === 'approved')`. Isso faz com que o evento Purchase do Meta Pixel seja disparado para qualquer status de pagamento — inclusive `'pending'` (retorno inicial do PIX) e `'failed'`.

### Diff exato

Arquivo: `src/pages/store/CheckoutPage.tsx`

```diff
@@ -382,7 +382,14 @@
     if (paymentData?.status === 'approved') {
       // ... (código existente de abandoned cart e localStorage inalterado)
       localStorage.removeItem(ABANDONED_CART_SESSION_KEY);
+
+      // Meta Pixel: Purchase — só dispara quando pagamento APROVADO
+      trackMetaPurchase({
+        content_ids: items.map(i => i.productId),
+        num_items: getItemCount(),
+        value: total,
+        order_id: orderId || undefined,
+      });
     }
 
     // Track checkout_complete event
@@ -396,13 +403,6 @@
       },
     });
 
-    // Meta Pixel: Purchase
-    trackMetaPurchase({
-      content_ids: items.map(i => i.productId),
-      num_items: getItemCount(),
-      value: total,
-      order_id: orderId || undefined,
-    });
-
     setOrderComplete(true);
```

### Resultado
- `trackMetaPurchase` será executado **apenas** quando `paymentData.status === 'approved'`.
- O restante da função (`trackAnalyticsEvent('checkout_complete')`, `setOrderComplete(true)`, `clearCart()`) continua executando para todos os status, pois esses são comportamentos desejáveis independentemente do resultado do pagamento.

Aprova essa correção?