

## Plano: Selecionar Colaborador como Cliente na modalidade "Colaborador"

### Problema
Quando o tipo de venda é "Colaborador", a etapa de cliente mostra a lista de clientes cadastrados. O correto é mostrar a lista de **usuários/colaboradores do sistema** (da tabela `profiles` + `user_roles`), pois o cliente nessa modalidade é o próprio funcionário.

### Solução

**Arquivo: `src/components/pos/steps/CustomerStep.tsx`**

1. Quando `saleType === 'colaborador'`, ao invés de buscar na tabela `customers`, buscar na tabela `profiles` (com join em `user_roles`) para listar todos os colaboradores do sistema.
2. Alterar o título/subtítulo para "Selecione o Colaborador".
3. A busca filtra por nome do colaborador.
4. Ao selecionar, mapear os dados do colaborador para o formato `Customer` (id, name, email, phone, document) para manter compatibilidade com o restante do fluxo (pagamento, registro de venda).
5. Esconder o botão "Cadastrar novo cliente" nessa modalidade (colaboradores são gerenciados na tela de Usuários).
6. Tornar a seleção **obrigatória** (não permitir pular), já que precisa registrar qual colaborador está comprando.

### Detalhes técnicos

- Query para colaboradores: `supabase.from('profiles').select('id, user_id, full_name').order('full_name')`, com filtro ilike no `full_name` quando há busca.
- Opcionalmente cruzar com `user_roles` para trazer o cargo (role) como informação visual.
- O `Customer` resultante usa `user_id` como `id` e `full_name` como `name`, com `email`/`phone`/`document` como `null`.

