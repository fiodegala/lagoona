import AdminLayout from '@/components/AdminLayout';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
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
} from 'lucide-react';

const sections = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    badge: 'Todos',
    content: [
      '**Visão geral**: Ao acessar o painel admin, você verá o Dashboard com indicadores-chave: faturamento do mês, quantidade de pedidos, ticket médio, meta mensal e progresso.',
      '**Filtro por loja**: No topo, selecione a loja desejada para filtrar todos os dados exibidos. Gerentes veem apenas dados da sua loja.',
      '**Gráficos**: Acompanhe vendas por período, produtos mais vendidos, mapa de vendas por estado e métricas de WhatsApp.',
      '**Meta mensal**: Configure em Configurações > Metas de Vendas. O progresso é exibido automaticamente no Dashboard.',
    ],
  },
  {
    icon: Monitor,
    title: 'PDV (Ponto de Venda)',
    badge: 'Todos',
    content: [
      '**Abrir caixa**: Ao acessar o PDV, informe o saldo inicial do caixa para abrir uma sessão.',
      '**Buscar produtos**: Use a barra de busca por nome, SKU ou código de barras. Clique no produto para adicionar ao carrinho.',
      '**Variações**: Se o produto tem variações (cor, tamanho), um modal aparecerá para selecionar antes de adicionar.',
      '**Selecionar cliente**: Busque um cliente cadastrado ou registre um novo diretamente no PDV.',
      '**Tipo de venda**: Escolha entre Varejo, Atacado ou Exclusiva para aplicar o preço correto.',
      '**Vendedor**: Selecione o vendedor responsável pela venda.',
      '**Desconto**: Aplique desconto em porcentagem ou valor fixo sobre o total.',
      '**Cupom**: Informe o código do cupom para aplicar desconto adicional.',
      '**Pagamento**: Escolha entre Dinheiro, Cartão de Crédito, Cartão de Débito, PIX ou pagamento dividido.',
      '**Troca/Devolução**: Use o painel de trocas para processar devoluções e gerar crédito ao cliente.',
      '**Fechamento de caixa**: Acesse o menu do PDV > Gestão do Caixa para informar o saldo final e fechar a sessão.',
      '**Modo offline**: O PDV funciona mesmo sem internet. As vendas são sincronizadas automaticamente quando a conexão for restaurada.',
      '**Nota fiscal**: Após a venda, é possível solicitar emissão de NFC-e ou NF-e pelo modal de cupom fiscal.',
    ],
  },
  {
    icon: Package,
    title: 'Produtos',
    badge: 'Admin',
    content: [
      '**Listar produtos**: Visualize todos os produtos em uma tabela com imagem, nome, preço, estoque e status.',
      '**Criar produto**: Clique em "Novo Produto". Preencha nome, descrição, preço, preço promocional, preço atacado, preço exclusivo, categoria, SKU, código de barras e dimensões.',
      '**Imagens**: Faça upload de múltiplas imagens. A primeira é a imagem principal. Arraste para reordenar.',
      '**Vídeo**: Adicione um vídeo do produto (upload ou link).',
      '**Variações**: Crie atributos (ex: Cor, Tamanho) e depois gere as combinações. Cada variação pode ter preço, estoque, SKU e imagem próprios.',
      '**Visibilidade**: Controle se o produto aparece no catálogo online e/ou no PDV.',
      '**Editar**: Clique no ícone de edição na tabela para alterar qualquer informação.',
      '**Excluir**: Clique no ícone de lixeira. A exclusão é permanente.',
      '**Busca e filtros**: Use a barra de busca e os filtros por categoria e status para encontrar produtos.',
    ],
  },
  {
    icon: FolderTree,
    title: 'Categorias',
    badge: 'Admin',
    content: [
      '**Criar categoria**: Clique em "Nova Categoria". Defina nome, slug (URL amigável), descrição, imagem e ordem de exibição.',
      '**Subcategorias**: Selecione uma "Categoria Pai" para criar uma hierarquia de categorias.',
      '**Tabela de medidas**: Cada categoria pode ter uma tabela de medidas associada (ex: guia de tamanhos).',
      '**Ativar/Desativar**: Use o toggle para mostrar ou ocultar a categoria na loja.',
      '**Editar**: Clique na categoria para alterar seus dados.',
      '**Excluir**: Remova categorias que não são mais necessárias.',
    ],
  },
  {
    icon: Warehouse,
    title: 'Estoque',
    badge: 'Todos',
    content: [
      '**Visão geral**: Veja o estoque atual de todos os produtos e variações em uma tabela consolidada.',
      '**Alertas de estoque baixo**: Produtos abaixo do estoque mínimo são destacados em vermelho.',
      '**Transferência entre lojas**: Inicie uma transferência de estoque selecionando origem, destino, produto, variação e quantidade.',
      '**Transferências pendentes**: A loja de destino recebe uma notificação e deve aceitar ou recusar a transferência.',
      '**Ajuste manual**: Edite a quantidade de estoque diretamente na tabela.',
      '**Reserva de estoque**: Orçamentos pendentes reservam o estoque automaticamente (indicado pelo ícone 🔒).',
    ],
  },
  {
    icon: UserPlus,
    title: 'Clientes',
    badge: 'Todos',
    content: [
      '**Cadastrar cliente**: Clique em "Novo Cliente". Preencha nome, e-mail, telefone, CPF/CNPJ, endereço completo e data de nascimento.',
      '**Tipo de cliente**: Pessoa Física ou Pessoa Jurídica (com campos adicionais como Razão Social, Nome Fantasia, Inscrição Estadual).',
      '**Histórico de compras**: Clique no cliente para ver todas as compras realizadas.',
      '**Crédito do cliente**: Gerencie o saldo de crédito para trocas e devoluções.',
      '**Busca**: Pesquise por nome, e-mail, telefone ou documento.',
      '**Filtro por loja**: Filtre clientes vinculados a uma loja específica.',
      '**Fonte de referência**: Registre como o cliente conheceu a loja.',
    ],
  },
  {
    icon: ShoppingCart,
    title: 'Pedidos',
    badge: 'Todos',
    content: [
      '**Listar pedidos**: Veja todos os pedidos da loja online com status, cliente, valor e data.',
      '**Status do pedido**: Acompanhe o fluxo: Pendente → Confirmado → Enviado → Entregue (ou Cancelado).',
      '**Detalhes**: Clique no pedido para ver itens, endereço de entrega, método de pagamento e notas.',
      '**Rastreamento**: Adicione código de rastreio e transportadora. O cliente pode acompanhar pelo site.',
      '**Etiqueta de envio**: Gere etiquetas de envio diretamente pelo sistema.',
      '**Filtros**: Filtre por status, período, loja e método de pagamento.',
    ],
  },
  {
    icon: Receipt,
    title: 'Vendas (PDV)',
    badge: 'Todos',
    content: [
      '**Listar vendas**: Veja todas as vendas realizadas no PDV com data, cliente, valor, forma de pagamento e vendedor.',
      '**Detalhes da venda**: Clique para ver itens vendidos, descontos aplicados, cupom utilizado e observações.',
      '**Cancelar venda**: Vendas podem ser canceladas informando o motivo. O estoque é devolvido automaticamente.',
      '**Filtros**: Filtre por período, loja, vendedor, forma de pagamento e status.',
      '**Exportar**: Exporte o relatório de vendas em formato adequado para análise.',
    ],
  },
  {
    icon: ShoppingBasket,
    title: 'Carrinhos Abandonados',
    badge: 'Todos',
    content: [
      '**Monitorar**: Veja carrinhos que foram criados mas não finalizaram a compra.',
      '**Dados do cliente**: Quando disponível, veja nome, e-mail e telefone do cliente que abandonou.',
      '**Itens do carrinho**: Visualize quais produtos estavam no carrinho e o valor total.',
      '**Recuperação**: Envie notificações de recuperação com cupom de desconto via WhatsApp ou e-mail.',
      '**Status**: Acompanhe se o carrinho foi recuperado (compra finalizada) ou permanece abandonado.',
    ],
  },
  {
    icon: FileText,
    title: 'Orçamentos',
    badge: 'Todos',
    content: [
      '**Criar orçamento**: Monte um orçamento com produtos, quantidades e preços personalizados para o cliente.',
      '**Reserva de estoque**: Ao criar um orçamento com status "Pendente", o estoque dos itens é reservado automaticamente (indicado pelo ícone 🔒 Reservado).',
      '**Link de visualização**: Cada orçamento gera um link público que pode ser enviado ao cliente.',
      '**Status**: Pendente → Aprovado → Convertido em Pedido (ou Expirado/Cancelado).',
      '**Validade**: Defina a data de expiração do orçamento. Orçamentos expirados liberam o estoque reservado.',
      '**Converter em pedido**: Orçamentos aprovados podem ser convertidos diretamente em pedidos.',
    ],
  },
  {
    icon: Star,
    title: 'Avaliações',
    badge: 'Admin',
    content: [
      '**Moderar avaliações**: Aprove ou rejeite avaliações de produtos feitas pelos clientes.',
      '**Avaliações verificadas**: Avaliações de compradores verificados são destacadas.',
      '**Responder**: Responda às avaliações diretamente pelo painel.',
      '**Filtros**: Filtre por nota (1-5 estrelas), status de aprovação e produto.',
    ],
  },
  {
    icon: Tag,
    title: 'Cupons',
    badge: 'Admin',
    content: [
      '**Criar cupom**: Defina código, tipo de desconto (percentual ou valor fixo), valor, validade, limite de uso e valor mínimo do pedido.',
      '**Restrições**: Limite o cupom a produtos ou categorias específicas.',
      '**Cupom progressivo**: Crie faixas de desconto que aumentam com o valor do pedido.',
      '**Roleta de prêmios**: Marque cupons para aparecerem na roleta da loja online.',
      '**Uso por cliente**: Limite quantas vezes cada cliente pode usar o mesmo cupom.',
      '**Relatório de uso**: Acompanhe quantas vezes o cupom foi utilizado e o total de desconto concedido.',
    ],
  },
  {
    icon: Package,
    title: 'Combos',
    badge: 'Admin',
    content: [
      '**Criar combo**: Monte kits de produtos com preço especial.',
      '**Itens do combo**: Adicione produtos e variações específicas ao combo.',
      '**Frete grátis**: Marque combos com frete grátis como benefício adicional.',
      '**Imagem**: Adicione uma imagem personalizada para o combo.',
      '**Ativar/Desativar**: Controle a visibilidade do combo na loja.',
    ],
  },
  {
    icon: Target,
    title: 'Compre Junto (Upsells)',
    badge: 'Admin',
    content: [
      '**Configurar sugestões**: Para cada produto, defina quais outros produtos aparecem como sugestão "Compre junto".',
      '**Desconto**: Defina um percentual de desconto quando o cliente compra os itens juntos.',
      '**Ordem**: Arraste para definir a ordem de exibição das sugestões.',
      '**Ativar/Desativar**: Controle individualmente cada sugestão.',
    ],
  },
  {
    icon: Truck,
    title: 'Frete',
    badge: 'Admin',
    content: [
      '**Configuração**: Configure a integração com o Melhor Envio para cálculo automático de frete.',
      '**CEP de origem**: Defina o CEP de origem para cálculo correto das entregas.',
      '**Dimensões padrão**: Configure peso e dimensões padrão para produtos sem essas informações.',
      '**Cotação admin**: Faça cotações de frete diretamente pelo painel para qualquer CEP de destino.',
    ],
  },
  {
    icon: ImageIcon,
    title: 'Banners',
    badge: 'Admin',
    content: [
      '**Tipos de banner**: Hero (banner principal da home), Promocional e Institucional.',
      '**Criar banner**: Faça upload da imagem, defina título, subtítulo e link de destino.',
      '**Vídeo**: Banners podem ter vídeo ao invés de imagem estática.',
      '**Ordenação**: Arraste os banners para definir a ordem de exibição no carrossel.',
      '**Ativar/Desativar**: Controle quais banners estão visíveis na loja.',
    ],
  },
  {
    icon: BarChart3,
    title: 'Relatórios',
    badge: 'Todos',
    content: [
      '**Relatório de vendas**: Analise vendas por período, produto, categoria, vendedor e forma de pagamento.',
      '**Relatório de estoque**: Veja posição atual do estoque, movimentações e produtos abaixo do mínimo.',
      '**Relatório de clientes**: Analise base de clientes, frequência de compra e ticket médio.',
      '**Filtros avançados**: Combine múltiplos filtros para análises detalhadas.',
      '**Gráficos interativos**: Visualize dados em gráficos de barras, linhas e pizza.',
    ],
  },
  {
    icon: Sparkles,
    title: 'Assistente IA',
    badge: 'Gerente+',
    content: [
      '**Chat inteligente**: Converse com a IA sobre seus dados de vendas, estoque e clientes.',
      '**Perguntas naturais**: Faça perguntas como "Qual foi o produto mais vendido este mês?" ou "Quais clientes não compram há 30 dias?".',
      '**Sugestões**: A IA sugere ações baseadas nos dados analisados.',
      '**Contexto do negócio**: O assistente conhece seu catálogo, vendas e métricas para respostas precisas.',
    ],
  },
  {
    icon: BrainCircuit,
    title: 'Analytics IA',
    badge: 'Admin',
    content: [
      '**Análise comportamental**: A IA analisa padrões de comportamento dos visitantes da loja.',
      '**Insights automáticos**: Receba insights sobre tendências de vendas, sazonalidade e oportunidades.',
      '**Previsões**: Veja previsões de demanda baseadas no histórico de vendas.',
    ],
  },
  {
    icon: Users,
    title: 'Usuários',
    badge: 'Admin',
    content: [
      '**Criar usuário**: Cadastre novos operadores, vendedores e gerentes do sistema.',
      '**Roles**: Defina o papel do usuário: Admin, Gerente ou Vendedor.',
      '**Loja vinculada**: Associe o usuário a uma loja específica.',
      '**Menus permitidos**: Controle quais menus do painel cada usuário pode acessar.',
      '**Ativar/Desativar**: Desative usuários sem excluí-los do sistema.',
      '**Permissões por role**:',
      '  - **Admin**: Acesso total a todas as funcionalidades.',
      '  - **Gerente**: Acesso a PDV, vendas, estoque, clientes, pedidos, orçamentos, relatórios e assistente.',
      '  - **Vendedor**: Acesso limitado ao PDV e funcionalidades de venda.',
    ],
  },
  {
    icon: History,
    title: 'Histórico (Auditoria)',
    badge: 'Admin',
    content: [
      '**Log de ações**: Veja todas as ações realizadas no sistema por todos os usuários.',
      '**Detalhes**: Cada registro mostra quem fez, o que fez, quando e os detalhes da alteração.',
      '**Filtros**: Filtre por usuário, tipo de ação, entidade e período.',
      '**Rastreabilidade**: Use para auditar alterações em produtos, preços, estoque e configurações.',
    ],
  },
  {
    icon: Handshake,
    title: 'Afiliados',
    badge: 'Admin',
    content: [
      '**Cadastrar afiliado**: Registre novos afiliados com nome, e-mail, telefone e dados bancários.',
      '**Código de referência**: Cada afiliado recebe um código único para compartilhar.',
      '**Comissão**: Defina o percentual de comissão por afiliado.',
      '**Acompanhamento**: Veja cliques, vendas, comissões pendentes e saldo disponível de cada afiliado.',
      '**Saques**: Gerencie solicitações de saque dos afiliados.',
      '**Painel do afiliado**: Cada afiliado tem acesso a um painel público para acompanhar seus resultados.',
    ],
  },
  {
    icon: Upload,
    title: 'Importação de Dados',
    badge: 'Admin',
    content: [
      '**Importar CSV de produtos**: Faça upload de um arquivo CSV com seus produtos para cadastro em massa.',
      '**Importar legado**: Importe dados de sistemas anteriores usando o formato de migração.',
      '**Importar dados (BI)**: Importe planilhas de vendas e dados para análise de Business Intelligence.',
      '**Estrutura do CSV**: Consulte a documentação do formato esperado para cada tipo de importação.',
      '**Validação**: O sistema valida os dados antes de importar e exibe erros encontrados.',
      '**Histórico**: Veja o histórico de importações realizadas com status e eventuais erros.',
    ],
  },
  {
    icon: Settings,
    title: 'Configurações',
    badge: 'Todos',
    content: [
      '**Dados da loja**: Configure nome, CNPJ, endereço e informações de contato.',
      '**Metas de vendas**: Defina a meta mensal de faturamento exibida no Dashboard.',
      '**WhatsApp**: Configure templates de mensagens para atendimento e recuperação de carrinhos.',
      '**Push notifications**: Ative notificações push para alertar sobre novos pedidos e estoque baixo.',
      '**Roleta de prêmios**: Configure a roleta de cupons exibida na loja online.',
      '**Produto destaque**: Defina qual produto aparece em destaque na home da loja.',
      '**Countdown de ofertas**: Configure o cronômetro de ofertas da home.',
      '**Feedback de clientes**: Gerencie os prints de feedbacks exibidos na loja.',
      '**Vídeo-depoimentos**: Configure vídeos de depoimentos de clientes.',
      '**Provador virtual (IA)**: Ative/desative o recurso de experimentar roupas com IA.',
      '**Instagram**: Conecte sua conta do Instagram para exibir posts na loja.',
      '**Alertas de estoque**: Configure os limites para alertas de estoque baixo.',
      '**Cupom de recuperação**: Configure cupons automáticos para recuperação de carrinhos abandonados.',
      '**Vídeo atacado**: Configure o vídeo institucional da página de atacado.',
    ],
  },
];

