'use client';

/**
 * Spec 5.4: Akustische Rückmeldung beim Bezahlvorgang.
 * - Positiver Doppel-Gong bei erfolgreicher Autorisierung
 * - Warn-Ton bei Kartenabbruch
 *
 * Bewusst über die Web-Audio-API erzeugt, damit keine Audiodateien
 * ausgeliefert werden müssen (Spec 2: netzwerk-autark, offline-fähig).
 */

let audioContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioContext) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      audioContext = new Ctor();
    }
    if (audioContext.state === 'suspended') {
      void audioContext.resume();
    }
    return audioContext;
  } catch {
    return null;
  }
}

interface ToneOptions {
  frequency: number;
  durationMs: number;
  delayMs?: number;
  type?: OscillatorType;
  gain?: number;
}

function playTone({ frequency, durationMs, delayMs = 0, type = 'sine', gain = 0.18 }: ToneOptions) {
  if (typeof window !== 'undefined' && localStorage.getItem('openbon_sound_muted') === 'true') {
    return;
  }
  const ctx = getContext();
  if (!ctx) return;

  const start = ctx.currentTime + delayMs / 1000;
  const end = start + durationMs / 1000;

  const osc = ctx.createOscillator();
  const amp = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);

  // Weiche Hüllkurve, damit es auf Tablet-Lautsprechern nicht klickt
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, end);

  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(start);
  osc.stop(end + 0.02);
}

/** Positiver Doppel-Gong (Quinte aufwärts) */
export function playPaymentSuccess(): void {
  playTone({ frequency: 880, durationMs: 160 });
  playTone({ frequency: 1318.5, durationMs: 320, delayMs: 150 });
}

/** Warnton bei Abbruch der Kartenzahlung */
export function playPaymentFailure(): void {
  playTone({ frequency: 320, durationMs: 220, type: 'square', gain: 0.12 });
  playTone({ frequency: 220, durationMs: 420, delayMs: 210, type: 'square', gain: 0.12 });
}

/** Kurzer Bestätigungston, z. B. beim Abschicken einer Bestellung */
export function playConfirm(): void {
  playTone({ frequency: 1046.5, durationMs: 120 });
}

/** Aufmerksamkeitston für die Küche (Spec 8: Akustik-Gong im KDS) */
export function playKitchenGong(): void {
  playTone({ frequency: 660, durationMs: 260 });
  playTone({ frequency: 990, durationMs: 380, delayMs: 200 });
}

/** Warnton bei Storno */
export function playVoidAlert(): void {
  playTone({ frequency: 440, durationMs: 140, type: 'sawtooth', gain: 0.1 });
  playTone({ frequency: 330, durationMs: 260, delayMs: 150, type: 'sawtooth', gain: 0.1 });
}

/** Melodischer Dreiklang-Chime für Bedienung wenn Bestellung abholbereit ist */
export function playOrderReadyChime(): void {
  playTone({ frequency: 523.25, durationMs: 140, gain: 0.2 }); // C5
  playTone({ frequency: 659.25, durationMs: 160, delayMs: 120, gain: 0.22 }); // E5
  playTone({ frequency: 783.99, durationMs: 300, delayMs: 240, gain: 0.25 }); // G5
}

