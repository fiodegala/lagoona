

# VM (Visual de Loja) - Visual Merchandising com Vídeos

## Objetivo
Criar uma seção de Visual Merchandising onde fotos e vídeos do padrão visual das lojas são publicados. Usuários editores selecionados alimentam o conteúdo; os demais apenas visualizam.

## Banco de Dados

### Migration
- **Tabela `vm_posts`**: id, title, description, category (Vitrine/Prateleira/Provador/etc), store_id (nullable), images (jsonb array de URLs), videos (jsonb array de URLs - uploads e links externos), created_by, is_active, created_at, updated_at
- **Tabela `vm_editors`**: id, user_id, created_at
- **Função `is_vm_editor(uuid)`**: retorna true se usuário está em vm_editors ou é admin
- **Bucket `vm-media`** (público): para fotos e vídeos do VM
- **RLS**: todos autenticados com role leem; somente vm_editors/admins inserem/editam/deletam

### Storage
Bucket `vm-media` público, com políticas para upload por editores/admins e leitura pública.

## Frontend

### 1. Nova página `src/pages/VisualMerchandising.tsx`

**Modo Visualização (todos)**:
- Grid de cards com fotos e vídeos do VM
- Filtro por loja e categoria
- Clique na mídia abre lightbox (fotos) ou player ampliado (vídeos)
- Busca por titulo

**Modo Editor (vm_editors + admins)**:
- Botão "Nova Publicação" com modal:
  - Titulo, descrição, categoria (select), loja (select opcional)
  - Upload de múltiplas imagens (reutiliza `MultiImageUpload`)
  - Upload de vídeos (reutiliza `VideoUpload`) + opção de colar link externo (YouTube/Instagram)
- Editar/excluir posts existentes
- Aba "Editores" (somente admin): gerenciar quais usuários podem publicar

### 2. Rota e Menu
- Lazy import + rota `/admin/vm` protegida em `App.tsx`
- Novo item no menu: ícone `Eye`, label "Visual de Loja", menuKey `visual-merchandising`

## Arquivos
- **Novo**: `src/pages/VisualMerchandising.tsx`
- **Editado**: `src/App.tsx` (rota)
- **Editado**: `src/config/menuItems.ts` (menu)
- **Migration**: tabelas, função, bucket, RLS

