# Roadmap — Aba de Aniversariantes

- [x] Estrutura de dados de aniversariantes (`birthday_settings`, `birthday_viewers`, `birthday_reminders` e RPCs)
- [x] Helpers e componentes base (`src/lib/birthdays.ts`, `BirthdayReminderView`, `BirthdayReminderPopup`)
- [x] Adicionar campo `gift_image_url` em `birthday_settings` e upload da imagem do brinde
- [x] Edge Function com Lovable AI para analisar a imagem do brinde e gerar automaticamente a mensagem de aniversário
- [x] Exibir a imagem do brinde na pré-visualização e no pop-up (com botão de baixar/copiar imagem para anexar no WhatsApp)
- [x] Finalizar página `/admin/aniversariantes` (Avisos, Regras com anexo + IA, Quem recebe) e conectar menu, rota e pop-up
- [x] Testes automatizados e verificação no navegador

# Etiquetas de ações no PDV

- [x] Cadastro de etiquetas personalizáveis e vínculo na venda
- [x] Seleção de etiqueta no PDV, preservada no rascunho e na sincronização
- [x] Retorno por ação no dashboard com filtros existentes
- [x] Testes e verificação autenticada do cadastro, seleção e rascunho; nenhuma venda real registrada na verificação

# Seção de Etiquetas de ações

- [x] Seção própria com abas de cadastro e resultados automáticos por etiqueta
- [x] Selecionar etiquetas também ao finalizar a venda no PDV
- [x] Testes e verificação autenticada do cadastro, painel automático, seleção no pagamento e preservação do rascunho; etiqueta temporária removida e nenhuma venda real registrada