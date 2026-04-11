import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import VideoUpload from '@/components/VideoUpload';
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

interface StepByStep {
  title: string;
  steps: string[];
}

interface ManualSection {
  icon: typeof LayoutDashboard;
  title: string;
  badge: string;
  description: string;
  features: string[];
  tutorials: StepByStep[];
}

const sections: ManualSection[] = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    badge: 'Todos',
    description: 'Painel principal com visão geral do desempenho da loja. Exibe indicadores de faturamento, pedidos, ticket médio e progresso da meta mensal.',
    features: [
      'Cards com métricas em tempo real (faturamento, pedidos, ticket médio)',
      'Gráfico de vendas por período',
      'Mapa de vendas por estado do Brasil',
      'Métricas de WhatsApp',
      'Progresso da meta mensal',
      'Filtro por loja (gerentes veem apenas sua loja)',
    ],
    tutorials: [
      {
        title: 'Como visualizar o Dashboard',
        steps: [
          'No menu lateral, clique em **Dashboard** (é a primeira opção)',
          'Os cards no topo mostram: Faturamento do Mês, Qtd. de Pedidos, Ticket Médio e Meta Mensal',
          'Role a página para ver os gráficos de vendas, mapa por estado e métricas de WhatsApp',
          'Para mudar o período, use os filtros de data disponíveis nos gráficos',
        ],
      },
      {
        title: 'Como filtrar por loja',
        steps: [
          'No topo do Dashboard, localize o seletor de loja (dropdown)',
          'Clique no dropdown e selecione a loja desejada',
          'Todos os dados (cards, gráficos e métricas) serão atualizados automaticamente para a loja selecionada',
          '**Nota**: Gerentes só visualizam dados da loja à qual estão vinculados',
        ],
      },
      {
        title: 'Como configurar a Meta Mensal',
        steps: [
          'Vá ao menu lateral → **Configurações**',
          'Na aba **Metas de Vendas**, defina o valor da meta mensal',
          'Clique em **Salvar**',
          'Retorne ao Dashboard — a barra de progresso será exibida automaticamente com o percentual atingido',
        ],
      },
    ],
  },
  {
    icon: Monitor,
    title: 'PDV (Ponto de Venda)',
    badge: 'Todos',
    description: 'Sistema de ponto de venda completo com suporte offline. Permite realizar vendas presenciais com controle de caixa, múltiplas formas de pagamento e emissão fiscal.',
    features: [
      'Abertura e fechamento de caixa com saldo',
      'Busca por nome, SKU ou código de barras',
      'Seleção de variações (cor, tamanho)',
      'Cadastro rápido de cliente',
      'Tipos de venda: Varejo, Atacado, Exclusiva',
      'Desconto por % ou valor fixo',
      'Cupom de desconto',
      'Pagamento dividido (múltiplas formas)',
      'Troca e devolução com crédito',
      'Modo offline com sincronização automática',
      'Emissão de NFC-e / NF-e',
    ],
    tutorials: [
      {
        title: 'Como abrir o caixa',
        steps: [
          'No menu lateral, clique em **PDV**',
          'Na tela de abertura, informe o **saldo inicial** do caixa (quanto tem em dinheiro)',
          'Clique em **Abrir Caixa**',
          'O PDV será carregado e estará pronto para registrar vendas',
          '**Dica**: O número da sessão aparece no canto superior da tela',
        ],
      },
      {
        title: 'Como realizar uma venda completa',
        steps: [
          'Na tela do PDV, use a **barra de busca** no topo para procurar o produto (por nome, SKU ou código de barras)',
          'Clique no produto desejado na grade de resultados',
          'Se o produto tiver variações, selecione **Cor** e **Tamanho** no modal que aparece e confirme',
          'O produto será adicionado ao carrinho (painel lateral direito)',
          'Para alterar a quantidade, use os botões **+** e **-** ao lado do item no carrinho',
          'Repita os passos 1-5 para adicionar mais produtos',
          'Na aba **Cliente**, busque um cliente existente ou clique em **Novo Cliente** para cadastrar',
          'Na aba **Tipo de Venda**, selecione: Varejo, Atacado ou Exclusiva',
          'Na aba **Vendedor**, selecione o vendedor responsável',
          'Se desejar aplicar desconto, informe o **tipo** (% ou R$) e o **valor** no campo de desconto',
          'Se tiver cupom, digite o código no campo **Cupom** e clique em aplicar',
          'Na aba **Pagamento**, selecione a forma de pagamento',
          'Para pagamento em dinheiro, informe o valor recebido — o troco será calculado automaticamente',
          'Clique em **Finalizar Venda**',
          'A venda será registrada e o estoque atualizado automaticamente',
        ],
      },
      {
        title: 'Como fazer pagamento dividido',
        steps: [
          'Na aba de **Pagamento**, clique em **Dividir Pagamento**',
          'Selecione a primeira forma de pagamento (ex: Dinheiro) e informe o valor parcial',
          'Clique em **Adicionar outra forma**',
          'Selecione a segunda forma (ex: PIX) e informe o valor restante',
          'Confirme que a soma dos valores bate com o total da venda',
          'Clique em **Finalizar Venda**',
        ],
      },
      {
        title: 'Como processar uma troca/devolução',
        steps: [
          'No PDV, acesse o painel de **Trocas** (botão no topo ou menu)',
          'Busque a venda original pelo número ou dados do cliente',
          'Selecione os itens que serão devolvidos e informe a quantidade',
          'O sistema calculará o valor do crédito automaticamente',
          'Se for troca, adicione os novos produtos ao carrinho',
          'A diferença de valor será calculada (cliente paga mais ou recebe crédito)',
          'Finalize a operação',
        ],
      },
      {
        title: 'Como fechar o caixa',
        steps: [
          'No PDV, clique no botão **Menu** (ícone ☰) no canto superior direito',
          'Selecione **Gestão do Caixa**',
          'Informe o **saldo final** (quanto dinheiro tem fisicamente no caixa)',
          'O sistema comparará com o saldo esperado e mostrará a diferença (sobra ou falta)',
          'Adicione observações se necessário',
          'Clique em **Fechar Caixa**',
          'Um resumo da sessão será exibido',
        ],
      },
      {
        title: 'O que acontece no modo offline',
        steps: [
          'Se a internet cair, um banner vermelho aparecerá no topo: **"Modo offline"**',
          'Continue realizando vendas normalmente — elas são salvas no dispositivo',
          'Quando a internet retornar, o indicador muda para **"Online"** (verde)',
          'Clique em **Sincronizar** (ícone de setas) para enviar as vendas pendentes',
          'O número de vendas pendentes aparece ao lado do botão de sync',
          '**Importante**: Não limpe os dados do navegador enquanto houver vendas pendentes!',
        ],
      },
    ],
  },
  {
    icon: Package,
    title: 'Produtos',
    badge: 'Admin',
    description: 'Cadastro e gerenciamento completo do catálogo de produtos, com suporte a variações, múltiplas imagens, vídeo e controle de visibilidade.',
    features: [
      'Tabela com imagem, nome, preço, estoque e status',
      'Múltiplas imagens com reordenação por drag & drop',
      'Upload de vídeo do produto',
      'Variações com atributos (cor, tamanho, etc.)',
      'Preços diferenciados: varejo, promocional, atacado, exclusivo',
      'Controle de visibilidade (catálogo online e PDV)',
      'SKU e código de barras',
      'Dimensões e peso para cálculo de frete',
    ],
    tutorials: [
      {
        title: 'Como cadastrar um novo produto',
        steps: [
          'No menu lateral, clique em **Produtos**',
          'Clique no botão **Novo Produto** (canto superior direito)',
          'Preencha o **Nome** do produto',
          'Adicione a **Descrição** detalhada (aparecerá na loja online)',
          'Informe o **Preço** de varejo',
          'Opcionalmente, preencha: Preço Promocional, Preço Atacado, Preço Exclusivo',
          'Selecione a **Categoria** no dropdown',
          'Preencha **SKU** e **Código de Barras** (opcionais, úteis para busca no PDV)',
          'Informe o **Estoque** inicial e o **Estoque Mínimo** (para alertas)',
          'Preencha **Peso** e **Dimensões** (necessários para cálculo de frete)',
          'Na seção de **Imagens**, clique em "Adicionar imagem" e faça upload das fotos',
          'A primeira imagem será a principal — arraste para reordenar',
          'Na seção de **Vídeo**, adicione um vídeo do produto se desejar',
          'Marque as opções de visibilidade: **Catálogo Online** e/ou **PDV**',
          'Clique em **Salvar**',
        ],
      },
      {
        title: 'Como criar variações de um produto',
        steps: [
          'Edite o produto clicando no ícone de **edição** (✏️) na tabela de produtos',
          'Role até a seção **Variações**',
          'Clique em **Adicionar Atributo** (ex: "Cor")',
          'Adicione os valores do atributo (ex: Preto, Branco, Azul)',
          'Repita para outros atributos (ex: "Tamanho" → P, M, G, GG)',
          'Clique em **Gerar Combinações** — o sistema criará todas as variações possíveis',
          'Para cada variação, você pode definir: preço específico, estoque individual, SKU e imagem',
          'Use o toggle para ativar/desativar variações individuais',
          'Clique em **Salvar** para confirmar',
        ],
      },
      {
        title: 'Como editar um produto existente',
        steps: [
          'Na tabela de produtos, localize o produto desejado (use a busca ou filtros)',
          'Clique no ícone de **edição** (✏️) na linha do produto',
          'O modal de edição abrirá com todos os campos preenchidos',
          'Altere os campos desejados',
          'Clique em **Salvar** para confirmar as alterações',
        ],
      },
      {
        title: 'Como excluir um produto',
        steps: [
          'Na tabela de produtos, localize o produto',
          'Clique no ícone de **lixeira** (🗑️) na linha do produto',
          'Confirme a exclusão no diálogo de confirmação',
          '**Atenção**: A exclusão é permanente e não pode ser desfeita!',
        ],
      },
    ],
  },
  {
    icon: FolderTree,
    title: 'Categorias',
    badge: 'Admin',
    description: 'Organize seus produtos em categorias e subcategorias. Cada categoria pode ter imagem, descrição e tabela de medidas.',
    features: [
      'Hierarquia com categorias pai e subcategorias',
      'Imagem da categoria',
      'Slug (URL amigável) automático',
      'Tabela de medidas vinculada',
      'Ordenação personalizada',
      'Ativação/desativação',
    ],
    tutorials: [
      {
        title: 'Como criar uma categoria',
        steps: [
          'No menu lateral, clique em **Categorias**',
          'Clique no botão **Nova Categoria**',
          'Preencha o **Nome** (ex: "Camisetas")',
          'O **Slug** será gerado automaticamente (ex: "camisetas"), mas pode ser editado',
          'Adicione uma **Descrição** (opcional)',
          'Faça upload de uma **Imagem** representativa',
          'Defina a **Ordem de exibição** (número menor = aparece primeiro)',
          'Para criar uma subcategoria, selecione a **Categoria Pai** no dropdown',
          'Clique em **Salvar**',
        ],
      },
      {
        title: 'Como configurar a tabela de medidas',
        steps: [
          'Edite a categoria clicando sobre ela na listagem',
          'Na seção **Tabela de Medidas**, clique em **Editar Tabela**',
          'Defina as **colunas** (ex: Tamanho, Busto, Cintura, Quadril)',
          'Adicione as **linhas** com os valores de cada tamanho',
          'Clique em **Salvar**',
          'A tabela será exibida automaticamente na página de produtos dessa categoria (como "Guia de Tamanhos")',
        ],
      },
    ],
  },
  {
    icon: Warehouse,
    title: 'Estoque',
    badge: 'Todos',
    description: 'Controle completo de estoque com alertas de estoque baixo, transferências entre lojas e reserva automática para orçamentos.',
    features: [
      'Tabela consolidada de estoque (produtos e variações)',
      'Alertas visuais de estoque baixo (vermelho)',
      'Transferência entre lojas com aprovação',
      'Ajuste manual de quantidade',
      'Reserva automática para orçamentos pendentes',
    ],
    tutorials: [
      {
        title: 'Como verificar o estoque',
        steps: [
          'No menu lateral, clique em **Estoque**',
          'A tabela mostra todos os produtos com: nome, variação, quantidade atual e estoque mínimo',
          'Produtos com estoque abaixo do mínimo aparecem com destaque em **vermelho**',
          'Use a barra de busca para localizar um produto específico',
          'Produtos com reserva de orçamento exibem o ícone **🔒 Reservado**',
        ],
      },
      {
        title: 'Como transferir estoque entre lojas',
        steps: [
          'Na página de Estoque, clique em **Transferir Estoque**',
          'Selecione a **Loja de Origem** (de onde o estoque sairá)',
          'Selecione a **Loja de Destino** (para onde o estoque irá)',
          'Selecione o **Produto** e a **Variação** (se houver)',
          'Informe a **Quantidade** a ser transferida',
          'Clique em **Enviar Transferência**',
          'A loja de destino receberá uma **notificação** para aceitar ou recusar',
          'O estoque só será movido após a aceitação da loja de destino',
        ],
      },
      {
        title: 'Como aceitar uma transferência pendente',
        steps: [
          'Ao acessar o painel, se houver transferências pendentes, um **modal** será exibido automaticamente',
          'Revise os detalhes: produto, quantidade, loja de origem',
          'Clique em **Aceitar** para confirmar o recebimento',
          'Ou clique em **Recusar** se não deseja receber o estoque',
          'O estoque será atualizado automaticamente após a aceitação',
        ],
      },
    ],
  },
  {
    icon: UserPlus,
    title: 'Clientes',
    badge: 'Todos',
    description: 'Cadastro completo de clientes pessoa física e jurídica, com histórico de compras, crédito e segmentação por loja.',
    features: [
      'Cadastro PF e PJ com campos específicos',
      'Histórico completo de compras',
      'Saldo de crédito (trocas/devoluções)',
      'Busca por nome, e-mail, telefone ou CPF/CNPJ',
      'Filtro por loja',
      'Fonte de referência (como conheceu a loja)',
    ],
    tutorials: [
      {
        title: 'Como cadastrar um novo cliente',
        steps: [
          'No menu lateral, clique em **Clientes**',
          'Clique no botão **Novo Cliente**',
          'Selecione o tipo: **Pessoa Física** ou **Pessoa Jurídica**',
          'Preencha o **Nome** completo',
          'Informe **E-mail** e **Telefone**',
          'Preencha o **CPF** (PF) ou **CNPJ** (PJ)',
          'Para PJ, preencha também: Razão Social, Nome Fantasia, Inscrição Estadual/Municipal e Responsável',
          'Preencha o **Endereço** completo (CEP, rua, número, bairro, cidade, estado)',
          'Informe a **Data de Nascimento** (opcional)',
          'Selecione a **Fonte de Referência** (como o cliente conheceu a loja)',
          'Clique em **Salvar**',
        ],
      },
      {
        title: 'Como ver o histórico de compras',
        steps: [
          'Na listagem de clientes, localize o cliente desejado',
          'Clique sobre o nome do cliente ou no ícone de detalhes',
          'O painel lateral mostrará todas as compras realizadas com datas, valores e status',
        ],
      },
    ],
  },
  {
    icon: ShoppingCart,
    title: 'Pedidos',
    badge: 'Todos',
    description: 'Gerenciamento de pedidos da loja online com acompanhamento de status, rastreamento de envio e geração de etiquetas.',
    features: [
      'Listagem com status, cliente, valor e data',
      'Fluxo de status: Pendente → Confirmado → Enviado → Entregue',
      'Detalhes do pedido (itens, endereço, pagamento)',
      'Código de rastreio e transportadora',
      'Geração de etiqueta de envio',
      'Filtros por status, período e loja',
    ],
    tutorials: [
      {
        title: 'Como gerenciar um pedido',
        steps: [
          'No menu lateral, clique em **Pedidos**',
          'A tabela lista todos os pedidos com status atual, nome do cliente, valor e data',
          'Clique no pedido para abrir os **detalhes**',
          'Visualize: itens do pedido, endereço de entrega, método de pagamento e notas',
        ],
      },
      {
        title: 'Como atualizar o status do pedido',
        steps: [
          'Abra os detalhes do pedido clicando sobre ele',
          'Localize o campo **Status** no painel de detalhes',
          'Selecione o novo status no dropdown: Confirmado, Enviado, Entregue ou Cancelado',
          'O sistema salvará a alteração automaticamente',
          'O cliente será notificado da mudança (se configurado)',
        ],
      },
      {
        title: 'Como adicionar rastreamento',
        steps: [
          'Abra os detalhes do pedido',
          'Localize os campos **Código de Rastreio** e **Transportadora**',
          'Preencha o código de rastreamento fornecido pela transportadora',
          'Selecione ou digite o nome da transportadora',
          'Salve as alterações',
          'O cliente poderá rastrear o pedido pelo site na página "Rastrear Pedido"',
        ],
      },
      {
        title: 'Como gerar etiqueta de envio',
        steps: [
          'Abra os detalhes do pedido',
          'Clique no botão **Gerar Etiqueta**',
          'O sistema usará os dados de endereço do pedido para gerar a etiqueta',
          'A etiqueta será exibida em formato PDF para impressão',
          'Imprima e cole no pacote de envio',
        ],
      },
    ],
  },
  {
    icon: Receipt,
    title: 'Vendas (PDV)',
    badge: 'Todos',
    description: 'Histórico de todas as vendas realizadas pelo PDV, com detalhes, filtros avançados e possibilidade de cancelamento.',
    features: [
      'Listagem com data, cliente, valor, forma de pagamento e vendedor',
      'Detalhes completos: itens, descontos, cupom, observações',
      'Cancelamento com devolução automática de estoque',
      'Filtros por período, loja, vendedor e pagamento',
    ],
    tutorials: [
      {
        title: 'Como visualizar vendas',
        steps: [
          'No menu lateral, clique em **Vendas**',
          'Use os filtros no topo para refinar: **Período**, **Loja**, **Vendedor**, **Forma de Pagamento**',
          'Clique em uma venda para ver todos os detalhes',
        ],
      },
      {
        title: 'Como cancelar uma venda',
        steps: [
          'Na listagem de vendas, localize a venda desejada',
          'Clique para abrir os detalhes',
          'Clique no botão **Cancelar Venda**',
          'Informe o **Motivo do cancelamento** no campo que aparece',
          'Confirme o cancelamento',
          'O estoque dos itens será **devolvido automaticamente**',
          '**Nota**: Vendas canceladas ficam registradas no histórico com status "Cancelada"',
        ],
      },
    ],
  },
  {
    icon: ShoppingBasket,
    title: 'Carrinhos Abandonados',
    badge: 'Todos',
    description: 'Monitore carrinhos da loja online que não foram finalizados e recupere vendas com notificações e cupons.',
    features: [
      'Listagem de carrinhos não finalizados',
      'Dados do cliente (quando disponíveis)',
      'Itens e valor total do carrinho',
      'Envio de recuperação via WhatsApp ou e-mail',
      'Cupom de desconto automático para recuperação',
      'Status: Abandonado / Recuperado',
    ],
    tutorials: [
      {
        title: 'Como recuperar um carrinho abandonado',
        steps: [
          'No menu lateral, clique em **Carrinhos Abandonados**',
          'Veja a lista de carrinhos com: nome/e-mail do cliente, itens, valor e tempo desde o abandono',
          'Clique em um carrinho para ver os detalhes dos produtos',
          'Clique em **Enviar Recuperação** para notificar o cliente',
          'O sistema enviará uma mensagem via WhatsApp ou e-mail (conforme configurado)',
          'Se configurado, um **cupom de desconto** será incluído automaticamente na mensagem',
          'Acompanhe o status: se o cliente completar a compra, o carrinho mudará para **"Recuperado"**',
        ],
      },
    ],
  },
  {
    icon: FileText,
    title: 'Orçamentos',
    badge: 'Todos',
    description: 'Crie orçamentos personalizados com reserva automática de estoque e envie um link público ao cliente.',
    features: [
      'Criação com produtos, quantidades e preços personalizados',
      'Reserva automática de estoque (🔒)',
      'Link público para o cliente visualizar',
      'Fluxo: Pendente → Aprovado → Convertido em Pedido',
      'Data de validade com expiração automática',
    ],
    tutorials: [
      {
        title: 'Como criar um orçamento',
        steps: [
          'No menu lateral, clique em **Orçamentos**',
          'Clique no botão **Novo Orçamento**',
          'Informe os dados do **cliente** (nome, e-mail, telefone)',
          'Adicione os **produtos** ao orçamento: busque pelo nome e selecione',
          'Para cada produto, defina a **quantidade** e o **preço** (pode ser personalizado)',
          'Defina a **data de validade** do orçamento',
          'Adicione **observações** se necessário',
          'Clique em **Salvar**',
          'O estoque dos itens será **reservado automaticamente** (aparecerá 🔒 Reservado)',
          'Um **link público** será gerado — copie e envie ao cliente via WhatsApp ou e-mail',
        ],
      },
      {
        title: 'Como converter orçamento em pedido',
        steps: [
          'Na listagem de orçamentos, localize o orçamento desejado',
          'Verifique se o status está como **Aprovado**',
          'Clique em **Converter em Pedido**',
          'O sistema criará um pedido com os mesmos itens e dados do cliente',
          'O estoque reservado será convertido em estoque vendido',
        ],
      },
    ],
  },
  {
    icon: Star,
    title: 'Avaliações',
    badge: 'Admin',
    description: 'Modere avaliações de produtos feitas por clientes, aprove/rejeite e responda diretamente.',
    features: [
      'Moderação (aprovar/rejeitar)',
      'Avaliações verificadas (compra confirmada)',
      'Resposta direta pelo painel',
      'Filtros por nota, status e produto',
    ],
    tutorials: [
      {
        title: 'Como moderar avaliações',
        steps: [
          'No menu lateral, clique em **Avaliações**',
          'Avaliações pendentes aparecem com status **"Aguardando"**',
          'Leia o conteúdo da avaliação (nota, título, comentário)',
          'Clique em **Aprovar** para publicar na loja ou **Rejeitar** para remover',
          'Para responder, clique no ícone de resposta e digite seu comentário',
          'Use os filtros no topo para ver por nota (1-5 estrelas) ou status',
        ],
      },
    ],
  },
  {
    icon: Tag,
    title: 'Cupons',
    badge: 'Admin',
    description: 'Crie e gerencie cupons de desconto com regras avançadas, limite de uso e integração com a roleta de prêmios.',
    features: [
      'Desconto percentual ou valor fixo',
      'Validade com data de início e fim',
      'Limite total de uso e por cliente',
      'Valor mínimo de pedido',
      'Restrição por produtos ou categorias',
      'Cupom progressivo (faixas de desconto)',
      'Integração com roleta de prêmios',
      'Relatório de uso',
    ],
    tutorials: [
      {
        title: 'Como criar um cupom de desconto',
        steps: [
          'No menu lateral, clique em **Cupons**',
          'Clique em **Novo Cupom**',
          'Defina o **Código** do cupom (ex: DESCONTO10)',
          'Selecione o **Tipo de Desconto**: Percentual (%) ou Valor Fixo (R$)',
          'Informe o **Valor** do desconto',
          'Defina o **Valor Mínimo** do pedido para usar o cupom (opcional)',
          'Defina o **Desconto Máximo** em reais para cupons percentuais (opcional)',
          'Configure a **Validade**: data de início e data de expiração',
          'Defina o **Limite de Uso** total e/ou por cliente',
          'Para restringir a produtos/categorias específicas, selecione nos campos correspondentes',
          'Para incluir na **Roleta de Prêmios**, marque a opção "Mostrar na roleta"',
          'Clique em **Salvar**',
        ],
      },
      {
        title: 'Como criar cupom progressivo',
        steps: [
          'Ao criar ou editar um cupom, selecione o tipo **Progressivo**',
          'Adicione as **faixas** de desconto clicando em "Adicionar faixa"',
          'Para cada faixa, defina: valor mínimo do pedido → percentual de desconto',
          'Exemplo: Acima de R$100 = 5%, Acima de R$200 = 10%, Acima de R$300 = 15%',
          'Clique em **Salvar**',
          'O cupom aplicará automaticamente a faixa correspondente ao valor do carrinho',
        ],
      },
    ],
  },
  {
    icon: Package,
    title: 'Combos',
    badge: 'Admin',
    description: 'Monte kits de produtos com preço especial e frete grátis opcional.',
    features: [
      'Kit com múltiplos produtos',
      'Preço especial do combo',
      'Frete grátis opcional',
      'Imagem personalizada',
      'Ativação/desativação',
    ],
    tutorials: [
      {
        title: 'Como criar um combo',
        steps: [
          'No menu lateral, clique em **Combos**',
          'Clique em **Novo Combo**',
          'Defina o **Nome** do combo (ex: "Kit Verão Completo")',
          'Adicione uma **Descrição**',
          'Defina o **Preço do Combo** (deve ser menor que a soma dos produtos individuais)',
          'Clique em **Adicionar Produto** para incluir itens ao combo',
          'Para cada produto, selecione o produto e a variação específica (se houver)',
          'Defina a **Quantidade** de cada item no combo',
          'Marque **Frete Grátis** se desejar oferecer frete grátis para este combo',
          'Faça upload de uma **Imagem** personalizada para o combo',
          'Clique em **Salvar**',
        ],
      },
    ],
  },
  {
    icon: Target,
    title: 'Compre Junto (Upsells)',
    badge: 'Admin',
    description: 'Configure sugestões de "Compre Junto" nos produtos da loja para aumentar o ticket médio.',
    features: [
      'Sugestão de produtos complementares',
      'Desconto exclusivo na compra conjunta',
      'Ordenação por drag & drop',
      'Ativação individual',
    ],
    tutorials: [
      {
        title: 'Como configurar "Compre Junto"',
        steps: [
          'No menu lateral, clique em **Compre Junto**',
          'Clique em **Nova Sugestão**',
          'Selecione o **Produto Principal** (onde a sugestão será exibida)',
          'Selecione o **Produto Sugerido** (o que será recomendado)',
          'Defina o **Percentual de Desconto** para compra conjunta (ex: 10%)',
          'Clique em **Salvar**',
          'Na loja, ao visualizar o produto principal, a seção "Compre Junto" aparecerá com o desconto',
          'Arraste as sugestões para reordenar a exibição',
        ],
      },
    ],
  },
  {
    icon: Truck,
    title: 'Frete',
    badge: 'Admin',
    description: 'Configure o cálculo de frete com integração Melhor Envio, CEP de origem e dimensões padrão.',
    features: [
      'Integração com Melhor Envio',
      'CEP de origem configurável',
      'Dimensões e peso padrão',
      'Cotação pelo painel admin',
    ],
    tutorials: [
      {
        title: 'Como configurar o frete',
        steps: [
          'No menu lateral, clique em **Frete**',
          'Informe o **CEP de Origem** (endereço de onde os produtos são enviados)',
          'Configure o **Token do Melhor Envio** (necessário para a integração)',
          'Defina as **Dimensões Padrão** (peso, altura, largura, comprimento) para produtos sem essas informações',
          'Clique em **Salvar**',
        ],
      },
      {
        title: 'Como fazer uma cotação de frete',
        steps: [
          'Na página de Frete, localize a seção **Cotação**',
          'Informe o **CEP de Destino**',
          'Selecione o **Produto** ou informe dimensões manualmente',
          'Clique em **Calcular**',
          'O sistema retornará as opções de envio com preços e prazos de cada transportadora',
        ],
      },
    ],
  },
  {
    icon: ImageIcon,
    title: 'Banners',
    badge: 'Admin',
    description: 'Gerencie os banners da loja online: hero, promocionais e institucionais com suporte a imagem e vídeo.',
    features: [
      'Tipos: Hero, Promocional, Institucional',
      'Upload de imagem ou vídeo',
      'Título, subtítulo e link de destino',
      'Ordenação por drag & drop',
      'Ativação/desativação individual',
    ],
    tutorials: [
      {
        title: 'Como criar um banner',
        steps: [
          'No menu lateral, clique em **Banners**',
          'Clique em **Novo Banner**',
          'Selecione o **Tipo**: Hero (banner grande da home), Promocional ou Institucional',
          'Faça upload da **Imagem** (resolução recomendada: 1920x600 para Hero)',
          'Ou selecione **Vídeo** e faça upload do arquivo de vídeo',
          'Preencha o **Título** e **Subtítulo** (opcionais — aparecem sobre a imagem)',
          'Informe o **Link de destino** (para onde o banner direciona ao ser clicado)',
          'Clique em **Salvar**',
          'Arraste o banner na listagem para alterar a **ordem** no carrossel',
        ],
      },
    ],
  },
  {
    icon: BarChart3,
    title: 'Relatórios',
    badge: 'Todos',
    description: 'Relatórios analíticos de vendas, estoque e clientes com gráficos interativos e filtros avançados.',
    features: [
      'Relatório de vendas por período, produto, categoria e vendedor',
      'Relatório de estoque e movimentações',
      'Relatório de clientes e frequência de compra',
      'Gráficos de barras, linhas e pizza',
      'Filtros combinados',
    ],
    tutorials: [
      {
        title: 'Como gerar um relatório',
        steps: [
          'No menu lateral, clique em **Relatórios**',
          'Selecione o **tipo de relatório** desejado (vendas, estoque, clientes)',
          'Configure os **filtros**: período, loja, categoria, vendedor, etc.',
          'O relatório será gerado e exibido com gráficos e tabelas',
          'Interaja com os gráficos para detalhar informações específicas',
        ],
      },
    ],
  },
  {
    icon: Sparkles,
    title: 'Assistente IA',
    badge: 'Gerente+',
    description: 'Converse com a IA sobre seus dados de vendas, estoque e clientes usando linguagem natural.',
    features: [
      'Chat com linguagem natural',
      'Perguntas sobre vendas, estoque e clientes',
      'Sugestões de ações',
      'Contexto do negócio integrado',
    ],
    tutorials: [
      {
        title: 'Como usar o Assistente IA',
        steps: [
          'No menu lateral, clique em **Assistente IA**',
          'Digite sua pergunta na caixa de texto (ex: "Qual foi o produto mais vendido este mês?")',
          'Pressione **Enter** ou clique em enviar',
          'A IA analisará os dados do sistema e responderá com informações e sugestões',
          'Faça perguntas de acompanhamento para aprofundar a análise',
          'Exemplos de perguntas úteis:',
          '→ "Quais clientes não compram há mais de 30 dias?"',
          '→ "Qual o ticket médio por forma de pagamento?"',
          '→ "Quais produtos estão com estoque crítico?"',
          '→ "Compare as vendas desta semana com a semana anterior"',
        ],
      },
    ],
  },
  {
    icon: BrainCircuit,
    title: 'Analytics IA',
    badge: 'Admin',
    description: 'Análise inteligente com insights automáticos sobre comportamento, tendências e previsões de demanda.',
    features: [
      'Análise comportamental de visitantes',
      'Insights de tendências e sazonalidade',
      'Previsões de demanda',
    ],
    tutorials: [
      {
        title: 'Como usar o Analytics IA',
        steps: [
          'No menu lateral, clique em **Analytics IA**',
          'O sistema analisará automaticamente seus dados e exibirá insights',
          'Revise as **tendências** identificadas e as **oportunidades** sugeridas',
          'Use as previsões de demanda para planejar compras e estoque',
        ],
      },
    ],
  },
  {
    icon: Users,
    title: 'Usuários',
    badge: 'Admin',
    description: 'Cadastre e gerencie usuários do sistema com diferentes roles (Admin, Gerente, Vendedor) e controle de menus.',
    features: [
      'Cadastro de operadores, vendedores e gerentes',
      'Roles: Admin, Gerente, Vendedor',
      'Vinculação à loja específica',
      'Controle granular de menus',
      'Ativação/desativação',
    ],
    tutorials: [
      {
        title: 'Como criar um novo usuário',
        steps: [
          'No menu lateral, clique em **Usuários**',
          'Clique em **Novo Usuário**',
          'Preencha o **Nome Completo** e **E-mail**',
          'Defina uma **Senha** temporária',
          'Selecione o **Role** (papel):',
          '→ **Admin**: Acesso total a todas as funcionalidades',
          '→ **Gerente**: Acesso a PDV, vendas, estoque, clientes, pedidos, orçamentos, relatórios e assistente',
          '→ **Vendedor**: Acesso limitado ao PDV e funcionalidades de venda',
          'Selecione a **Loja** à qual o usuário será vinculado',
          'Na seção **Menus Permitidos**, marque/desmarque quais menus o usuário pode acessar',
          'Clique em **Criar Usuário**',
        ],
      },
      {
        title: 'Como desativar um usuário',
        steps: [
          'Na listagem de usuários, localize o usuário',
          'Clique no toggle de **Status** para desativar',
          'O usuário não poderá mais fazer login, mas seus dados e histórico são mantidos',
          'Para reativar, clique novamente no toggle',
        ],
      },
    ],
  },
  {
    icon: History,
    title: 'Histórico (Auditoria)',
    badge: 'Admin',
    description: 'Log completo de todas as ações realizadas no sistema para rastreabilidade e auditoria.',
    features: [
      'Registro de todas as ações (criar, editar, excluir)',
      'Detalhes: quem, o quê, quando e alterações',
      'Filtros por usuário, ação, entidade e período',
    ],
    tutorials: [
      {
        title: 'Como consultar o histórico',
        steps: [
          'No menu lateral, clique em **Histórico**',
          'A tabela mostra todas as ações em ordem cronológica (mais recentes primeiro)',
          'Cada registro exibe: **Usuário**, **Ação** (criou, editou, excluiu), **Entidade** (produto, pedido, etc.) e **Data**',
          'Clique em um registro para ver os **detalhes da alteração** (valores anteriores e novos)',
          'Use os filtros no topo para refinar: **Usuário**, **Tipo de Ação**, **Entidade** e **Período**',
        ],
      },
    ],
  },
  {
    icon: Handshake,
    title: 'Afiliados',
    badge: 'Admin',
    description: 'Programa de afiliados com código de referência, comissão por venda, controle de cliques e gestão de saques.',
    features: [
      'Cadastro de afiliados com dados bancários',
      'Código de referência único',
      'Comissão percentual por venda',
      'Acompanhamento de cliques e vendas',
      'Gestão de saques e pagamentos',
      'Painel público para o afiliado',
    ],
    tutorials: [
      {
        title: 'Como cadastrar um afiliado',
        steps: [
          'No menu lateral, clique em **Afiliados**',
          'Clique em **Novo Afiliado**',
          'Preencha: **Nome**, **E-mail**, **Telefone**',
          'Informe os dados bancários: **Chave PIX**, ou Banco / Agência / Conta',
          'Defina o **Percentual de Comissão** (ex: 10%)',
          'O sistema gerará automaticamente um **Código de Referência** único',
          'Clique em **Salvar**',
          'Compartilhe o link de afiliado com a pessoa: **seusite.com/r/CODIGO**',
        ],
      },
      {
        title: 'Como gerenciar saques',
        steps: [
          'Na listagem de afiliados, veja o **Saldo Disponível** de cada um',
          'Quando um afiliado solicitar saque, o pedido aparecerá na seção **Saques Pendentes**',
          'Revise o valor e os dados bancários do afiliado',
          'Realize a transferência bancária manualmente',
          'Clique em **Aprovar Saque** para confirmar o pagamento',
          'O saldo do afiliado será atualizado automaticamente',
        ],
      },
    ],
  },
  {
    icon: Upload,
    title: 'Importação de Dados',
    badge: 'Admin',
    description: 'Importe produtos em massa via CSV, migre dados de sistemas legados e carregue planilhas de BI.',
    features: [
      'Importação de produtos via CSV',
      'Migração de sistema legado',
      'Importação de dados para BI',
      'Validação prévia com relatório de erros',
      'Histórico de importações',
    ],
    tutorials: [
      {
        title: 'Como importar produtos via CSV',
        steps: [
          'No menu lateral, clique em **Importar CSV**',
          'Baixe o **modelo de CSV** clicando em "Baixar Modelo"',
          'Abra o modelo no Excel ou Google Sheets e preencha os dados dos produtos',
          'Salve o arquivo em formato **CSV (UTF-8)**',
          'De volta ao sistema, clique em **Selecionar Arquivo** e escolha seu CSV',
          'O sistema validará os dados e exibirá um **relatório prévio**',
          'Revise os dados e eventuais **erros** encontrados',
          'Corrija os erros no CSV e reimporte, ou clique em **Importar** para prosseguir',
          'Acompanhe o progresso da importação na tela',
          'Ao finalizar, os produtos estarão disponíveis no catálogo',
        ],
      },
      {
        title: 'Como importar dados legados',
        steps: [
          'No menu lateral, clique em **Importar Legado**',
          'Prepare o CSV no formato de migração (consulte a documentação de estrutura)',
          'Faça upload do arquivo de **produtos** e, opcionalmente, do arquivo de **variações**',
          'O sistema processará e importará os dados com mapeamento automático',
          'Verifique o resultado na listagem de produtos',
        ],
      },
    ],
  },
  {
    icon: Settings,
    title: 'Configurações',
    badge: 'Todos',
    description: 'Configure todos os aspectos da loja: dados, metas, integrações, notificações, roleta, destaques e mais.',
    features: [
      'Dados da loja e contato',
      'Metas de vendas mensais',
      'Templates de WhatsApp',
      'Push notifications',
      'Roleta de prêmios',
      'Produto destaque',
      'Countdown de ofertas',
      'Feedback de clientes',
      'Vídeo-depoimentos',
      'Provador virtual IA',
      'Instagram',
      'Alertas de estoque baixo',
      'Cupom de recuperação',
      'Vídeo atacado',
    ],
    tutorials: [
      {
        title: 'Como configurar o WhatsApp',
        steps: [
          'Vá em **Configurações** pelo menu lateral',
          'Encontre a seção **Templates WhatsApp**',
          'Edite os modelos de mensagem para: Boas-vindas, Recuperação de Carrinho, Atualização de Pedido, etc.',
          'Use as **variáveis** disponíveis (ex: {{nome}}, {{pedido}}, {{valor}}) nos templates',
          'Clique em **Salvar** em cada template editado',
        ],
      },
      {
        title: 'Como configurar a Roleta de Prêmios',
        steps: [
          'Vá em **Configurações** → seção **Roleta de Prêmios**',
          'Ative/desative a roleta com o toggle',
          'Os cupons que aparecem na roleta são os marcados com "Mostrar na roleta" na tela de Cupons',
          'Configure a **probabilidade** de cada prêmio',
          'Defina após quantos dias o visitante pode girar novamente',
          'Clique em **Salvar**',
        ],
      },
      {
        title: 'Como definir o Produto Destaque',
        steps: [
          'Vá em **Configurações** → seção **Produto Destaque**',
          'Busque e selecione o produto que deseja destacar na home da loja',
          'O produto aparecerá em uma seção especial na página inicial',
          'Clique em **Salvar**',
        ],
      },
      {
        title: 'Como configurar Alertas de Estoque Baixo',
        steps: [
          'Vá em **Configurações** → seção **Alertas de Estoque**',
          'Defina o **limite mínimo global** (quantidade abaixo da qual os produtos serão alertados)',
          'Ative/desative as notificações push para estoque baixo',
          'Clique em **Salvar**',
          '**Nota**: Cada produto também pode ter seu próprio estoque mínimo individual na edição do produto',
        ],
      },
    ],
  },
];

