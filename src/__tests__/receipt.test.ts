import { describe, it, expect } from 'vitest';
import { generateDigitalReceiptCode, buildReceiptUrl } from '../lib/digital-receipt';

describe('Digital Receipt & E-Bon (§33 KassenSichV - Spec V2 §5.2)', () => {
  it('should generate properly formatted digital receipt codes', () => {
    const code1 = generateDigitalReceiptCode('BELEG-2026-00001');
    const code2 = generateDigitalReceiptCode('BELEG-2026-00002');

    expect(code1).toMatch(/^EBON-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/);
    expect(code2).toMatch(/^EBON-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/);
    expect(code1).not.toBe(code2);
  });

  it('should construct valid public receipt URLs', () => {
    const code = 'EBON-ABCD-1234-EF56-7890';
    const url1 = buildReceiptUrl('http://openbon.local', code);
    const url2 = buildReceiptUrl('http://openbon.local/', code);

    expect(url1).toBe('http://openbon.local/receipt/EBON-ABCD-1234-EF56-7890');
    expect(url2).toBe('http://openbon.local/receipt/EBON-ABCD-1234-EF56-7890');
  });
});