const Manual = () => {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Manual do Sistema
          </h1>
          <p className="text-muted-foreground mt-1">
            Guia completo de todas as funcionalidades do painel administrativo
          </p>
        </div>

        {/* Quick legend */}
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-muted-foreground">Legenda de acesso:</span>
          <Badge variant="secondary">Todos</Badge>
          <Badge variant="default">Admin</Badge>
          <Badge variant="outline">Gerente+</Badge>
        </div>

        <Accordion type="multiple" className="space-y-2">
          {sections.map((section, idx) => {
            const Icon = section.icon;
            return (
              <AccordionItem
                key={idx}
                value={`section-${idx}`}
                className="border rounded-lg px-2"
              >
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <span className="font-semibold text-left">{section.title}</span>
                    <Badge
                      variant={
                        section.badge === 'Admin'
                          ? 'default'
                          : section.badge === 'Gerente+'
                          ? 'outline'
                          : 'secondary'
                      }
                      className="ml-2"
                    >
                      {section.badge}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <ul className="space-y-2 pl-12">
                    {section.content.map((line, i) => {
                      const parts = line.split(/\*\*(.*?)\*\*/g);
                      return (
                        <li key={i} className="text-sm text-muted-foreground leading-relaxed">
                          {parts.map((part, j) =>
                            j % 2 === 1 ? (
                              <strong key={j} className="text-foreground font-medium">
                                {part}
                              </strong>
                            ) : (
                              <span key={j}>{part}</span>
                            )
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dúvidas frequentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">Como alterar minha senha?</strong> — Solicite ao administrador para redefinir sua senha através da tela de Usuários.
            </p>
            <p>
              <strong className="text-foreground">Não consigo acessar um menu.</strong> — Seu acesso é controlado pelo administrador. Verifique com ele se seu perfil tem permissão para acessar a funcionalidade desejada.
            </p>
            <p>
              <strong className="text-foreground">O sistema está lento.</strong> — Verifique sua conexão com a internet. Se o problema persistir, tente limpar o cache do navegador (Ctrl+Shift+R).
            </p>
            <p>
              <strong className="text-foreground">Como funciona o modo offline do PDV?</strong> — Quando o sistema detecta que você está sem internet, as vendas são salvas localmente e sincronizadas automaticamente quando a conexão for restaurada.
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default Manual;
