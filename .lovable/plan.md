

# Curva ABC de Produtos

## Objetivo
Criar uma página admin completa de análise Curva ABC baseada em vendas reais (POS + online), com gráfico de Pareto, tabela detalhada e filtros por período.

## Implementação

### 1. Nova página `src/pages/ABCCurve.tsx`

**Dados**: Buscar `pos_sales` (status != cancelled) e `orders` (status != cancelled) do Supabase, extrair itens do campo JSON `items` de cada venda, agrupar por produto e calcular faturamento total por produto.

**Classificação ABC**:
- Ordenar produtos por faturamento decrescente
- Calcular % acumulado do faturamento
- Classe A: até 80% acumulado
- Classe B: de 80% a 95% acumulado
- Classe C: acima de 95%

**Filtros**: Período (7d, 30d, 90d, mês atual, customizado com DateRange picker).

**KPI Cards**: Total faturado, quantidade de SKUs por classe (A/B/C), ticket médio.

**Gráfico de Pareto** (Recharts):
- Barras: faturamento por produto (eixo esquerdo)
- Linha: % acumulado (eixo direito)
- Cores diferenciadas por classe (verde=A, amarelo=B, vermelho=C)

**Tabela detalhada**: Ranking, nome do produto, quantidade vendida, faturamento, % individual, % acumulado, classe (badge colorido). Com busca por nome.

### 2. Rota e Menu

- Adicionar lazy import e rota `/admin/curva-abc` em `src/App.tsx` (protegida por admin)
- Adicionar item "Curva ABC" com ícone `TrendingUp` em `src/config/menuItems.ts`, logo após "Distribuição Estoque"

### Arquivos alterados
- `src/pages/ABCCurve.tsx` (novo)
- `src/App.tsx` (nova rota)
- `src/config/menuItems.ts` (novo item de menu)

