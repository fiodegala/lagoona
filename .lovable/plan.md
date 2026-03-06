

## Plano: Catálogo Público para WhatsApp

### Objetivo
Criar uma página pública `/catalogo` com todos os produtos ativos, exibindo foto, nome, preço varejo e preço atacado, com filtro por categoria. O link pode ser compartilhado diretamente no WhatsApp. Inclui botão de compartilhamento rápido via WhatsApp e botão para contatar a loja sobre cada produto.

### O que será criado

1. **Nova página `src/pages/store/CatalogPage.tsx`**
   - Rota pública `/catalogo` (sem login)
   - Carrega produtos ativos via `productsService` + `categoriesService`
   - Layout limpo e otimizado para mobile (principal uso via WhatsApp)
   - Filtro por categoria (chips horizontais)
   - Grid de produtos com: foto, nome, preço varejo, preço atacado (se houver)
   - Busca por nome
   - Botão flutuante "Compartilhar Catálogo" que abre WhatsApp com o link da página
   - Em cada produto: botão "Pedir pelo WhatsApp" que envia mensagem pré-formatada com nome e link do produto
   - Usa `StoreLayout` para manter header/footer da loja
   - Sem carrinho, sem login — apenas visualização

2. **Rota no `src/App.tsx`**
   - Adicionar `<Route path="/catalogo" element={<CatalogPage />} />`

### Detalhes técnicos

- Reutiliza `productsService.getAll()` filtrando `is_active`
- Exibe `product.price` (varejo) e `product.wholesale_price` (atacado) quando disponível
- Link WhatsApp do catálogo: `https://wa.me/?text=Confira nosso catálogo: {url}`
- Link WhatsApp por produto: `https://wa.me/556281746605?text=Olá! Tenho interesse no produto: {nome} - {link}`
- Design responsivo com grid 2 colunas mobile, 3-4 desktop
- Sem paginação complexa — scroll infinito ou "carregar mais" para simplicidade

