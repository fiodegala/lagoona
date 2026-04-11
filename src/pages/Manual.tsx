import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import VideoUpload from '@/components/VideoUpload';
import {
  LayoutDashboard,
  Monitor,
  Package,
  FolderTree,
  Warehouse,
  UserPlus,
  ShoppingCart,
  Receipt,
  ShoppingBasket,
  FileText,
  Star,
  Tag,
  Target,
  Truck,
  Image as ImageIcon,
  BarChart3,
  Sparkles,
  BrainCircuit,
  Users,
  History,
  Handshake,
  Upload,
  Settings,
  BookOpen,
  Plus,
  Trash2,
  Pencil,
  PlayCircle,
  ChevronLeft,
  ChevronRight,
  Video,
  DollarSign,
  ClipboardList,
  Megaphone,
  Eye,
  Database,
  KeyRound,
  FileCode2,
  TrendingUp,
  Zap,
} from 'lucide-react';

interface StepByStep {
  title: string;
  steps: string[];
}

interface ManualSection {
  icon: typeof LayoutDashboard;
  title: string;
  badge: string;
  category: string;
  description: string;
  features: string[];
  tutorials: StepByStep[];
}

const sections: ManualSection[] = [
  // === OPERAÇÕES ===
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    badge: 'Todos',
    category: 'Operações',
    description: 'Painel principal com visão geral do desempenho da loja.',
    features: ['Cards com métricas em tempo real', 'Gráfico de vendas por período', 'Mapa de vendas por estado', 'Métricas de WhatsApp', 'Progresso da meta mensal', 'Filtro por loja'],
    tutorials: [
      { title: 'Como visualizar o Dashboard', steps: ['No menu lateral, clique em **Dashboard**', 'Os cards no topo mostram: Faturamento, Pedidos, Ticket Médio e Meta', 'Role para ver gráficos e mapa de vendas'] },
      { title: 'Como configurar a Meta Mensal', steps: ['Vá em **Configurações** → **Metas de Vendas**', 'Defina o valor da meta mensal', 'Clique em **Salvar**'] },
    ],
  },
  {
    icon: Monitor,
    title: 'PDV (Ponto de Venda)',
    badge: 'Todos',
    category: 'Operações',
    description: 'Sistema de ponto de venda completo com suporte offline.',
    features: ['Abertura/fechamento de caixa', 'Busca por nome, SKU ou código de barras', 'Seleção de variações', 'Pagamento dividido', 'Troca e devolução', 'Modo offline'],
    tutorials: [
      { title: 'Como abrir o caixa', steps: ['Clique em **PDV** no menu', 'Informe o **saldo inicial**', 'Clique em **Abrir Caixa**'] },
      { title: 'Como realizar uma venda', steps: ['Busque o produto na barra de busca', 'Selecione variações se houver', 'Defina cliente e forma de pagamento', 'Clique em **Finalizar Venda**'] },
      { title: 'Como fechar o caixa', steps: ['No PDV, clique no **Menu** (☰)', 'Selecione **Gestão do Caixa**', 'Informe o **saldo final**', 'Clique em **Fechar Caixa**'] },
    ],
  },
  {
    icon: Receipt,
    title: 'Vendas (PDV)',
    badge: 'Todos',
    category: 'Operações',
    description: 'Histórico de vendas realizadas pelo PDV com filtros e detalhes.',
    features: ['Listagem de todas as vendas', 'Filtro por período e status', 'Cancelamento com motivo', 'Detalhes por venda'],
    tutorials: [
      { title: 'Como visualizar vendas', steps: ['Clique em **Vendas** no menu', 'Use os filtros para refinar a busca', 'Clique em uma venda para ver detalhes'] },
    ],
  },
  {
    icon: Receipt,
    title: 'Relatório de Caixa',
    badge: 'Todos',
    category: 'Operações',
    description: 'Relatório detalhado de abertura e fechamento de caixa, com diferenças e movimentações.',
    features: ['Sessões de caixa por período', 'Diferença entre saldo esperado e real', 'Detalhes de transações por sessão'],
    tutorials: [
      { title: 'Como consultar relatório de caixa', steps: ['Clique em **Relatório de Caixa** no menu', 'Selecione o período desejado', 'Visualize sessões com saldo inicial, final e diferença'] },
    ],
  },
  {
    icon: ClipboardList,
    title: 'Ordens de Serviço',
    badge: 'Todos',
    category: 'Operações',
    description: 'Gestão de ordens de serviço entre departamentos com fluxo de aprovação.',
    features: ['Criação de OS com anexo de imagem/vídeo', 'Atribuição por departamento', 'Fluxo: Aberta → Aprovada → Em Andamento → Concluída', 'Comentários em tempo real', 'Notificações push'],
    tutorials: [
      { title: 'Como criar uma OS', steps: ['Clique em **Ordens de Serviço** no menu', 'Clique em **Nova OS**', 'Preencha título, departamento, prioridade e descrição', 'Anexe imagem/vídeo se necessário', 'Clique em **Criar OS**'] },
    ],
  },
  {
    icon: Megaphone,
    title: 'Comunicados',
    badge: 'Todos',
    category: 'Operações',
    description: 'Comunicados internos com suporte a imagem e vídeo. Apenas admins podem criar.',
    features: ['Criação de comunicados com mídia', 'Direcionamento por usuário', 'Visualização em grid', 'Pop-up automático'],
    tutorials: [
      { title: 'Como criar um comunicado', steps: ['Clique em **Comunicados** no menu', 'Clique em **Novo Comunicado** (admin)', 'Preencha título, mensagem e anexe mídia', 'Defina o público-alvo', 'Clique em **Publicar**'] },
    ],
  },

  // === CATÁLOGO ===
  {
    icon: Package,
    title: 'Produtos',
    badge: 'Admin',
    category: 'Catálogo',
    description: 'Cadastro completo de produtos com variações, imagens e vídeo.',
    features: ['Múltiplas imagens com drag & drop', 'Variações (cor, tamanho)', 'Preços: varejo, promocional, atacado, exclusivo', 'SKU e código de barras', 'Dimensões para cálculo de frete'],
    tutorials: [
      { title: 'Como cadastrar um produto', steps: ['Clique em **Produtos** → **Novo Produto**', 'Preencha nome, descrição, preço e categoria', 'Adicione imagens e vídeo', 'Defina estoque e dimensões', 'Clique em **Salvar**'] },
      { title: 'Como criar variações', steps: ['Edite o produto', 'Na seção **Variações**, adicione atributos', 'Clique em **Gerar Combinações**', 'Configure preço/estoque por variação', 'Salve'] },
    ],
  },
  {
    icon: DollarSign,
    title: 'Valores de Produtos',
    badge: 'Todos',
    category: 'Catálogo',
    description: 'Visualize e edite rapidamente os preços de todos os produtos e variações em uma tabela.',
    features: ['Edição em massa de preços', 'Visualização consolidada', 'Preço varejo, atacado, promocional e exclusivo'],
    tutorials: [
      { title: 'Como editar valores', steps: ['Clique em **Valores de Produtos** no menu', 'Localize o produto na tabela', 'Edite os campos de preço diretamente', 'As alterações são salvas automaticamente'] },
    ],
  },
  {
    icon: FolderTree,
    title: 'Categorias',
    badge: 'Admin',
    category: 'Catálogo',
    description: 'Organize produtos em categorias e subcategorias com tabela de medidas.',
    features: ['Hierarquia pai/filho', 'Imagem e slug automático', 'Tabela de medidas vinculada', 'Ordenação personalizada'],
    tutorials: [
      { title: 'Como criar uma categoria', steps: ['Clique em **Categorias** → **Nova Categoria**', 'Preencha nome, descrição e imagem', 'Para subcategoria, selecione a categoria pai', 'Clique em **Salvar**'] },
    ],
  },
  {
    icon: Package,
    title: 'Combos',
    badge: 'Admin',
    category: 'Catálogo',
    description: 'Crie kits/combos com produtos agrupados e preço especial.',
    features: ['Agrupamento de múltiplos produtos', 'Preço especial do combo', 'Imagem do combo', 'Frete grátis opcional'],
    tutorials: [
      { title: 'Como criar um combo', steps: ['Clique em **Combos** → **Novo Combo**', 'Defina nome e preço do combo', 'Adicione os produtos que compõem o combo', 'Clique em **Salvar**'] },
    ],
  },
  {
    icon: Target,
    title: 'Compre Junto (Upsells)',
    badge: 'Admin',
    category: 'Catálogo',
    description: 'Configure sugestões de "Compre Junto" para aumentar o ticket médio.',
    features: ['Vinculação de produtos complementares', 'Desconto por compra conjunta', 'Exibição automática na página do produto'],
    tutorials: [
      { title: 'Como configurar Compre Junto', steps: ['Clique em **Compre Junto**', 'Selecione o produto principal', 'Adicione os produtos sugeridos', 'Defina o desconto', 'Clique em **Salvar**'] },
    ],
  },

  // === ESTOQUE ===
  {
    icon: Warehouse,
    title: 'Estoque',
    badge: 'Todos',
    category: 'Estoque',
    description: 'Controle completo de estoque com alertas e transferências entre lojas.',
    features: ['Tabela consolidada', 'Alertas de estoque baixo', 'Transferência com aprovação', 'Reserva para orçamentos'],
    tutorials: [
      { title: 'Como verificar estoque', steps: ['Clique em **Estoque** no menu', 'Produtos abaixo do mínimo ficam em **vermelho**', 'Use a busca para localizar itens'] },
      { title: 'Como transferir estoque', steps: ['Clique em **Transferir Estoque**', 'Selecione origem, destino, produto e quantidade', 'Clique em **Enviar**', 'A loja de destino deve aceitar a transferência'] },
    ],
  },
  {
    icon: BarChart3,
    title: 'Distribuição de Estoque',
    badge: 'Todos',
    category: 'Estoque',
    description: 'Visualize a distribuição de estoque entre todas as lojas e identifique desequilíbrios.',
    features: ['Visão por loja', 'Comparativo entre unidades', 'Identificação de produtos concentrados'],
    tutorials: [
      { title: 'Como usar Distribuição de Estoque', steps: ['Clique em **Distribuição Estoque** no menu', 'Veja a distribuição de cada produto por loja', 'Identifique lojas com excesso ou falta'] },
    ],
  },
  {
    icon: TrendingUp,
    title: 'Curva ABC',
    badge: 'Admin',
    category: 'Estoque',
    description: 'Análise ABC para classificar produtos por relevância de vendas.',
    features: ['Classificação A, B e C automática', 'Gráfico de Pareto', 'Exportação do relatório'],
    tutorials: [
      { title: 'Como usar a Curva ABC', steps: ['Clique em **Curva ABC** no menu', 'Os produtos são classificados automaticamente', 'Classe A = 80% do faturamento, B = 15%, C = 5%', 'Use para tomar decisões de compra e exposição'] },
    ],
  },

  // === VENDAS ===
  {
    icon: UserPlus,
    title: 'Clientes',
    badge: 'Todos',
    category: 'Vendas',
    description: 'Cadastro de clientes PF e PJ com histórico de compras.',
    features: ['Cadastro PF e PJ', 'Histórico de compras', 'Saldo de crédito', 'Filtro por loja'],
    tutorials: [
      { title: 'Como cadastrar um cliente', steps: ['Clique em **Clientes** → **Novo Cliente**', 'Selecione PF ou PJ', 'Preencha os dados', 'Clique em **Salvar**'] },
    ],
  },
  {
    icon: ShoppingCart,
    title: 'Pedidos',
    badge: 'Todos',
    category: 'Vendas',
    description: 'Gerenciamento de pedidos da loja online com rastreamento.',
    features: ['Fluxo de status completo', 'Código de rastreio', 'Geração de etiqueta', 'Filtros por status e período'],
    tutorials: [
      { title: 'Como gerenciar pedidos', steps: ['Clique em **Pedidos** no menu', 'Clique em um pedido para ver detalhes', 'Altere o status no dropdown', 'Adicione código de rastreio se necessário'] },
    ],
  },
  {
    icon: FileText,
    title: 'Orçamentos',
    badge: 'Todos',
    category: 'Vendas',
    description: 'Crie orçamentos com reserva de estoque e link para o cliente.',
    features: ['Reserva automática de estoque', 'Link compartilhável', 'Validade configurável', 'Conversão em pedido'],
    tutorials: [
      { title: 'Como criar um orçamento', steps: ['Clique em **Orçamentos** → **Novo Orçamento**', 'Adicione o cliente e os produtos', 'Defina validade e condições', 'Clique em **Salvar**', 'Compartilhe o link com o cliente'] },
    ],
  },
  {
    icon: ShoppingBasket,
    title: 'Carrinhos Abandonados',
    badge: 'Todos',
    category: 'Vendas',
    description: 'Monitore carrinhos abandonados e recupere vendas.',
    features: ['Listagem automática', 'Envio de mensagem de recuperação', 'Cupom de incentivo', 'Taxa de conversão'],
    tutorials: [
      { title: 'Como recuperar um carrinho', steps: ['Clique em **Carrinhos Abandonados**', 'Localize o carrinho desejado', 'Clique em **Enviar Lembrete**', 'O cliente receberá uma mensagem de recuperação'] },
    ],
  },
  {
    icon: Tag,
    title: 'Cupons',
    badge: 'Admin',
    category: 'Vendas',
    description: 'Crie e gerencie cupons de desconto com regras avançadas.',
    features: ['Desconto por % ou valor fixo', 'Limite de uso', 'Validade configurável', 'Cupom progressivo', 'Integração com roleta'],
    tutorials: [
      { title: 'Como criar um cupom', steps: ['Clique em **Cupons** → **Novo Cupom**', 'Defina código, tipo e valor do desconto', 'Configure regras (mínimo, validade, limite)', 'Clique em **Salvar**'] },
    ],
  },

  // === MARKETING ===
  {
    icon: ImageIcon,
    title: 'Banners',
    badge: 'Admin',
    category: 'Marketing',
    description: 'Gerencie banners da loja online com imagem ou vídeo.',
    features: ['Upload de imagem ou vídeo', 'Link de destino', 'Ordenação por drag & drop', 'Ativação/desativação'],
    tutorials: [
      { title: 'Como criar um banner', steps: ['Clique em **Banners** → **Novo Banner**', 'Faça upload da imagem/vídeo', 'Defina o link de destino', 'Clique em **Salvar**'] },
    ],
  },
  {
    icon: Star,
    title: 'Avaliações',
    badge: 'Admin',
    category: 'Marketing',
    description: 'Gerencie avaliações de clientes sobre produtos.',
    features: ['Moderação de avaliações', 'Aprovação/rejeição', 'Média de estrelas automática'],
    tutorials: [
      { title: 'Como moderar avaliações', steps: ['Clique em **Avaliações** no menu', 'Veja as avaliações pendentes', 'Aprove ou rejeite cada uma', 'As aprovadas aparecem na loja'] },
    ],
  },
  {
    icon: Handshake,
    title: 'Afiliados',
    badge: 'Admin',
    category: 'Marketing',
    description: 'Programa de afiliados com link de rastreamento e comissões.',
    features: ['Cadastro de afiliados', 'Link de referência único', 'Comissão por venda', 'Gestão de saques'],
    tutorials: [
      { title: 'Como cadastrar um afiliado', steps: ['Clique em **Afiliados** → **Novo Afiliado**', 'Preencha nome, e-mail e comissão', 'O link de afiliado será gerado automaticamente', 'Clique em **Salvar**'] },
    ],
  },
  {
    icon: Eye,
    title: 'Visual de Loja',
    badge: 'Admin',
    category: 'Marketing',
    description: 'Gerencie o visual merchandising da loja com montagens e destaques.',
    features: ['Upload de montagens visuais', 'Vinculação com produtos', 'Galeria de referências'],
    tutorials: [
      { title: 'Como usar o Visual de Loja', steps: ['Clique em **Visual de Loja** no menu', 'Faça upload de fotos de montagens', 'Vincule produtos aos looks', 'Organize a galeria'] },
    ],
  },

  // === LOGÍSTICA ===
  {
    icon: Truck,
    title: 'Frete',
    badge: 'Admin',
    category: 'Logística',
    description: 'Configure transportadoras e regras de frete para a loja online.',
    features: ['Integração Melhor Envio', 'Cotação automática', 'Frete grátis condicional', 'Múltiplas transportadoras'],
    tutorials: [
      { title: 'Como configurar o frete', steps: ['Clique em **Frete** no menu', 'Configure a integração com **Melhor Envio**', 'Defina regras de frete grátis', 'Teste com uma cotação'] },
    ],
  },

  // === RELATÓRIOS ===
  {
    icon: BarChart3,
    title: 'Relatórios',
    badge: 'Todos',
    category: 'Relatórios',
    description: 'Relatórios gerenciais com gráficos e exportação.',
    features: ['Relatório de vendas por período', 'Produtos mais vendidos', 'Desempenho por vendedor', 'Exportação CSV'],
    tutorials: [
      { title: 'Como gerar um relatório', steps: ['Clique em **Relatórios** no menu', 'Selecione o tipo de relatório', 'Defina o período', 'Visualize os dados e exporte se necessário'] },
    ],
  },
  {
    icon: Sparkles,
    title: 'Assistente IA',
    badge: 'Todos',
    category: 'Relatórios',
    description: 'Chat inteligente que analisa dados da loja e responde perguntas.',
    features: ['Perguntas em linguagem natural', 'Análise de vendas e estoque', 'Sugestões automáticas'],
    tutorials: [
      { title: 'Como usar o Assistente IA', steps: ['Clique em **Assistente IA** no menu', 'Digite sua pergunta (ex: "Quais produtos mais venderam?")', 'O assistente analisará os dados e responderá'] },
    ],
  },
  {
    icon: BrainCircuit,
    title: 'Analytics IA',
    badge: 'Admin',
    category: 'Relatórios',
    description: 'Análise avançada de comportamento de clientes com inteligência artificial.',
    features: ['Segmentação de clientes', 'Previsão de tendências', 'Insights automáticos'],
    tutorials: [
      { title: 'Como usar Analytics IA', steps: ['Clique em **Analytics IA** no menu', 'Selecione o tipo de análise', 'Visualize os insights gerados pela IA'] },
    ],
  },

  // === ADMINISTRAÇÃO ===
  {
    icon: Users,
    title: 'Usuários',
    badge: 'Admin',
    category: 'Administração',
    description: 'Gerencie usuários do sistema com cargos e permissões.',
    features: ['Criação de usuários', 'Cargos: admin, gerente, vendedor, estoquista', 'Permissões por menu', 'Vinculação à loja'],
    tutorials: [
      { title: 'Como criar um usuário', steps: ['Clique em **Usuários** → **Novo Usuário**', 'Preencha nome, e-mail e senha', 'Selecione o cargo e a loja', 'Configure as permissões de menu', 'Clique em **Criar**'] },
    ],
  },
  {
    icon: History,
    title: 'Histórico (Auditoria)',
    badge: 'Admin',
    category: 'Administração',
    description: 'Log de todas as ações realizadas no sistema.',
    features: ['Registro por usuário', 'Filtro por tipo de ação', 'Detalhes de cada alteração'],
    tutorials: [
      { title: 'Como consultar o histórico', steps: ['Clique em **Histórico** no menu', 'Use os filtros para refinar por usuário, ação ou período', 'Clique em uma entrada para ver os detalhes'] },
    ],
  },
  {
    icon: Zap,
    title: 'Olist',
    badge: 'Admin',
    category: 'Administração',
    description: 'Integração com a plataforma Olist para sincronização de produtos e pedidos.',
    features: ['Sincronização de produtos', 'Importação de pedidos', 'Mapeamento de SKU'],
    tutorials: [
      { title: 'Como configurar o Olist', steps: ['Clique em **Olist** no menu', 'Informe o token da API Olist', 'Clique em **Conectar**', 'Inicie a sincronização de produtos'] },
    ],
  },
  {
    icon: Upload,
    title: 'Importação de Dados',
    badge: 'Admin',
    category: 'Administração',
    description: 'Importação em massa de produtos, variações e dados legados.',
    features: ['Importação CSV com validação', 'Importação de dados legados', 'Relatório de erros', 'Importação via BI'],
    tutorials: [
      { title: 'Como importar produtos via CSV', steps: ['Clique em **Importar CSV**', 'Baixe o modelo de CSV', 'Preencha os dados e faça upload', 'Revise e confirme a importação'] },
    ],
  },
  {
    icon: KeyRound,
    title: 'API Keys',
    badge: 'Admin',
    category: 'Administração',
    description: 'Gerencie chaves de API para integrações externas.',
    features: ['Criação de chaves com escopo', 'Limite de requisições', 'Log de uso', 'Revogação'],
    tutorials: [
      { title: 'Como criar uma API Key', steps: ['Vá em **Configurações** → **API Keys**', 'Clique em **Nova Chave**', 'Defina nome e escopos de acesso', 'Copie a chave secreta (mostrada apenas uma vez)', 'Clique em **Salvar**'] },
    ],
  },
  {
    icon: FileCode2,
    title: 'Documentação API',
    badge: 'Admin',
    category: 'Administração',
    description: 'Documentação completa da API REST para integrações.',
    features: ['Endpoints documentados', 'Exemplos de requisição', 'Autenticação e escopos'],
    tutorials: [
      { title: 'Como acessar a documentação', steps: ['Vá em **Configurações** → **Documentação API**', 'Navegue pelos endpoints disponíveis', 'Copie os exemplos para sua integração'] },
    ],
  },
  {
    icon: Database,
    title: 'Exportar Banco',
    badge: 'Admin',
    category: 'Administração',
    description: 'Exporte dados do sistema em formato CSV para backup ou análise.',
    features: ['Exportação por tabela', 'Download em CSV', 'Backup de dados'],
    tutorials: [
      { title: 'Como exportar dados', steps: ['Vá em **Configurações** → **Exportar Banco**', 'Selecione as tabelas desejadas', 'Clique em **Exportar**', 'O download começará automaticamente'] },
    ],
  },

  // === CONFIGURAÇÕES ===
  {
    icon: Settings,
    title: 'Configurações',
    badge: 'Todos',
    category: 'Configurações',
    description: 'Configure todos os aspectos da loja: metas, integrações, notificações e mais.',
    features: ['Dados da loja', 'Metas de vendas', 'Templates WhatsApp', 'Push notifications', 'Roleta de prêmios', 'Produto destaque', 'Countdown', 'Feedback', 'Provador virtual IA', 'Alertas de estoque'],
    tutorials: [
      { title: 'Como configurar o WhatsApp', steps: ['Vá em **Configurações** → **Templates WhatsApp**', 'Edite os modelos de mensagem', 'Use variáveis como {{nome}}, {{pedido}}', 'Clique em **Salvar**'] },
      { title: 'Como configurar a Roleta de Prêmios', steps: ['Vá em **Configurações** → **Roleta de Prêmios**', 'Ative/desative com o toggle', 'Os cupons marcados "Mostrar na roleta" aparecerão', 'Clique em **Salvar**'] },
    ],
  },
];

