/**
 * OpenBon - PDF-Speisekarten Extraktor
 * Analysiert den Text aus hochgeladenen PDF-Speisekarten und erkennt automatisch:
 * - Artikelnamen
 * - Preise (€ / EUR / Kommazahlen)
 * - Warengruppen / Kategorien (Getränke, Speisen, Grill, Kuchen etc.)
 * - Steuersatz (7% für Speisen, 19% für Getränke)
 */

import { PDFParse } from 'pdf-parse';

export interface ParsedMenuItem {
  id: string;
  name: string;
  price: number; // In Euro z. B. 4.50
  category: string;
  taxRate: number; // 7 oder 19
  selected: boolean;
  confidence: number; // 0.0 - 1.0
  rawLine?: string;
}

const KNOWN_CATEGORIES = [
  'Speisen',
  'Getränke',
  'Alkoholfreie Getränke',
  'Bier & Wein',
  'Warme Speisen',
  'Vom Grill',
  'Kaffee & Kuchen',
  'Brotzeiten',
  'Snacks',
  'Salate',
  'Desserts',
  'Kindergerichte',
  'Spirituosen & Bar',
];

const DRINK_KEYWORDS = [
  'bier', 'pils', 'weizen', 'radler', 'helles', 'dunkles',
  'cola', 'fanta', 'spezi', 'sprite', 'limonade', 'wasser', 'sprudel',
  'saft', 'schorle', 'apfelschorle', 'wein', 'weißwein', 'rotwein',
  'rosé', 'sekt', 'prosecco', 'aperol', 'hugo', 'schnaps', 'likör',
  'kaffee', 'cappuccino', 'espresso', 'tee', 'latte', 'kakao',
  '0,33l', '0,5l', '0,2l', '0,4l', '0,25l', 'flasche', 'glas', 'tasse'
];

const FOOD_KEYWORDS = [
  'wurst', 'bratwurst', 'currywurst', 'pommes', 'frites', 'schnitzel',
  'steak', 'hähnchen', 'burger', 'semmel', 'brötchen', 'brot',
  'brezel', 'käse', 'salat', 'suppe', 'kuchen', 'torte', 'muffin',
  'fleisch', 'fisch', 'nuggets', 'leberkäse', 'schaschlik', 'pizza',
  'portion', 'teller', 'kartoffelsalat', 'sauerkraut', 'döner'
];

/**
 * Liest den Rohtext aus einem PDF-Buffer.
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  let parser: PDFParse | null = null;
  try {
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return result.text || '';
  } finally {
    if (parser) {
      await parser.destroy().catch(() => {});
    }
  }
}

/**
 * Bereinigt Zeilen und filtert Artefakte oder leere Zeilen heraus.
 */
function cleanLine(line: string): string {
  return line
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Prüft, ob eine Zeile eine Kategorie-Überschrift darstellt.
 */
function matchCategoryHeading(line: string, knownCategories: string[]): string | null {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > 50) return null;

  // Wenn ein Preis in der Zeile ist, ist es keine reine Überschrift
  if (/\d+([.,]\d{2}|,-)/.test(trimmed)) return null;

  const lower = trimmed.toLowerCase();

  for (const cat of [...knownCategories, ...KNOWN_CATEGORIES]) {
    if (lower === cat.toLowerCase() || lower.startsWith(cat.toLowerCase() + ':')) {
      return cat;
    }
  }

  // Häufige Muster wie "1. GETRÄNKE" oder "UNSERE SPEISEN"
  if (lower.includes('getränk') || lower.includes('alkohol') || lower.includes('durst')) {
    return 'Getränke';
  }
  if (lower.includes('speis') || lower.includes('essen') || lower.includes('grill') || lower.includes('hunger')) {
    return 'Speisen';
  }
  if (lower.includes('kuchen') || lower.includes('kaffee') || lower.includes('torten')) {
    return 'Kaffee & Kuchen';
  }

  return null;
}

/**
 * Erkennt Artikel und Preise aus formatiertem oder freiem Text.
 */
