/**
 * Compliance & Jugendschutz-Engine (Spec V2 §6.1 & §6.4).
 *
 * Beinhaltet:
 * 1. Taggenaue Berechnung des Mindestgeburtsdatums fuer die Alterskontrolle
 * 2. 14 EU-Hauptallergene gemaess LMIV (Lebensmittelinformations-Verordnung)
 * 3. Gesetzliche Zusatzstoffe
 */

export interface MinBirthdateResult {
  minAge: number;
  birthdate: Date;
  formattedDate: string; // Format: DD.MM.YYYY
  isoDate: string;       // Format: YYYY-MM-DD
}

/**
 * Berechnet das Mindestgeburtsdatum fuer ein vorgegebenes Mindestalter (z. B. 16 oder 18 Jahre)
 * bezogen auf das aktuelle Datum (oder ein Referenzdatum).
 */
export function calculateMinBirthdate(minAge: number, referenceDate: Date = new Date()): MinBirthdateResult {
  const birthdate = new Date(referenceDate);
  birthdate.setFullYear(birthdate.getFullYear() - minAge);

  const day = birthdate.getDate().toString().padStart(2, '0');
  const month = (birthdate.getMonth() + 1).toString().padStart(2, '0');
  const year = birthdate.getFullYear().toString();

  return {
    minAge,
    birthdate,
    formattedDate: `${day}.${month}.${year}`,
    isoDate: `${year}-${month}-${day}`,
  };
}

export interface AllergenDefinition {
  code: string;
  name: string;
  description: string;
}

/**
 * Die 14 offiziellen EU-Hauptallergene gemaess LMIV (Anhang II VO (EU) Nr. 1169/2011)
 */
export const EU_ALLERGENS: AllergenDefinition[] = [
  { code: 'GLUTEN', name: 'Glutenhaltiges Getreide', description: 'Weizen, Roggen, Gerste, Hafer, Dinkel, Kamut' },
  { code: 'KREBSTIERE', name: 'Krebstiere', description: 'Krebse, Garnelen, Krabben, Hummer' },
  { code: 'EIER', name: 'Eier', description: 'Gefluegeleier und Eierzeugnisse' },
  { code: 'FISCH', name: 'Fische', description: 'Fische und Fischerzeugnisse' },
  { code: 'ERDNUESSE', name: 'Erdnüsse', description: 'Erdnuesse und Erdnusserzeugnisse' },
  { code: 'SOJA', name: 'Sojabohnen', description: 'Soja und Sojaerzeugnisse' },
  { code: 'MILCH', name: 'Milch / Laktose', description: 'Kuhmilch, Schafmilch, Kaese, Butter, Joghurt' },
  { code: 'SCHALENFRUECHTE', name: 'Schalenfrüchte / Nüsse', description: 'Mandeln, Haselnuesse, Walnuesse, Cashew, Pecan, Pistazien' },
  { code: 'SELLERIE', name: 'Sellerie', description: 'Staudensellerie, Knollensellerie und Erzeugnisse' },
  { code: 'SENF', name: 'Senf', description: 'Senfsaat, Senfpulver und Erzeugnisse' },
  { code: 'SESAM', name: 'Sesamsamen', description: 'Sesamsamen und Sesamerzeugnisse' },
  { code: 'SULFITE', name: 'Schwefeldioxid / Sulfite', description: 'Ab 10 mg/kg oder 10 mg/l (z. B. Wein, Trockenobst)' },
  { code: 'LUPINEN', name: 'Lupinen', description: 'Lupinenmehl, Lupinensamen' },
  { code: 'WEICHTIERE', name: 'Weichtiere', description: 'Schnecken, Muscheln, Tintenfische, Oktopus' },
];

export interface AdditiveDefinition {
  code: string;
  name: string;
}

/**
 * Gesetzliche Zusatzstoffe (Gastro-Kennzeichnung)
 */
export const GASTRONOMY_ADDITIVES: AdditiveDefinition[] = [
  { code: 'FARBSTOFF', name: 'Mit Farbstoff' },
  { code: 'KONSERVIERUNGSSTOFF', name: 'Mit Konservierungsstoff' },
  { code: 'ANTIOXIDATIONSMITTEL', name: 'Mit Antioxidationsmittel' },
  { code: 'GESCHMACKSVERSTAERKER', name: 'Mit Geschmacksverstärker' },
  { code: 'GESCHWEFELT', name: 'Geschwefelt' },
  { code: 'GESCHWAERZT', name: 'Geschwärzt' },
  { code: 'GEWACHST', name: 'Gewachst' },
  { code: 'PHOSPHAT', name: 'Mit Phosphat' },
  { code: 'SUESSUNGSMITTEL', name: 'Mit Süßungsmittel' },
  { code: 'KOFFEIN', name: 'Koffeinhaltig' },
  { code: 'CHININ', name: 'Chininhaltig' },
];

/**
 * Filtert eine Artikelliste nach unerwuenschten Allergenen
 */
export function filterProductsByExcludedAllergens<T extends { allergens?: string | null }>(
  products: T[],
  excludedAllergenCodes: string[]
): T[] {
  if (!excludedAllergenCodes || excludedAllergenCodes.length === 0) {
    return products;
  }

  return products.filter((p) => {
    if (!p.allergens) return true;
    try {
      const productAllergens: string[] = JSON.parse(p.allergens);
      if (!Array.isArray(productAllergens)) return true;
      // Wenn das Produkt mindestens eines der ausgeschlossenen Allergene enthaelt, wird es ausgeblendet
      const hasExcluded = productAllergens.some((a) => excludedAllergenCodes.includes(a));
      return !hasExcluded;
    } catch {
      return true;
    }
  });
}
