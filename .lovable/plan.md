

# Plano: Sistema Multi-Loja

## Resumo

Transformar o sistema atual em um sistema multi-loja, onde cada loja (Hyper Modas 44, Bernardo Sayao, Online) opera de forma independente nas vendas, mas compartilha clientes e tem regras especificas de estoque.

## Regras de Negocio

```text
+-------------------+------------------+------------------+
|   Hyper Modas 44  |  Bernardo Sayao  |     Online       |
+-------------------+------------------+------------------+
| Estoque proprio   | Estoque proprio  | Soma dos dois    |
| Vendas proprias   | Vendas proprias  | Vendas proprias  |
| Clientes compart. | Clientes compart.| Clientes compart.|
+-------------------+------------------+------------------+
```

- **Vendas**: cada loja ve apenas suas vendas (PDV e pedidos online)
- **Estoque**: Hyper Modas e Bernardo Sayao tem estoques independentes. A loja Online mostra a soma dos estoques das lojas fisicas
- **Clientes**: todas as lojas compartilham a base de clientes
- **Usuarios**: ao criar um usuario, deve-se atribuir um cargo (role) e uma loja

---

## Etapas de Implementacao

### 1. Banco de Dados -- Novas tabelas e alteracoes

**Criar tabela `stores`:**
- `id` (uuid, PK)
- `name` (text) -- "Hyper Modas 44", "Bernardo Sayao", "Online"
- `slug` (text, unique) -- "hyper-modas-44", "bernardo-sayao", "online"
- `type` (text) -- "physical" ou "online"
- `is_active` (boolean)
- `created_at` (timestamp)

Inserir as 3 lojas iniciais.

**Criar tabela `store_stock`:**
- `id` (uuid, PK)
- `store_id` (uuid, FK -> stores)
- `product_id` (uuid, FK -> products)
- `variation_id` (uuid, nullable, FK -> product_variations)
- `quantity` (integer, default 0)
- `updated_at` (timestamp)
- Constraint unique em `(store_id, product_id, variation_id)`

Essa tabela substitui o campo `stock` em `products` para controle por loja.

**Adicionar `store_id` em `user_roles`:**
- Coluna `store_id` (uuid, FK -> stores, nullable para admins que acessam tudo)

**Adicionar `store_id` em `pos_sessions` e `pos_sales`:**
- Coluna `store_id` (uuid, FK -> stores)

**Adicionar `store_id` em `orders`:**
- Coluna `store_id` (uuid, FK -> stores) -- pedidos online vinculados a loja "Online"

**RLS Policies:**
- Criar funcao `user_store_id(uuid)` que retorna o `store_id` do usuario
- Politicas em `pos_sales`, `pos_sessions`, `orders` filtram por `store_id` do usuario
- `store_stock`: usuarios veem estoque da sua loja; loja Online ve todos
- `customers` e `products`: compartilhados (sem filtro de loja)

### 2. AuthContext -- Incluir dados da loja

- Buscar `store_id` junto com os roles no `fetchUserData`
- Expor `userStore` (objeto com id, name, type) e `userStoreId` no contexto
- Adicionar helper `isOnlineStore` para logica de estoque somado

### 3. Pagina de Usuarios -- Atribuir loja

- No formulario de criacao/edicao de usuario, adicionar campo **"Loja"** (Select com as 3 lojas)
- Salvar `store_id` na tabela `user_roles` junto com o role
- Exibir a loja do usuario na tabela de listagem

### 4. Dashboard -- Filtrar por loja

- Filtrar `pos_sales` e `orders` pelo `store_id` do usuario logado
- Admins podem ter um seletor de loja para ver dados de qualquer loja
- KPIs e graficos respeitam o filtro de loja

### 5. PDV -- Vincular sessoes/vendas a loja

- Ao abrir sessao, gravar `store_id` do usuario
- Ao criar venda, gravar `store_id`
- Estoque: ao vender, decrementar na tabela `store_stock` da loja correspondente
- Busca de produtos mostra estoque da loja do usuario

### 6. Estoque -- Logica por loja

- Pagina de Produtos: mostrar estoque da loja do usuario (ou somado para admin/online)
- Ao editar estoque de um produto, editar na `store_stock` da loja
- Loja Online: exibir soma de `store_stock` de todas as lojas fisicas
- Ao vender online: decrementar de uma loja fisica (pode ser regra de prioridade ou proporcional)

### 7. Pedidos -- Filtro por loja

- Pagina de Pedidos filtra por `store_id` do usuario
- Admins podem ver todos ou filtrar por loja

### 8. Relatorios -- Filtro por loja

- Todos os relatorios filtrados pelo `store_id` do usuario
- Admin pode alternar entre lojas

### 9. Sidebar/Header -- Indicar loja ativa

- Exibir nome da loja no header ou sidebar do admin
- Admins podem ver um indicador de "Todas as lojas"

---

## Detalhes Tecnicos

### Migracao SQL (resumo)

```text
1. CREATE TABLE stores (id, name, slug, type, is_active, created_at)
2. INSERT 3 lojas
3. CREATE TABLE store_stock (id, store_id, product_id, variation_id, quantity, updated_at)
4. ALTER TABLE user_roles ADD COLUMN store_id uuid REFERENCES stores(id)
5. ALTER TABLE pos_sessions ADD COLUMN store_id uuid REFERENCES stores(id)
6. ALTER TABLE pos_sales ADD COLUMN store_id uuid REFERENCES stores(id)
7. ALTER TABLE orders ADD COLUMN store_id uuid REFERENCES stores(id)
8. CREATE FUNCTION user_store_id(uuid) RETURNS uuid
9. RLS policies com filtro de store_id
```

### Arquivos a criar/modificar

| Arquivo | Acao |
|---|---|
| Migracao SQL | Criar tabelas e policies |
| `src/contexts/AuthContext.tsx` | Adicionar store info |
| `src/pages/Users.tsx` | Campo de loja no formulario |
| `src/pages/Dashboard.tsx` | Filtrar por loja |
| `src/pages/POSPage.tsx` | Vincular sessao/venda a loja |
| `src/services/posService.ts` | Passar store_id nas queries |
| `src/pages/Products.tsx` | Mostrar estoque por loja |
| `src/services/products.ts` | Criar service de store_stock |
| `src/pages/Orders.tsx` | Filtrar por loja |
| `src/pages/Reports.tsx` | Filtrar por loja |
| `src/components/AdminLayout.tsx` | Mostrar loja no sidebar |
| `src/components/pos/ProductGrid.tsx` | Estoque por loja |
| `src/services/offlineService.ts` | Cache com store_id |

### Complexidade e riscos

- **Alta complexidade**: muitas tabelas e paginas impactadas
- **Migracao de dados**: estoque atual precisa ser migrado para `store_stock`
- **Estoque Online**: regra de qual loja fisica decrementar ao vender online precisa de definicao clara
- **Offline/POS**: o cache offline precisa considerar o store_id

