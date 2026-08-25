import { describe, it, expect } from 'vitest';
import {
  AtomicCheckoutSchema,
  CreatePaymentSchema,
  validateBody,
} from '../lib/validations/schemas';

describe('Atomic Checkout & Payment Validierung', () => {
  it('AtomicCheckoutSchema: gültiger Thekenverkauf wird akzeptiert und normalisiert', () => {
    const parsed = AtomicCheckoutSchema.safeParse({
      orderType: 'COUNTER_VOUCHER',
      waiterName: 'Bonkasse 1',
      paymentMethod: 'CASH',
      givenAmount: 20,
      items: [{ productId: 'prod-1', quantity: 2 }],
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.source).toBe('POS_CASHIER');
      expect(parsed.data.printReceipt).toBe(false);
      expect(parsed.data.openDrawer).toBe(true);
      expect(parsed.data.items[0].courseNumber).toBe(1);
    }
  });

  it('AtomicCheckoutSchema: leere Bestellung wird abgelehnt', () => {
    const parsed = AtomicCheckoutSchema.safeParse({
      orderType: 'COUNTER_DIRECT',
      items: [],
    });
    expect(parsed.success).toBe(false);
  });

  it('AtomicCheckoutSchema: negativer Betrag wird abgelehnt', () => {
    const parsed = AtomicCheckoutSchema.safeParse({
      orderType: 'COUNTER_DIRECT',
      givenAmount: -5,
      items: [{ productId: 'prod-1', quantity: 1 }],
    });
    expect(parsed.success).toBe(false);
  });

  it('CreatePaymentSchema: Rückpfand-only-Zahlung ohne Positionen bleibt erlaubt', () => {
    // Der Route-Handler prüft die Kombination selbst – das Schema darf
    // itemsToPay nicht auf min(1) erzwingen, sonst bricht die reine
    // Pfandrücknahme an der Theke.
    const parsed = CreatePaymentSchema.safeParse({
      returnDepositAmount: 3.5,
      itemsToPay: [],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.returnDepositAmount).toBe(3.5);
      expect(parsed.data.paymentMethod).toBe('CASH');
    }
  });

  it('CreatePaymentSchema: requestId & openDrawer werden durchgereicht (Zod strippt sie nicht mehr)', () => {
    const parsed = CreatePaymentSchema.safeParse({
      requestId: 'req-abc-123',
      openDrawer: false,
      nonPaidReason: 'Personalverzehr',
      paymentMethod: 'NON_PAID_STAFF',
      itemsToPay: [
        { productName: 'Bratwurst', quantityToPay: 1, unitPrice: 4 },
      ],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.requestId).toBe('req-abc-123');
      expect(parsed.data.openDrawer).toBe(false);
      expect(parsed.data.nonPaidReason).toBe('Personalverzehr');
    }
  });

  it('validateBody: ungültiger JSON-Body ergibt strukturierten 400-Fehler', async () => {
    const req = new Request('http://localhost/api/payments', {
      method: 'POST',
      body: 'kein json',
    });
    const result = await validateBody(req, CreatePaymentSchema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.response.status).toBe(400);
    }
  });
});
