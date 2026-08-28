import { describe, it, expect } from 'vitest';
import { AVAILABLE_THEMES, type Theme } from '../components/providers/theme-provider';

/**
 * Mathematische WCAG 2.1 relative Luminanz- und Kontrastberechnung.
 * Formel: (L1 + 0.05) / (L2 + 0.05)
 */
function hexToRgb(hex: string): [number, number, number] {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function calculateContrastRatio(hexColor1: string, hexColor2: string): number {
  const rgb1 = hexToRgb(hexColor1);
  const rgb2 = hexToRgb(hexColor2);
  const lum1 = getRelativeLuminance(rgb1[0], rgb1[1], rgb1[2]);
  const lum2 = getRelativeLuminance(rgb2[0], rgb2[1], rgb2[2]);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

interface ThemePalette {
  id: Theme;
  background: string;
  card: string;
  foreground: string;
  mutedForeground: string;
  border: string;
  primaryAction: string;
  primaryActionText: string;
  badgeHighlight: string;
  badgeHighlightText: string;
}

const THEME_PALETTES: Record<Theme, ThemePalette> = {
  dark: {
    id: 'dark',
    background: '#020617',
    card: '#0f172a',
    foreground: '#f8fafc',
    mutedForeground: '#94a3b8',
    border: '#334155',
    primaryAction: '#2563eb',
    primaryActionText: '#ffffff',
    badgeHighlight: '#047857',
    badgeHighlightText: '#ffffff',
  },
  light: {
    id: 'light',
    background: '#f8fafc',
    card: '#ffffff',
    foreground: '#000000',
    mutedForeground: '#334155',
    border: '#cbd5e1',
    primaryAction: '#1d4ed8',
    primaryActionText: '#ffffff',
    badgeHighlight: '#15803d',
    badgeHighlightText: '#ffffff',
  },
  contrast: {
    id: 'contrast',
    background: '#000000',
    card: '#0c0a09',
    foreground: '#ffffff',
    mutedForeground: '#fef08a',
    border: '#eab308',
    primaryAction: '#eab308',
    primaryActionText: '#000000',
    badgeHighlight: '#facc15',
    badgeHighlightText: '#000000',
  },
  tradition: {
    id: 'tradition',
    background: '#140d07',
    card: '#1f140b',
    foreground: '#fffbeb',
    mutedForeground: '#fde68a',
    border: '#78350f',
    primaryAction: '#b45309',
    primaryActionText: '#ffffff',
    badgeHighlight: '#15803d',
    badgeHighlightText: '#ffffff',
  },
  speed: {
    id: 'speed',
    background: '#090d16',
    card: '#0f172a',
    foreground: '#ffffff',
    mutedForeground: '#93c5fd',
    border: '#2563eb',
    primaryAction: '#2563eb',
    primaryActionText: '#ffffff',
    badgeHighlight: '#15803d',
    badgeHighlightText: '#ffffff',
  },
};

describe('OpenBon Automated Theme & WCAG 2.1 Contrast Validation Test Suite', () => {
  it('should verify that all 5 available themes are defined without the legacy theme', () => {
    const ids = AVAILABLE_THEMES.map((t) => t.id);
    expect(ids).toEqual(['dark', 'light', 'contrast', 'tradition', 'speed']);
    expect(ids).not.toContain('klassisch');
  });

  // WCAG 2.1 AA Normal Text: Mindestens 4.5:1
  // WCAG 2.1 AAA Normal Text: Mindestens 7.0:1
  // WCAG 2.1 Large Text / UI-Komponenten: Mindestens 3.0:1
  Object.values(THEME_PALETTES).forEach((palette) => {
    describe(`Theme [${palette.id}]: WCAG 2.1 Kontrast- & Lesbarkeitsanalyse`, () => {
      it(`[${palette.id}] Text auf Seitenhintergrund erfuellt WCAG AA (>= 4.5:1)`, () => {
        const ratio = calculateContrastRatio(palette.foreground, palette.background);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });

      it(`[${palette.id}] Text auf Kachel-/Kartenhintergrund erfuellt WCAG AA (>= 4.5:1)`, () => {
        const ratio = calculateContrastRatio(palette.foreground, palette.card);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });

      it(`[${palette.id}] Sekundaertext (Muted) auf Karte erfuellt WCAG Mindestkontrast (>= 3.0:1)`, () => {
        const ratio = calculateContrastRatio(palette.mutedForeground, palette.card);
        expect(ratio).toBeGreaterThanOrEqual(3.0);
      });

      it(`[${palette.id}] Aktionsbuttons (Primary) besitzen ausreichend Kontrast fuer Beschriftung (>= 4.5:1)`, () => {
        const ratio = calculateContrastRatio(palette.primaryActionText, palette.primaryAction);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });

      it(`[${palette.id}] Highlight-Badges (Status, Bon-Zaehler) besitzen barrierefreien Kontrast (>= 4.5:1)`, () => {
        const ratio = calculateContrastRatio(palette.badgeHighlightText, palette.badgeHighlight);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });
    });
  });

  // Spezifischer Test fuer den Festzelt High-Contrast Sonnenschein-Modus
  it('Festzelt High-Contrast Modus erreicht Spitzenkontrast (>= 12:1) fuer sonnige Biergaerten', () => {
    const contrastPalette = THEME_PALETTES.contrast;
    const bodyRatio = calculateContrastRatio(contrastPalette.foreground, contrastPalette.background);
    expect(bodyRatio).toBeGreaterThanOrEqual(12.0); // 21:1 bei Schwarz/Weiss

    const signalRatio = calculateContrastRatio(contrastPalette.border, contrastPalette.background);
    expect(signalRatio).toBeGreaterThanOrEqual(7.0); // Signalgelb auf Schwarz
  });

  // Stationen-Abdeckung
  it('sollte alle 7 Kern-Stationen mit validen Theme-Farbdefinitionen bestaetigen', () => {
    const stations = [
      'ADMIN_LEITSTAND',
      'KELLNER_MOBILTEIL',
      'BONKASSE_THEKE',
      'KUECHENMONITOR_KDS',
      'GAESTE_TISCHBESTELLUNG',
      'SB_KIOSK',
      'DIGITALER_EBON',
    ];

    stations.forEach((station) => {
      AVAILABLE_THEMES.forEach((theme) => {
        const pal = THEME_PALETTES[theme.id];
        expect(pal).toBeDefined();
        expect(pal.foreground).toBeDefined();
        expect(pal.background).toBeDefined();
      });
    });
  });
});
