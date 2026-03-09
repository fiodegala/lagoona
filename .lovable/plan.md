

# Painel de Afiliados

Sim, é totalmente possível! Vou criar um sistema completo de afiliados onde pessoas se cadastram, recebem um link exclusivo, e ganham comissão sobre vendas realizadas através desse link.

## Visão Geral do Fluxo

```text
Afiliado se cadastra → Recebe link único (ex: /r/codigo123)
                         ↓
Cliente acessa link → Cookie/sessão salva o código
                         ↓
Cliente compra → Venda vinculada ao afiliado
                         ↓
Afiliado vê comissão no painel → Admin aprova pagamento
```

## Banco de Dados — Novas Tabelas

1. **`affiliates`** — Cadastro de afiliados (nome, email, telefone, código único, % comissão, status, saldo pendente/disponível, user_id opcional)
2. **`affiliate_sales`** — Registro de cada venda vinculada (affiliate_id, order_id, valor da venda, valor da comissão, status: pending/approved/paid)
3. **`affiliate_withdrawals`** — Solicitações de saque/pagamento (affiliate_id, valor, status, dados bancários)

## Funcionalidades

### Página Pública — Cadastro de Afiliado (`/afiliados`)
- Formulário de cadastro (nome, email, WhatsApp, CPF/CNPJ)
- Após aprovação pelo admin, afiliado recebe acesso ao painel

### Painel do Afiliado (`/afiliados/painel`)
- Login por email/senha
- Dashboard com: link exclusivo, total de cliques, vendas, comissão acumulada, saldo disponível
- Histórico de vendas com status da comissão
- Solicitar saque

### Rastreamento de Vendas
- Rota `/r/:codigo` redireciona para a home e salva o código do afiliado em cookie (30 dias)
- No checkout, o código é lido e vinculado ao pedido

### Admin — Gestão de Afiliados (`/admin/afiliados`)
- Lista de afiliados com status (pendente/ativo/bloqueado)
- Aprovar/rejeitar cadastros
- Configurar % de comissão individual ou padrão
- Ver vendas por afiliado
- Aprovar/pagar comissões

## Alterações em Código Existente

- **CheckoutPage**: Ler cookie do afiliado e salvar `affiliate_code` no pedido
- **App.tsx**: Novas rotas (`/afiliados`, `/afiliados/painel`, `/r/:codigo`, `/admin/afiliados`)
- **menuItems.ts**: Adicionar "Afiliados" ao menu admin
- **Edge Function** ou trigger: Ao confirmar pedido, calcular e registrar comissão na `affiliate_sales`

## Segurança
- RLS nas tabelas: afiliados veem apenas seus próprios dados
- Admin tem acesso total
- Código de afiliado validado no servidor antes de creditar comissão

