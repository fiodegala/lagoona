

# Alertas Sonoros Completos para Notificações

## Situação Atual
- **Notificações gerais** (pedidos, carrinhos, vendas PDV, transferências): som fraco (gain 0.3, duração 0.3s, frequência única 800Hz)
- **Modal de transferência pendente**: som com 3 beeps (gain 0.4-0.45) — melhor, mas ainda discreto
- **Comunicados (AnnouncementPopup)**: sem som nenhum
- **Ordens de Serviço**: sem som nenhum, sem listener realtime

## Implementação

### 1. Criar utilitário de sons centralizados (`src/lib/alertSounds.ts`)
Criar um módulo com funções de som distintas para cada tipo de evento, todas com volume alto (gain 0.7-0.9) e padrões sonoros diferenciados:

- **`playNotificationSound()`** — para pedidos, vendas, carrinhos: 2 beeps rápidos agudos
- **`playTransferAlertSound()`** — para transferências de estoque: alarme urgente com 4 beeps crescentes, repetido
- **`playServiceOrderSound()`** — para ordens de serviço: 3 tons médios distintos
- **`playAnnouncementSound()`** — para comunicados: fanfarra/chime com acordes

Cada função usa `AudioContext` com `gain.value` alto (0.7-0.9) e múltiplos osciladores para garantir volume audível.

### 2. Atualizar `useAdminNotifications.ts`
- Importar `playNotificationSound` do novo módulo
- Substituir o `playSound` atual pelo novo som alto
- Usar sons diferenciados por tipo de notificação (switch no `type`)

### 3. Atualizar `PendingTransferModal.tsx`
- Importar `playTransferAlertSound` do novo módulo
- Substituir o `playAlertSound` pelo novo som mais alto e urgente

### 4. Atualizar `AnnouncementPopup.tsx`
- Importar `playAnnouncementSound`
- Tocar som quando um comunicado é exibido (no `useEffect` que abre o popup)

### 5. Adicionar alerta sonoro para Ordens de Serviço (`ServiceOrders.tsx`)
- Adicionar listener Supabase Realtime na tabela `service_orders` (evento INSERT)
- Ao receber nova OS, tocar `playServiceOrderSound()`
- Mostrar toast informativo com dados da nova OS

### Arquivos alterados
- `src/lib/alertSounds.ts` (novo) — módulo centralizado de sons
- `src/hooks/useAdminNotifications.ts` — usar sons altos diferenciados por tipo
- `src/components/PendingTransferModal.tsx` — usar som alto de transferência
- `src/components/AnnouncementPopup.tsx` — adicionar som ao exibir comunicado
- `src/pages/ServiceOrders.tsx` — adicionar realtime + som para novas OS

