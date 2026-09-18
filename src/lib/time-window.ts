/**
 * OpenBon - Zeitfenster & Zeitgesteuerte Artikel-Sichtbarkeit
 * Ermöglicht es, Artikel nur zu bestimmten Uhrzeiten (z. B. Mittagstisch, Kuchenbuffet, Barbetrieb)
 * anzubieten und außerhalb dieser Zeiten auf Kasse und Kellner-Tablets automatisch auszublenden.
 */

export interface TimeWindow {
  id: string;
  name?: string;
  startTime: string; // "HH:MM", z. B. "11:30"
  endTime: string;   // "HH:MM", z. B. "14:00"
  days?: number[];   // 0 = Sonntag, 1 = Montag, ..., 6 = Samstag (Standard: alle Tage)
}

export const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Mo',
  2: 'Di',
  3: 'Mi',
  4: 'Do',
  5: 'Fr',
  6: 'Sa',
  0: 'So',
};

/**
 * Parst Zeitfenster aus String oder JSON-Array sicher.
 */
export function parseTimeWindows(raw: any): TimeWindow[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Prüft, ob ein Artikel zum aktuellen (oder angegebenen) Zeitpunkt aktiv ist.
 * - Hat der Artikel keine Zeitfenster aktiviert: immer aktiv (true).
 * - Hat der Artikel Zeitfenster aktiviert, aber keine Einträge: immer aktiv (true).
 * - Liegt die aktuelle Zeit in mindestens einem der definierten Zeitfenster: aktiv (true).
 * - Liegt die Zeit außerhalb aller Fenster: inaktiv (false).
 */
export function isProductActiveNow(
  product: { hasTimeWindows?: boolean | null; timeWindows?: string | TimeWindow[] | null },
  currentDate: Date = new Date()
): boolean {
  if (!product || !product.hasTimeWindows) {
    return true;
  }

  const windows = parseTimeWindows(product.timeWindows);
  if (windows.length === 0) {
    return true;
  }

  const currentHours = String(currentDate.getHours()).padStart(2, '0');
  const currentMinutes = String(currentDate.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${currentHours}:${currentMinutes}`;
  const currentDay = currentDate.getDay(); // 0 = So, 1 = Mo, ..., 6 = Sa

  for (const win of windows) {
    if (!win.startTime || !win.endTime) continue;

    // Wochentags-Filter prüfen (falls definiert und nicht leer)
    if (Array.isArray(win.days) && win.days.length > 0) {
      if (!win.days.includes(currentDay)) {
        continue;
      }
    }

    const start = win.startTime.trim();
    const end = win.endTime.trim();

    if (start <= end) {
      // Normales Tageszeitfenster (z. B. 11:30 bis 14:00)
      if (currentTimeStr >= start && currentTimeStr <= end) {
        return true;
      }
    } else {
      // Mitternachtsüberschreitendes Zeitfenster (z. B. 21:00 bis 03:00)
      if (currentTimeStr >= start || currentTimeStr <= end) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Liefert eine kurze, lesbare Zusammenfassung der hinterlegten Zeitfenster.
 */
export function getTimeWindowSummary(
  product: { hasTimeWindows?: boolean | null; timeWindows?: string | TimeWindow[] | null }
): string {
  if (!product || !product.hasTimeWindows) {
    return 'Immer verfügbar';
  }

  const windows = parseTimeWindows(product.timeWindows);
  if (windows.length === 0) {
    return 'Immer verfügbar';
  }

  return windows
    .map((w) => {
      const timeStr = `${w.startTime} - ${w.endTime} Uhr`;
      if (Array.isArray(w.days) && w.days.length > 0 && w.days.length < 7) {
        const dayStr = w.days.map((d) => WEEKDAY_LABELS[d] || String(d)).join(', ');
        return `${timeStr} (${dayStr})`;
      }
      return timeStr;
    })
    .join(' · ');
}