const Manual = () => {
  return (
    <AdminLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Manual do Sistema
          </h1>
          <p className="text-muted-foreground mt-1">
            Guia completo com passo a passo de todas as funcionalidades do painel administrativo
          </p>
        </div>

        {/* Quick legend */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground">Legenda de acesso:</span>
          <Badge variant="secondary">Todos</Badge>
          <Badge variant="default">Admin</Badge>
          <Badge variant="outline">Gerente+</Badge>
        </div>

        <Accordion type="multiple" className="space-y-3">
          {sections.map((section, idx) => {
            const Icon = section.icon;
            return (
              <AccordionItem
                key={idx}
                value={`section-${idx}`}
                className="border rounded-lg px-4"
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
                <AccordionContent className="pb-6">
                  {/* Description */}
                  <p className="text-sm text-muted-foreground mb-4 pl-12">
                    {section.description}
                  </p>

                  {/* Features list */}
                  <div className="pl-12 mb-5">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Funcionalidades
                    </h4>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {section.features.map((feat, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          {feat}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Separator className="mb-5" />

                  {/* Step-by-step tutorials */}
                  <div className="pl-12 space-y-6">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Passo a Passo
                    </h4>
                    {section.tutorials.map((tutorial, tIdx) => (
                      <div key={tIdx} className="space-y-3">
                        <h5 className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {tIdx + 1}
                          </span>
                          {tutorial.title}
                        </h5>
                        <ol className="space-y-2 pl-8">
                          {tutorial.steps.map((step, sIdx) => {
                            const parts = step.split(/\*\*(.*?)\*\*/g);
                            return (
                              <li key={sIdx} className="text-sm text-muted-foreground leading-relaxed flex gap-2">
                                <span className="text-primary font-semibold min-w-[20px] text-right flex-shrink-0">
                                  {step.startsWith('→') || step.startsWith('**Nota') || step.startsWith('**Atenção') || step.startsWith('**Dica') || step.startsWith('**Importante') ? '' : `${sIdx + 1}.`}
                                </span>
                                <span>
                                  {parts.map((part, j) =>
                                    j % 2 === 1 ? (
                                      <strong key={j} className="text-foreground font-medium">
                                        {part}
                                      </strong>
                                    ) : (
                                      <span key={j}>{part}</span>
                                    )
                                  )}
                                </span>
                              </li>
                            );
                          })}
                        </ol>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">❓ Dúvidas Frequentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div>
              <p className="font-medium text-foreground mb-1">Como alterar minha senha?</p>
              <p>Solicite ao administrador para redefinir sua senha através da tela de Usuários.</p>
            </div>
            <Separator />
            <div>
              <p className="font-medium text-foreground mb-1">Não consigo acessar um menu.</p>
              <p>Seu acesso é controlado pelo administrador. Verifique com ele se seu perfil tem permissão para acessar a funcionalidade desejada.</p>
            </div>
            <Separator />
            <div>
              <p className="font-medium text-foreground mb-1">O sistema está lento.</p>
              <p>Verifique sua conexão com a internet. Se o problema persistir, tente limpar o cache do navegador (Ctrl+Shift+R).</p>
            </div>
            <Separator />
            <div>
              <p className="font-medium text-foreground mb-1">Como funciona o modo offline do PDV?</p>
              <p>Quando o sistema detecta que você está sem internet, as vendas são salvas localmente e sincronizadas automaticamente quando a conexão for restaurada. Não limpe os dados do navegador enquanto houver vendas pendentes.</p>
            </div>
            <Separator />
            <div>
              <p className="font-medium text-foreground mb-1">O que significa o ícone 🔒 no estoque?</p>
              <p>Indica que aquela quantidade está reservada por um orçamento pendente. O estoque será liberado quando o orçamento expirar ou for cancelado.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default Manual;
