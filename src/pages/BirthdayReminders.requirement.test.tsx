import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
});