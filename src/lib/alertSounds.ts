// Centralized alert sounds with high volume for system notifications

function createBeep(ctx: AudioContext, freq: number, startTime: number, duration: number, gainValue: number, type: OscillatorType = 'sine') {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(gainValue, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

/** Pedidos, vendas PDV, carrinhos — 2 beeps rápidos agudos */
export function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    createBeep(ctx, 880, now, 0.15, 0.8);
    createBeep(ctx, 1100, now + 0.2, 0.15, 0.85);
  } catch {}
}

/** Transferências de estoque — alarme urgente com 4 beeps crescentes */
export function playTransferAlertSound() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    const freqs = [660, 880, 1100, 1320];
    freqs.forEach((f, i) => {
      createBeep(ctx, f, now + i * 0.2, 0.18, 0.9, 'square');
    });
    // Repeat pattern after short pause
    freqs.forEach((f, i) => {
      createBeep(ctx, f, now + 1.0 + i * 0.2, 0.18, 0.9, 'square');
    });
  } catch {}
}

/** Ordens de serviço — 3 tons médios distintos */
export function playServiceOrderSound() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    createBeep(ctx, 523, now, 0.2, 0.8, 'triangle');
    createBeep(ctx, 659, now + 0.25, 0.2, 0.85, 'triangle');
    createBeep(ctx, 784, now + 0.5, 0.3, 0.9, 'triangle');
  } catch {}
}

/** Comunicados — fanfarra/chime com acordes */
export function playAnnouncementSound() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    // Chord 1
    createBeep(ctx, 523, now, 0.3, 0.7);
    createBeep(ctx, 659, now, 0.3, 0.6);
    createBeep(ctx, 784, now, 0.3, 0.5);
    // Chord 2 (higher)
    createBeep(ctx, 659, now + 0.35, 0.3, 0.75);
    createBeep(ctx, 784, now + 0.35, 0.3, 0.65);
    createBeep(ctx, 1047, now + 0.35, 0.4, 0.8);
  } catch {}
}

/** Chat interno — som tipo WhatsApp: 2 tons suaves rápidos */
export function playChatMessageSound() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    createBeep(ctx, 600, now, 0.1, 0.6, 'sine');
    createBeep(ctx, 900, now + 0.12, 0.15, 0.7, 'sine');
  } catch {}
}
