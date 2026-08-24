import { describe, it, expect } from 'vitest';
import {
  calculateMinBirthdate,
  EU_ALLERGENS,
  filterProductsByExcludedAllergens,
} from '../lib/compliance';

describe('Compliance & Jugendschutz & Allergene (Spec V2 §6.1, §6.4)', () => {
  it('should calculate minimum birthdate exactly for 16 and 18 years', () => {
    const refDate = new Date('2026-08-24T12:00:00Z');

    const result16 = calculateMinBirthdate(16, refDate);
    expect(result16.minAge).toBe(16);
    expect(result16.formattedDate).toBe('24.08.2010');
    expect(result16.isoDate).toBe('2010-08-24');

    const result18 = calculateMinBirthdate(18, refDate);
    expect(result18.minAge).toBe(18);
    expect(result18.formattedDate).toBe('24.08.2008');
    expect(result18.isoDate).toBe('2008-08-24');
  });

  it('should include all 14 official EU allergens', () => {
    expect(EU_ALLERGENS.length).toBe(14);
    const codes = EU_ALLERGENS.map((a) => a.code);
    expect(codes).toContain('GLUTEN');
    expect(codes).toContain('MILCH');
    expect(codes).toContain('EIER');
    expect(codes).toContain('ERDNUESSE');
    expect(codes).toContain('SCHALENFRUECHTE');
    expect(codes).toContain('SOJA');
    expect(codes).toContain('FISCH');
    expect(codes).toContain('KREBSTIERE');
    expect(codes).toContain('SELLERIE');
    expect(codes).toContain('SENF');
    expect(codes).toContain('SESAM');
    expect(codes).toContain('SULFITE');
    expect(codes).toContain('LUPINEN');
    expect(codes).toContain('WEICHTIERE');
  });

  it('should filter out products with excluded allergens', () => {
    const products = [
      { id: '1', name: 'Pommes frites (Glutenfrei)', allergens: '[]' },
      { id: '2', name: 'Bratwurstsemmel', allergens: JSON.stringify(['GLUTEN', 'SENF']) },
      { id: '3', name: 'Käsekuchen', allergens: JSON.stringify(['GLUTEN', 'MILCH', 'EIER']) },
    ];

    // Filter out Gluten
    const noGluten = filterProductsByExcludedAllergens(products, ['GLUTEN']);
    expect(noGluten.length).toBe(1);
    expect(noGluten[0].name).toBe('Pommes frites (Glutenfrei)');

    // Filter out Milch
    const noMilch = filterProductsByExcludedAllergens(products, ['MILCH']);
    expect(noMilch.length).toBe(2);
    expect(noMilch.map((p) => p.id)).toEqual(['1', '2']);

    // Empty filter returns all
    const all = filterProductsByExcludedAllergens(products, []);
    expect(all.length).toBe(3);
  });
});
