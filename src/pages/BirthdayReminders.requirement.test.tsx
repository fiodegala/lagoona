import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BirthdayReminders from '@/pages/BirthdayReminders';
import BirthdayReminderPopup from '@/components/BirthdayReminderPopup';
import { BirthdayRulesTab } from '@/components/BirthdaySettingsTabs';

const mockRpc = vi.fn();
const mockInvoke = vi.fn();
const mockUpload = vi.fn();
const mockGetPublicUrl = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'admin-1' }, isAdmin: true }),
}));

vi.mock('@/components/AdminLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => mockUpload(...args),
        getPublicUrl: (...args: unknown[]) => mockGetPublicUrl(...args),
      }),
    },
  },
}));

const wrap = (ui: React.ReactNode) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
};

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe('O pop-up de aniversário avisa no dia e exibe a imagem do brinde', () => {
  it('Um usuário liberado vê o aniversariante do dia com a imagem do brinde e pode marcar como enviado', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'birthday_viewers') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { user_id: 'admin-1', all_stores: true, store_ids: [] }, error: null }),
            }),
          }),
        };
      }
      if (table === 'birthday_settings') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  enabled: true,
                  message_template: 'Feliz aniversário, {nome}! Retire seu brinde na {loja}.',
                  gift_image_url: 'https://cdn.example.com/brinde-caneca.png',
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'get_birthday_reminders') {
        return {
          range: async () => ({
            data: [
              {
                customer_id: 'cust-1',
                customer_name: 'CARLOS PEREIRA',
                customer_phone: '62999998888',
                customer_document: null,
                birthday: '1990-11-25',
                birthday_year: 2026,
                birthday_date: '2026-11-25',
                turning_age: 36,
                store_id: 'store-1',
                store_name: 'Bernardo Sayão',
                status: 'pending',
                sent_at: null,
                sent_by: null,
              },
            ],
            error: null,
          }),
        };
      }
      return Promise.resolve({ data: null, error: null });
    });

    wrap(<BirthdayReminderPopup />);

    expect(await screen.findByText('CARLOS PEREIRA')).toBeInTheDocument();
    expect(screen.getByAltText('Imagem do brinde de aniversário')).toHaveAttribute(
      'src',
      'https://cdn.example.com/brinde-caneca.png',
    );
    expect(screen.getByDisplayValue('Feliz aniversário, Carlos! Retire seu brinde na Bernardo Sayão.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Mensagem enviada/i }));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('set_birthday_reminder_status', {
        _customer_id: 'cust-1',
        _year: 2026,
        _status: 'sent',
      });
    });
  });

  it('Quando não há imagem global salva, quem recebe o pop-up pode anexar uma imagem junto da mensagem na hora do envio', async () => {
    const origCreateObjectUrl = URL.createObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:local-cinto');

    try {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'birthday_viewers') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { user_id: 'admin-1', all_stores: true, store_ids: [] }, error: null }),
              }),
            }),
          };
        }
        if (table === 'birthday_settings') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    enabled: true,
                    message_template: 'Feliz aniversário, {nome}!',
                    gift_image_url: null,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      mockRpc.mockImplementation((fn: string) => {
        if (fn === 'get_birthday_reminders') {
          return {
            range: async () => ({
              data: [
                {
                  customer_id: 'cust-2',
                  customer_name: 'ANA LIMA',
                  customer_phone: '62998887766',
                  customer_document: null,
                  birthday: '1992-11-25',
                  birthday_year: 2026,
                  birthday_date: '2026-11-25',
                  turning_age: 34,
                  store_id: 'store-1',
                  store_name: 'Bernardo Sayão',
                  status: 'pending',
                  sent_at: null,
                  sent_by: null,
                },
              ],
              error: null,
            }),
          };
        }
        return Promise.resolve({ data: null, error: null });
      });

      wrap(<BirthdayReminderPopup />);

      expect(await screen.findByText('ANA LIMA')).toBeInTheDocument();
      const attachBtn = screen.getByRole('button', { name: /Anexar imagem/i });
      expect(attachBtn).toBeInTheDocument();

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(input).toBeTruthy();
      const file = new File(['img-bytes'], 'cintos-elasticos.jpeg', { type: 'image/jpeg' });
      fireEvent.change(input, { target: { files: [file] } });

      expect(await screen.findByAltText('Imagem do brinde de aniversário')).toHaveAttribute('src', 'blob:local-cinto');
      expect(screen.getByRole('button', { name: /Copiar imagem/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Baixar imagem/i })).toBeInTheDocument();
    } finally {
      URL.createObjectURL = origCreateObjectUrl;
    }
  });

  it('Na aba Avisos, o administrador consegue anexar a imagem junto da mensagem e salvar para todos os envios', async () => {
    const mockSettingsUpdateEq = vi.fn().mockResolvedValue({ data: [{ id: 1 }], error: null });
    const mockSettingsUpdate = vi.fn(() => ({
      eq: () => ({
        select: mockSettingsUpdateEq,
      }),
    }));

    mockFrom.mockImplementation((table: string) => {
      if (table === 'stores') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: [{ id: 'store-1', name: 'Bernardo Sayão' }], error: null }),
            }),
          }),
        };
      }
      if (table === 'birthday_settings') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: 1,
                  enabled: true,
                  days_before: 0,
                  days_after: 0,
                  message_template: 'Feliz aniversário, {nome}!',
                  gift_image_url: null,
                },
                error: null,
              }),
            }),
          }),
          update: mockSettingsUpdate,
        };
      }
      return {};
    });

    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'get_birthday_reminders') {
        return {
          range: async () => ({
            data: [
              {
                customer_id: 'cust-3',
                customer_name: 'JOAO ALVES',
                customer_phone: '62997776655',
                customer_document: null,
                birthday: '1988-11-25',
                birthday_year: 2026,
                birthday_date: '2026-11-25',
                turning_age: 38,
                store_id: 'store-1',
                store_name: 'Bernardo Sayão',
                status: 'pending',
                sent_at: null,
                sent_by: null,
              },
            ],
            error: null,
          }),
        };
      }
      return Promise.resolve({ data: null, error: null });
    });

    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/birthdays/cintos.jpeg' } });

    wrap(<BirthdayReminders />);

    expect(await screen.findByText('JOAO ALVES')).toBeInTheDocument();
    fireEvent.click(screen.getByText('JOAO ALVES'));

    const attachBtn = await screen.findByRole('button', { name: /Anexar imagem/i });
    expect(attachBtn).toBeInTheDocument();

    const dialog = screen.getByRole('dialog');
    const fileInput = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['img-bytes'], 'cintos.jpeg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalled();
      expect(mockSettingsUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ gift_image_url: 'https://cdn.example.com/birthdays/cintos.jpeg' }),
      );
    });
  });
});