export function parseMenuFromText(
  text: string,
  existingCategories: string[] = []
): ParsedMenuItem[] {
  const items: ParsedMenuItem[] = [];
  const lines = text.split(/\r?\n/).map(cleanLine).filter(Boolean);

  let currentCategory = 'Speisen';
  let counter = 1;

  // Regex für Preise am Ende der Zeile oder freistehend:
  // z.B. "4,50 €", "4.50 EUR", " 4,50", "4,- €", "€ 4.50"
  const priceRegex = /(?:(?:€|EUR)\s*)?(\d{1,3}(?:[.,]\d{2}|,-))\s*(?:€|EUR)?$/i;
  const embeddedPriceRegex = /(?:(?:€|EUR)\s*)?(\d{1,3}(?:[.,]\d{2}|,-))\s*(?:€|EUR)?/gi;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Ignoriere Seitenzahlen oder Trennlinien
    if (/^--\s*\d+\s*(of\s*\d+)?\s*--$/i.test(line)) continue;
    if (/^seite\s*\d+/i.test(line)) continue;
    if (line.length < 3) continue;

    // Prüfe auf Kategorie-Überschrift
    const detectedCategory = matchCategoryHeading(line, existingCategories);
    if (detectedCategory) {
      currentCategory = detectedCategory;
      continue;
    }

    // Prüfe auf Artikelzeile mit Preis
    let match = line.match(priceRegex);
    let name = '';
    let priceVal = 0;

    if (match) {
      const rawPrice = match[1].replace(',-', ',00').replace(',', '.');
      priceVal = parseFloat(rawPrice);
      name = line.substring(0, match.index).trim();
    } else {
      // Eventuell Preis irgendwo im Text, z. B. "Bratwurst 4,50 EUR mit Senf"
      const allMatches = Array.from(line.matchAll(embeddedPriceRegex));
      if (allMatches.length > 0) {
        const lastMatch = allMatches[allMatches.length - 1];
        if (lastMatch && typeof lastMatch.index === 'number') {
          const rawPrice = lastMatch[1].replace(',-', ',00').replace(',', '.');
          priceVal = parseFloat(rawPrice);
          // Name ist der Text vor dem Preis (oder rundherum)
          const before = line.substring(0, lastMatch.index).trim();
          const after = line.substring(lastMatch.index + lastMatch[0].length).trim();
          name = [before, after].filter(Boolean).join(' ');
        }
      }
    }

    // Wenn in der aktuellen Zeile kein Preis gefunden wurde, aber in der nächsten Zeile NUR ein Preis steht:
    if ((!name || isNaN(priceVal) || priceVal <= 0) && i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      const nextMatch = nextLine.match(priceRegex);
      if (nextMatch && nextLine.trim() === nextMatch[0].trim()) {
        const rawPrice = nextMatch[1].replace(',-', ',00').replace(',', '.');
        priceVal = parseFloat(rawPrice);
        name = line.trim();
        i++; // Nächste Zeile überspringen
      }
    }

    // Bereinige Name (Punkte, Striche am Ende entfernen)
    name = name
      .replace(/[.\-_~=*]+$/g, '')
      .replace(/^[.\-_~=*]+/g, '')
      .trim();

    // Plausibilitätsprüfungen für einen Artikel:
    // - Name mind. 2 Zeichen lang
    // - Preis zwischen 0.10 € und 500.00 €
    // - Nicht nur Zahlen
    if (name.length >= 2 && !isNaN(priceVal) && priceVal >= 0.10 && priceVal <= 500) {
      // Intelligente Kategorie- und Steuerzuweisung:
      const nameLower = name.toLowerCase();
      let itemCategory = currentCategory;
      let taxRate = 7;

      const isDrink = DRINK_KEYWORDS.some((kw) => nameLower.includes(kw));
      const isFood = FOOD_KEYWORDS.some((kw) => nameLower.includes(kw));

      if (isDrink && !isFood) {
        if (!itemCategory.toLowerCase().includes('getränk') && !itemCategory.toLowerCase().includes('bar')) {
          itemCategory = 'Getränke';
        }
        taxRate = 19;
      } else if (isFood) {
        if (itemCategory.toLowerCase().includes('getränk')) {
          itemCategory = 'Speisen';
        }
        taxRate = 7;
      } else {
        // Fallback gemäß übergeordneter Kategorie
        if (itemCategory.toLowerCase().includes('getränk') || itemCategory.toLowerCase().includes('wein') || itemCategory.toLowerCase().includes('bier') || itemCategory.toLowerCase().includes('bar')) {
          taxRate = 19;
        } else {
          taxRate = 7;
        }
      }

      // Confidence-Score berechnen
      let confidence = 0.8;
      if (isDrink || isFood) confidence += 0.15;
      if (name.length > 5) confidence += 0.05;
      confidence = Math.min(1.0, confidence);

      items.push({
        id: `pdf_item_${Date.now()}_${counter++}`,
        name,
        price: Math.round(priceVal * 100) / 100,
        category: itemCategory,
        taxRate,
        selected: true,
        confidence,
        rawLine: line,
      });
    }
  }

  return items;
}

/**
 * Kombiniert Extraktion und Parsing direkt aus PDF-Buffer.
 */
export async function parsePdfMenu(
  buffer: Buffer,
  existingCategories: string[] = []
): Promise<ParsedMenuItem[]> {
  const text = await extractTextFromPdf(buffer);
  return parseMenuFromText(text, existingCategories);
}
