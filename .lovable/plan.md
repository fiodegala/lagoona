

# Plano: Reserva de Estoque em Orcamentos

## Resumo

Quando um orcamento for criado no PDV, as pecas serao automaticamente abatidas do estoque (reservadas). Se o orcamento nao for convertido em venda apos 3 dias, o estoque sera restaurado automaticamente via um job agendado.

## Como Funciona

```text
Orcamento criado → Estoque deduzido (reservado)
                         |
            +------------+-------------+
            |                          |
   Convertido em venda           3 dias sem conversao
   (estoque ja foi deduzido,     → Job restaura estoque
    nada mais a fazer)              e marca como "expired"
```

## Etapas

### 1. Deduzir estoque ao criar orcamento (POSPage.tsx)

Apos inserir o orcamento na tabela `quotes`, chamar a mesma logica de deducao de estoque usada nas vendas (via `store_stock`), seguindo a prioridade de lojas (Hyper Modas 44 primeiro, depois Bernardo Sayao).

### 2. Restaurar estoque ao cancelar/excluir orcamento (Quotes.tsx)

Ao deletar ou cancelar um orcamento que ainda esteja pendente, restaurar o estoque das pecas reservadas.

### 3. Nao deduzir novamente ao converter em venda (Quotes.tsx)

Como o estoque ja foi deduzido na criacao do orcamento, a conversao em venda NAO deve deduzir estoque novamente. Adicionar flag ou logica para pular a deducao.

### 4. Edge Function agendada para expirar orcamentos (nova)

Criar uma Edge Function `expire-quotes` que:
- Busca orcamentos com `status = 'pending'` e `created_at` mais antigo que 3 dias
- Para cada um, restaura o estoque das pecas (mesma logica de restore do `update-order-status`)
- Atualiza o status para `expired`

### 5. Agendar via pg_cron

Criar um job `pg_cron` que roda a cada hora chamando a Edge Function `expire-quotes`.

## Detalhes Tecnicos

### Arquivos a criar
| Arquivo | Descricao |
|---|---|
| `supabase/functions/expire-quotes/index.ts` | Edge Function que expira orcamentos com mais de 3 dias |

### Arquivos a modificar
| Arquivo | Mudanca |
|---|---|
| `src/pages/POSPage.tsx` | Apos criar orcamento, deduzir estoque via `store_stock` |
| `src/pages/Quotes.tsx` | Ao deletar/cancelar, restaurar estoque. Ao converter, nao deduzir novamente |
| `supabase/config.toml` | Adicionar `[functions.expire-quotes]` com `verify_jwt = false` |

### Migracao SQL
- Habilitar extensoes `pg_cron` e `pg_net` (se ainda nao ativas)
- Criar job cron que chama `expire-quotes` a cada hora

### Logica de deducao/restauracao de estoque
Reutilizar o padrao existente em `update-order-status`: percorrer as lojas fisicas por prioridade, deduzir/restaurar quantidades na `store_stock` para cada item (considerando `product_id` e `variation_id`).