describe('Clientes cujo aniversário já passou neste mês recebem uma saudação de aniversário atrasado', () => {
  it.each([
    ['01', '2026-11-25T17:46:00Z', 'Olá Paula, vimos que você fez aniversário nesse mês de novembro!'],
    ['24', '2026-11-25T17:46:00Z', 'Olá Paula, vimos que você fez aniversário nesse mês de novembro!'],
    ['25', '2026-11-25T17:46:00Z', 'Feliz aniversário, Paula!'],
    ['26', '2026-11-25T17:46:00Z', 'Feliz aniversário, Paula!'],
    ['25', '2026-11-26T01:00:00Z', 'Feliz aniversário, Paula!'],
  ])('Ao abrir o aviso de uma cliente nascida em %s/11, no instante %s, a equipe vê a saudação correta', async (day, instant, greeting) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(instant));
    try {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'stores') return {
          select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }),
        };
        if (table === 'birthday_settings') return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({
            data: { id: 1, enabled: true, days_before: 0, days_after: 0,
              message_template: 'Feliz aniversário, {nome}! 🎉\n\nVocê ganhou um Cinto Elástico! Retire em qualquer loja Fio de Gala até {validade}.',
              gift_image_url: null }, error: null,
          }) }) }),
        };
        return {};
      });
      mockRpc.mockImplementation(() => ({ range: async () => ({ data: [{
        customer_id: 'cliente-paula', customer_name: 'PAULA MENDES', customer_phone: '62999998888',
        customer_document: null, birthday: `1995-11-${day}`, birthday_year: 2026,
        birthday_date: `2026-11-${day}`, turning_age: 31, store_id: null, store_name: null,
        status: 'pending', sent_at: null, sent_by: null,
      }], error: null }) }));
      wrap(<BirthdayReminders />);
      fireEvent.click(await screen.findByText('PAULA MENDES'));
      const message = `${greeting} 🎉\n\nVocê ganhou um Cinto Elástico! Retire em qualquer loja Fio de Gala até 30/11/2026.`;
      const textarea = screen.getByRole('dialog').querySelector('textarea');
      expect(textarea).toHaveValue(message);
      expect(screen.getByRole('link', { name: 'Abrir WhatsApp' })).toHaveAttribute('href', expect.stringContaining(encodeURIComponent(message)));
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Anexar a imagem do brinde cria automaticamente a mensagem de aniversário', () => {
  it('Quando o administrador anexa uma imagem do brinde, a mensagem do WhatsApp é preenchida com o texto gerado pela IA', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'birthday_settings') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: 1,
                  enabled: true,
                  days_before: 0,
                  days_after: 0,
                  message_template: 'Mensagem inicial',
                  gift_image_url: null,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/birthdays/brinde.png' } });
    mockInvoke.mockResolvedValue({
      data: { message: 'Olá, {nome}! Feliz aniversário! Você ganhou uma necessaire exclusiva na {loja}.' },
      error: null,
    });

    const { container } = wrap(<BirthdayRulesTab />);
    await screen.findByText('Regras dos avisos de aniversário');

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['fake-png'], 'brinde.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('generate-birthday-message', {
        body: { imageUrl: 'https://cdn.example.com/birthdays/brinde.png' },
      });
    });

    expect(
      await screen.findByDisplayValue('Olá, {nome}! Feliz aniversário! Você ganhou uma necessaire exclusiva na {loja}.'),
    ).toBeInTheDocument();
  });

  it('Quando o administrador anexa a imagem na aba Avisos, a mensagem é gerada automaticamente avisando que o cliente ganhou o produto da imagem', async () => {
    const mockSettingsUpdate = vi.fn(() => ({
      eq: () => ({
        select: vi.fn().mockResolvedValue({ data: [{ id: 1 }], error: null }),
      }),
    }));

    mockFrom.mockImplementation((table: string) => {
      if (table === 'stores') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: [{ id: 'store-1', name: 'Bernardo Sayão' }], error: null }),
            }),
          }),
        };
      }
      if (table === 'birthday_settings') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: 1,
                  enabled: true,
                  days_before: 0,
                  days_after: 0,
                  message_template: 'Mensagem padrão antiga',
                  gift_image_url: null,
                },
                error: null,
              }),
            }),
          }),
          update: mockSettingsUpdate,
        };
      }
      return {};
    });

    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'get_birthday_reminders') {
        return {
          range: async () => ({
            data: [
              {
                customer_id: 'cust-4',
                customer_name: 'MARCOS SOUZA',
                customer_phone: '62996665544',
                customer_document: null,
                birthday: '1985-11-25',
                birthday_year: 2026,
                birthday_date: '2026-11-25',
                turning_age: 41,
                store_id: 'store-1',
                store_name: 'Bernardo Sayão',
                status: 'pending',
                sent_at: null,
                sent_by: null,
              },
            ],
            error: null,
          }),
        };
      }
      return Promise.resolve({ data: null, error: null });
    });

    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/birthdays/cinto-elastico.jpeg' } });
    mockInvoke.mockResolvedValue({
      data: {
        message:
          'Olá, {nome}! Feliz aniversário! Você ganhou um Cinto Elástico de presente da Fio de Gala. Passe na {loja} para retirar o seu!',
      },
      error: null,
    });

    wrap(<BirthdayReminders />);

    expect(await screen.findByText('MARCOS SOUZA')).toBeInTheDocument();
    fireEvent.click(screen.getByText('MARCOS SOUZA'));

    const dialog = await screen.findByRole('dialog');
    const fileInput = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['img-bytes'], 'cinto-elastico.jpeg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('generate-birthday-message', {
        body: { imageUrl: 'https://cdn.example.com/birthdays/cinto-elastico.jpeg' },
      });
    });

    expect(
      await screen.findByDisplayValue(
        'Olá, Marcos! Feliz aniversário! Você ganhou um Cinto Elástico de presente da Fio de Gala. Passe na Bernardo Sayão para retirar o seu!',
      ),
    ).toBeInTheDocument();

    expect(mockSettingsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        message_template:
          'Olá, {nome}! Feliz aniversário! Você ganhou um Cinto Elástico de presente da Fio de Gala. Passe na {loja} para retirar o seu!',
      }),
    );
  });
});