// Group sections by category
const CATEGORIES = [...new Set(sections.map(s => s.category))];

const SECTION_KEYS = sections.map((s, i) => ({ key: `section-${i}`, title: s.title }));

// Horizontal scroll row component
const ScrollRow = ({ children, title, count }: { children: React.ReactNode; title: string; count?: number }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const amount = 340;
      scrollRef.current.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          {title}
          {count !== undefined && count > 0 && (
            <Badge variant="secondary" className="text-xs">{count}</Badge>
          )}
        </h2>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => scroll('left')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => scroll('right')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {children}
      </div>
    </div>
  );
};

const Manual = () => {
  const { isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  const [showVideoForm, setShowVideoForm] = useState(false);
  const [editingVideo, setEditingVideo] = useState<any>(null);
  const [videoForm, setVideoForm] = useState({ section_key: '', title: '', description: '', video_url: '' as string | undefined });
  const [selectedSection, setSelectedSection] = useState<number | null>(null);
  const [playingVideo, setPlayingVideo] = useState<any>(null);

  const { data: manualVideos = [] } = useQuery({
    queryKey: ['manual-videos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('manual_videos')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
        .order('created_at');
      if (error) throw error;
      return data;
    },
  });

  const saveVideoMutation = useMutation({
    mutationFn: async () => {
      if (editingVideo) {
        const { error } = await supabase.from('manual_videos').update({
          section_key: videoForm.section_key,
          title: videoForm.title.trim(),
          description: videoForm.description.trim() || null,
          video_url: videoForm.video_url!,
        } as any).eq('id', editingVideo.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('manual_videos').insert({
          section_key: videoForm.section_key,
          title: videoForm.title.trim(),
          description: videoForm.description.trim() || null,
          video_url: videoForm.video_url!,
          created_by: user!.id,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manual-videos'] });
      setShowVideoForm(false);
      setEditingVideo(null);
      setVideoForm({ section_key: '', title: '', description: '', video_url: undefined });
      toast.success(editingVideo ? 'Vídeo atualizado!' : 'Vídeo adicionado!');
    },
    onError: () => toast.error('Erro ao salvar vídeo'),
  });

  const deleteVideoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('manual_videos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manual-videos'] });
      toast.success('Vídeo removido!');
    },
  });

  const openEditVideo = (video: any) => {
    setEditingVideo(video);
    setVideoForm({
      section_key: video.section_key,
      title: video.title,
      description: video.description || '',
      video_url: video.video_url,
    });
    setShowVideoForm(true);
  };

  const getVideosForSection = (idx: number) => {
    const key = `section-${idx}`;
    return manualVideos.filter((v: any) => v.section_key === key);
  };

  const selectedSectionData = selectedSection !== null ? sections[selectedSection] : null;
  const selectedSectionVideos = selectedSection !== null ? getVideosForSection(selectedSection) : [];

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BookOpen className="h-6 w-6" />
              Central de Treinamento
            </h1>
            <p className="text-muted-foreground mt-1">
              Vídeos e tutoriais de todas as funcionalidades do sistema
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => { setEditingVideo(null); setVideoForm({ section_key: '', title: '', description: '', video_url: undefined }); setShowVideoForm(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Adicionar Vídeo
            </Button>
          )}
        </div>

        {/* Videos row (if any) */}
        {manualVideos.length > 0 && (
          <ScrollRow title="🎬 Vídeos de Treinamento" count={manualVideos.length}>
            {manualVideos.map((video: any) => (
              <Card
                key={video.id}
                className="flex-shrink-0 w-[300px] overflow-hidden cursor-pointer group hover:ring-2 hover:ring-primary/50 transition-all"
                onClick={() => setPlayingVideo(video)}
              >
                <div className="aspect-video bg-muted relative">
                  <video src={video.video_url} muted preload="metadata" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <PlayCircle className="h-12 w-12 text-white" />
                  </div>
                </div>
                <CardContent className="p-3">
                  <p className="font-medium text-sm truncate">{video.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {SECTION_KEYS.find(s => s.key === video.section_key)?.title || 'Geral'}
                  </p>
                  {isAdmin && (
                    <div className="flex gap-1 mt-2" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => openEditVideo(video)}>
                        <Pencil className="h-3 w-3 mr-1" /> Editar
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-destructive" onClick={() => {
                        if (confirm('Remover este vídeo?')) deleteVideoMutation.mutate(video.id);
                      }}>
                        <Trash2 className="h-3 w-3 mr-1" /> Remover
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </ScrollRow>
        )}

        {/* Category rows - Netflix style */}
        {CATEGORIES.map(cat => {
          const catSections = sections.map((s, i) => ({ ...s, idx: i })).filter(s => s.category === cat);
          return (
            <ScrollRow key={cat} title={cat} count={catSections.length}>
              {catSections.map(section => {
                const Icon = section.icon;
                const videoCount = getVideosForSection(section.idx).length;
                return (
                  <Card
                    key={section.idx}
                    className="flex-shrink-0 w-[260px] cursor-pointer group hover:ring-2 hover:ring-primary/50 hover:shadow-lg transition-all"
                    onClick={() => setSelectedSection(section.idx)}
                  >
                    <div className="h-32 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center relative">
                      <Icon className="h-12 w-12 text-primary/60 group-hover:scale-110 transition-transform" />
                      <div className="absolute top-2 right-2 flex gap-1">
                        <Badge
                          variant={section.badge === 'Admin' ? 'default' : section.badge === 'Gerente+' ? 'outline' : 'secondary'}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {section.badge}
                        </Badge>
                      </div>
                      {videoCount > 0 && (
                        <Badge variant="outline" className="absolute bottom-2 right-2 text-[10px] gap-1 bg-background/80">
                          <Video className="h-3 w-3" /> {videoCount}
                        </Badge>
                      )}
                    </div>
                    <CardContent className="p-3">
                      <p className="font-semibold text-sm">{section.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{section.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </ScrollRow>
          );
        })}

        {/* Section Detail Dialog */}
        <Dialog open={selectedSection !== null} onOpenChange={(open) => { if (!open) setSelectedSection(null); }}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            {selectedSectionData && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <selectedSectionData.icon className="h-5 w-5 text-primary" />
                    </div>
                    {selectedSectionData.title}
                    <Badge variant={selectedSectionData.badge === 'Admin' ? 'default' : 'secondary'}>
                      {selectedSectionData.badge}
                    </Badge>
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                  <p className="text-sm text-muted-foreground">{selectedSectionData.description}</p>

                  {/* Videos for this section */}
                  {selectedSectionVideos.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                        <PlayCircle className="h-4 w-4" /> Vídeos de Treinamento
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {selectedSectionVideos.map((video: any) => (
                          <Card key={video.id} className="overflow-hidden">
                            <div className="aspect-video bg-muted">
                              <video src={video.video_url} controls preload="metadata" className="w-full h-full object-contain" />
                            </div>
                            <CardContent className="p-3">
                              <p className="font-medium text-sm">{video.title}</p>
                              {video.description && <p className="text-xs text-muted-foreground mt-1">{video.description}</p>}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Features */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Funcionalidades</h4>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {selectedSectionData.features.map((feat, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-primary mt-1">•</span> {feat}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Tutorials */}
                  <div className="space-y-5">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Passo a Passo</h4>
                    {selectedSectionData.tutorials.map((tutorial, tIdx) => (
                      <div key={tIdx} className="space-y-2">
                        <h5 className="text-sm font-semibold flex items-center gap-2">
                          <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {tIdx + 1}
                          </span>
                          {tutorial.title}
                        </h5>
                        <ol className="space-y-1.5 pl-8">
                          {tutorial.steps.map((step, sIdx) => {
                            const parts = step.split(/\*\*(.*?)\*\*/g);
                            return (
                              <li key={sIdx} className="text-sm text-muted-foreground flex gap-2">
                                <span className="text-primary font-semibold min-w-[20px] text-right flex-shrink-0">{sIdx + 1}.</span>
                                <span>
                                  {parts.map((part, j) =>
                                    j % 2 === 1 ? <strong key={j} className="text-foreground font-medium">{part}</strong> : <span key={j}>{part}</span>
                                  )}
                                </span>
                              </li>
                            );
                          })}
                        </ol>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Video Player Dialog */}
        <Dialog open={!!playingVideo} onOpenChange={(open) => { if (!open) setPlayingVideo(null); }}>
          <DialogContent className="max-w-4xl p-0 overflow-hidden">
            {playingVideo && (
              <div>
                <div className="aspect-video bg-black">
                  <video
                    src={playingVideo.video_url}
                    controls
                    autoPlay
                    className="w-full h-full"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold">{playingVideo.title}</h3>
                  {playingVideo.description && <p className="text-sm text-muted-foreground mt-1">{playingVideo.description}</p>}
                  <p className="text-xs text-muted-foreground mt-2">
                    Módulo: {SECTION_KEYS.find(s => s.key === playingVideo.section_key)?.title || 'Geral'}
                  </p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Video Form Dialog */}
        <Dialog open={showVideoForm} onOpenChange={(open) => { if (!open) { setShowVideoForm(false); setEditingVideo(null); } }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingVideo ? 'Editar Vídeo' : 'Adicionar Vídeo de Treinamento'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Seção do Manual</Label>
                <Select value={videoForm.section_key} onValueChange={(v) => setVideoForm({ ...videoForm, section_key: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione a seção" /></SelectTrigger>
                  <SelectContent>
                    {SECTION_KEYS.map((s) => (
                      <SelectItem key={s.key} value={s.key}>{s.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Título do vídeo</Label>
                <Input value={videoForm.title} onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })} placeholder="Ex: Como cadastrar um produto" />
              </div>
              <div>
                <Label>Descrição (opcional)</Label>
                <Textarea value={videoForm.description} onChange={(e) => setVideoForm({ ...videoForm, description: e.target.value })} placeholder="Breve descrição do conteúdo" rows={2} />
              </div>
              <div>
                <Label>Vídeo</Label>
                <VideoUpload
                  value={videoForm.video_url}
                  onChange={(url) => setVideoForm({ ...videoForm, video_url: url })}
                  bucket="product-images"
                  folder="manual-videos"
                  maxSizeMB={100}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowVideoForm(false); setEditingVideo(null); }}>Cancelar</Button>
              <Button
                onClick={() => saveVideoMutation.mutate()}
                disabled={!videoForm.section_key || !videoForm.title.trim() || !videoForm.video_url || saveVideoMutation.isPending}
              >
                {saveVideoMutation.isPending ? 'Salvando...' : editingVideo ? 'Salvar' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default Manual;
