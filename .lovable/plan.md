

## Plano: Troca Integrada no Carrinho do PDV

### Problema Atual
Quando o tipo "Troca" é selecionado, o sistema abre um painel separado (`ExchangePanel`) com duas listas independentes. O usuário quer que tudo fique na **mesma venda/carrinho**, onde itens devolvidos aparecem junto com itens novos e o valor das devoluções é abatido automaticamente do total.

### Como vai funcionar

1. **Carrinho unificado**: No modo "Troca", o carrinho normal (ProductsStep) será usado, mas com um botão adicional para "Adicionar item devolvido"
2. **Itens devolvidos no carrinho**: Itens devolvidos aparecem com valor **negativo** (destacados em verde/azul), reduzindo o total da venda
3. **Regra obrigatória**: Para prosseguir ao pagamento, é necessário ter pelo menos um item novo E pelo menos um item devolvido
4. **Estoque**: Itens devolvidos voltam ao estoque; itens novos são baixados normalmente
5. **Total final**: `Total = Soma dos novos - Soma dos devolvidos`

### Alterações Técnicas

**1. Expandir `CartItem` (`POSCart.tsx`)**
- Adicionar flag `is_return?: boolean` ao tipo `CartItem`
- Itens com `is_return = true` exibem valor negativo e visual diferenciado (cor, ícone ↩)

**2. Modificar `ProductsStep`**
- Quando `saleType === 'troca'`, exibir dois botões de busca: "Adicionar Produto Novo" e "Adicionar Devolução"
- A busca de devolução permite selecionar itens com estoque zero (o produto está sendo devolvido)
- Itens devolvidos entram no carrinho com `is_return: true`

**3. Atualizar `POSCart` para exibir itens de devolução**
- Itens `is_return` mostrados com background diferente e valor negativo
- Subtotal separado: "Novos: R$ X" / "Devoluções: -R$ Y" / "Total: R$ Z"

**4. Atualizar cálculos no `POSPage`**
- `subtotal` e `total` consideram itens de devolução (subtraindo)
- Validação: no modo troca, exigir ≥1 item novo e ≥1 devolução para prosseguir
- No `handlePayment`, separar itens de retorno para restaurar estoque e itens novos para baixar estoque

**5. Remover uso do `ExchangePanel` no modo troca**
- O fluxo de troca passa pelo wizard normal (Tipo → Vendedor → Cliente → Produtos → Pagamento) sem desvio para painel separado

**6. Registro da venda**
- A venda é registrada como `sale_type: 'troca'` com todos os itens (novos e devolvidos marcados)
- Os itens devolvidos são incluídos no campo `items` com flag `is_return: true`
- Notas automáticas listando os itens devolvidos

