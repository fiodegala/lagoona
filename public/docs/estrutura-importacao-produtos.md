## Estrutura de Exportação de Produtos para Importação no Sistema Lagoona

### Formato do Arquivo
- **Tipo:** CSV (Comma-Separated Values)
- **Encoding:** UTF-8 (com BOM)
- **Separador:** Ponto e vírgula (`;`) ou vírgula (`,`)
- **Extensão:** `.csv`

---

### Colunas

#### Obrigatórias

| Coluna | Tipo | Regras | Exemplo |
|--------|------|--------|---------|
| **Nome** | Texto | Mínimo 2 caracteres, máximo 200 | `Camiseta Básica` |
| **Preço (R$)** | Numérico | Aceita vírgula ou ponto como decimal. Não usar separador de milhar. | `99,90` ou `99.90` |

#### Opcionais

| Coluna | Tipo | Regras | Exemplo |
|--------|------|--------|---------|
| **Descrição** | Texto | Sem limite definido | `Camiseta 100% algodão` |
| **Categoria** | Texto | Deve corresponder ao nome exato de uma categoria já cadastrada no sistema | `Camisetas` |
| **Estoque** | Inteiro | Número inteiro >= 0 | `50` |
| **Status** | Texto | `Ativo` ou `Inativo`. Se omitido, o padrão é `Ativo` | `Ativo` |

---

### Nomes de Cabeçalho Aceitos

O sistema reconhece variações nos nomes das colunas:

| Campo | Cabeçalhos aceitos |
|-------|-------------------|
| Nome | `Nome`, `Name` |
| Descrição | `Descrição`, `Descricao`, `Description` |
| Categoria | `Categoria`, `Category` |
| Preço | `Preço`, `Preco`, `Price`, `Preço (R$)` |
| Estoque | `Estoque`, `Stock` |
| Status | `Status` |

---

### Exemplo de Arquivo CSV

```csv
Nome;Descrição;Categoria;Preço (R$);Estoque;Status
Camiseta Básica;Camiseta 100% algodão;Camisetas;59,90;100;Ativo
Bermuda Jeans;Bermuda masculina jeans;;129,90;30;Ativo
Vestido Floral;Vestido estampado floral;Vestidos;189,90;0;Inativo
Calça Skinny;Calça jeans skinny feminina;Calças;159,90;45;Ativo
Blusa Cropped;;Blusas;79,90;80;Ativo
```

---

### Regras e Observações

1. **A primeira linha deve ser o cabeçalho** com os nomes das colunas.
2. **Valores que contenham o caractere separador** (`;` ou `,`) devem estar entre aspas duplas. Exemplo: `"Produto grande, bonito"`.
3. **O campo Categoria** deve conter o nome exato de uma categoria previamente cadastrada no sistema. Se a categoria não for encontrada, o produto será marcado com erro na validação.
4. **Preços com prefixo R$** são aceitos — o sistema remove automaticamente o símbolo e espaços.
5. **Linhas em branco** são ignoradas automaticamente.

---

### Limitações da Importação

A importação via CSV cria **apenas produtos simples**. Os seguintes dados precisam ser adicionados manualmente após a importação:

- Variações (cor, tamanho, etc.)
- Imagens do produto
- Preço de atacado
- Preço exclusivo
- Preço promocional
- Código de barras
- Peso e dimensões (para cálculo de frete)
- SKU

---

### Categorias Cadastradas Atualmente

> **Importante:** Solicitar ao administrador do sistema a lista atualizada de categorias cadastradas, pois os nomes devem ser idênticos para o mapeamento correto.

---

*Documento gerado em 28/02/2026 — Sistema Lagoona FDG*
