

# Loja TikTok Shop no PDV

## Objetivo
Criar uma loja "TikTok Shop" no sistema e adicionar a opção de venda pelo TikTok no PDV, visível apenas para admins. Vendas registradas com esse canal serão contabilizadas na loja TikTok Shop, com estoque sendo deduzido normalmente.

## Implementação

### 1. Criar a loja "TikTok Shop" no banco de dados
- Inserir um novo registro na tabela `stores` com `name: 'TikTok Shop'`, `slug: 'tiktok-shop'`, `type: 'online'` (tipo online para não receber transferências físicas, e o estoque é deduzido da loja com maior quantidade — mesmo comportamento do e-commerce).

### 2. Adicionar canal "TikTok" no PaymentPanel (`src/components/pos/PaymentPanel.tsx`)
- Adicionar `'tiktok'` ao tipo `SaleChannel`.
- Adicionar opção `{ value: 'tiktok', label: 'TikTok Shop', icon: <Video /> }` no array `channelOptions`.
- Aceitar uma nova prop `isAdmin: boolean` para controlar visibilidade — o botão TikTok só aparece quando `isAdmin === true`.

### 3. Passar `isAdmin` do POSPage → PaymentStep → PaymentPanel
- **POSPage**: já tem `isAdmin` do `useAuth()`. Passar como prop para `PaymentStep`.
- **PaymentStep** (`src/components/pos/steps/PaymentStep.tsx`): receber `isAdmin` e repassar ao `PaymentPanel`.
- **PaymentPanel**: filtrar `channelOptions` para mostrar TikTok apenas quando `isAdmin`.

### 4. Atribuir `store_id` da TikTok Shop quando canal TikTok for selecionado (`src/pages/POSPage.tsx`)
- No `handlePayment`, verificar se `paymentDetails.channel === 'tiktok'`. Se sim, substituir o `store_id` pelo ID da loja TikTok Shop (buscar da tabela `stores` ou usar constante).
- O mesmo para orçamentos (quotes).

### Arquivos alterados
- **Migração SQL**: inserir loja TikTok Shop
- `src/components/pos/PaymentPanel.tsx`: novo canal + prop `isAdmin`
- `src/components/pos/steps/PaymentStep.tsx`: repassar `isAdmin`
- `src/pages/POSPage.tsx`: passar `isAdmin`, lógica de `store_id` para TikTok

### Resultado
- Admins veem o botão "TikTok Shop" no seletor de canal do pagamento
- Vendas TikTok são registradas com `store_id` da loja TikTok Shop
- Estoque é deduzido da loja física com maior quantidade (comportamento padrão para lojas tipo `online`)
- Sellers/colaboradores não veem a opção TikTok