describe('A retirada do presente de aniversário vale em qualquer loja até o último dia do mês do aniversário', () => {
  it('Para um cliente que faz aniversário em novembro, o pop-up mostra a mensagem com retirada em qualquer loja e validade até 30/11/2026', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'birthday_viewers') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { user_id: 'admin-1', all_stores: true, store_ids: [] }, error: null }),
            }),
          }),
        };
      }
      if (table === 'birthday_settings') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  enabled: true,
                  message_template:
                    'Feliz aniversário, {nome}! Retire seu presente em qualquer uma de nossas lojas até {validade}.',
                  gift_image_url: null,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'get_birthday_reminders') {
        return {
          range: async () => ({
            data: [
              {
                customer_id: 'cust-nov',
                customer_name: 'PAULA MENDES',
                customer_phone: '62995554433',
                customer_document: null,
                birthday: '1995-11-25',
                birthday_year: 2026,
                birthday_date: '2026-11-25',
                turning_age: 31,
                store_id: 'store-1',
                store_name: 'Bernardo Sayão',
                status: 'pending',
                sent_at: null,
                sent_by: null,
              },
            ],
            error: null,
          }),
        };
      }
      return Promise.resolve({ data: null, error: null });
    });

    wrap(<BirthdayReminderPopup />);

    expect(await screen.findByText('PAULA MENDES')).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(
        'Feliz aniversário, Paula! Retire seu presente em qualquer uma de nossas lojas até 30/11/2026.',
      ),
    ).toBeInTheDocument();
  });

  it('Para um cliente que faz aniversário em fevereiro de 2026, a mensagem padrão calcula validade até 28/02/2026 e indica qualquer loja', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'birthday_viewers') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { user_id: 'admin-1', all_stores: true, store_ids: [] }, error: null }),
            }),
          }),
        };
      }
      if (table === 'birthday_settings') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  enabled: true,
                  message_template: '',
                  gift_image_url: null,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    mockRpc.mockImplementation((fn: string) => {
      if (fn === 'get_birthday_reminders') {
        return {
          range: async () => ({
            data: [
              {
                customer_id: 'cust-feb',
                customer_name: 'LUCAS DIAS',
                customer_phone: '62994443322',
                customer_document: null,
                birthday: '1993-02-10',
                birthday_year: 2026,
                birthday_date: '2026-02-10',
                turning_age: 33,
                store_id: 'store-1',
                store_name: 'Bernardo Sayão',
                status: 'pending',
                sent_at: null,
                sent_by: null,
              },
            ],
            error: null,
          }),
        };
      }
      return Promise.resolve({ data: null, error: null });
    });

    wrap(<BirthdayReminderPopup />);

    expect(await screen.findByText('LUCAS DIAS')).toBeInTheDocument();
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toMatch(/qualquer loja Fio de Gala/i);
    expect(textarea.value).toContain('28/02/2026');
  });
});