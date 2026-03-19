

# Plano: Botão "Adicionar Brinde" na Etapa de Pagamento

## Resumo

Adicionar um botão na tela de pagamento (PaymentStep) que permite ao operador incluir itens como brinde (preço R$ 0,00) antes de finalizar a venda. Isso aproveita o cliente já selecionado no fluxo.

## Como Funciona

```text
Fluxo normal: Tipo → Vendedor → Cliente → Produtos → Pagamento
                                                         ↑
                                              Botão "Adicionar Brinde"
                                              → Abre busca de produto
                                              → Produto adicionado com preço R$ 0,00
                                              → Aparece na lista com badge "Brinde"
```

## Etapas

### 1. Atualizar PaymentStep com botão de brinde e busca de produto

- Adicionar botão "Adicionar Brinde" (ícone Gift) no resumo da venda
- Ao clicar, abrir um Dialog/Sheet com busca de produto (reutilizar `ProductSearch`)
- Produto selecionado é adicionado ao carrinho com `unit_price: 0` e flag `is_gift: true`

### 2. Propagar callback de adição de brinde

- Adicionar prop `onAddGiftItem` no `PaymentStep` que recebe `(product, variationId?)` 
- No `POSPage.tsx`, implementar handler que adiciona o item ao `cartItems` com preço zero e marcação de brinde

### 3. Identificação visual dos brindes

- Na lista de itens do resumo (PaymentStep), mostrar badge "Brinde" ao lado de itens com preço zero adicionados como presente
- No `CartItem` type, adicionar campo opcional `is_gift?: boolean`

### 4. Atualizar SaleType e labels (brinde standalone)

- Adicionar `'brinde'` ao type `SaleType` em `ProductSearch.tsx`
- Adicionar opção "Brinde" no `SaleTypeStep.tsx` com ícone `Gift`
- No `resolvePrice` do `POSPage.tsx`, retornar `0` quando `saleType === 'brinde'`
- No `saleTypeLabels` do `PaymentStep.tsx`, adicionar entrada para brinde
- Excluir vendas tipo brinde dos KPIs em `Sales.tsx` e `Dashboard.tsx`

## Detalhes Técnicos

| Arquivo | Mudança |
|---|---|
| `src/components/pos/POSCart.tsx` | Adicionar `is_gift?: boolean` ao `CartItem` |
| `src/components/pos/ProductSearch.tsx` | Adicionar `'brinde'` ao `SaleType` |
| `src/components/pos/steps/SaleTypeStep.tsx` | Novo botão "Brinde" com ícone Gift |
| `src/components/pos/steps/PaymentStep.tsx` | Botão "Adicionar Brinde" + Dialog com ProductSearch + badge visual |
| `src/pages/POSPage.tsx` | Handler `handleAddGiftItem`, `resolvePrice` para brinde, passar prop ao PaymentStep |
| `src/pages/Sales.tsx` | Badge "Brinde" + excluir de KPIs |
| `src/pages/Dashboard.tsx` | Excluir brindes dos totais de faturamento |

Sem migrações SQL necessárias — `sale_type` já é texto livre na tabela `pos_sales`.

