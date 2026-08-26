import { describe, it, expect } from 'vitest';
import { parseSelectedOptions, computeConsumption } from '../lib/stock';

describe('Inventory & Recipe Consumption Logic', () => {
  it('should parse simple string options and complex object options uniformly', () => {
    const legacy = parseSelectedOptions(['ohne Senf', 'extra Ketchup']);
    expect(legacy).toEqual([
      { name: 'ohne Senf', quantity: 1 },
      { name: 'extra Ketchup', quantity: 1 },
    ]);

    const modern = parseSelectedOptions([
      { name: 'Bratwurst', quantity: 2 },
      { name: 'Leberwurst', quantity: 1 },
    ]);
    expect(modern).toEqual([
      { name: 'Bratwurst', quantity: 2 },
      { name: 'Leberwurst', quantity: 1 },
    ]);

    const jsonString = parseSelectedOptions(
      JSON.stringify([{ name: 'Ketchup', quantity: 3 }])
    );
    expect(jsonString).toEqual([{ name: 'Ketchup', quantity: 3 }]);
  });
});
