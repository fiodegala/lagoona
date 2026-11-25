# Roadmap — Aba de Aniversariantes

- [x] Estrutura de dados de aniversariantes (`birthday_settings`, `birthday_viewers`, `birthday_reminders` e RPCs)
- [x] Helpers e componentes base (`src/lib/birthdays.ts`, `BirthdayReminderView`, `BirthdayReminderPopup`)
- [x] Adicionar campo `gift_image_url` em `birthday_settings` e upload da imagem do brinde
- [x] Edge Function com Lovable AI para analisar a imagem do brinde e gerar automaticamente a mensagem de aniversário
- [x] Exibir a imagem do brinde na pré-visualização e no pop-up (com botão de baixar/copiar imagem para anexar no WhatsApp)
- [x] Finalizar página `/admin/aniversariantes` (Avisos, Regras com anexo + IA, Quem recebe) e conectar menu, rota e pop-up
- [x] Testes automatizados e verificação no navegador