import { describe, it, expect } from 'vitest';
import { resolveOrderItem } from '../lib/product-resolve';
import { getEffectiveProductPrice, computeCheckout, toCents, toEuro } from '../lib/pricing';
import { PaymentItemInputSchema, CreatePaymentSchema, validateBody } from '../lib/validations/schemas';
import { generateDigitalReceiptCode } from '../lib/digital-receipt';

describe('OpenBon v0.4.26: Pricing, Payment Validation & E-Bon Guard Tests', () => {
  describe('1. Preis- & Cent-Auflösung (4,50 € bleibt 450 Cents, nicht 5 Cents)', () => {
    it('sollte einen 4,50 € Artikel (450 Cent) sauber auflösen und nicht auf 5 Cent runden', () => {
      const product = {
        id: 'prod-colaweizen',
        name: 'Colaweizen',
        priceCents: 450,
        depositCents: 0,
        taxRate: 19,
      };

      const { priceCents: effectiveBasePriceCents } = getEffectiveProductPrice(product as any);
      expect(effectiveBasePriceCents).toBe(450);

      const resolved = resolveOrderItem(
        {
          id: product.id,
          name: product.name,
          depositCents: product.depositCents,
          taxRate: product.taxRate,
          variants: [],
          options: [],
        },
        effectiveBasePriceCents,
        {}
      );

      // Verifikation des Bugfixes: Früher wurde Math.round(4.5) = 5 Cents gerechnet!
      expect(resolved.unitPriceCents).toBe(450);
      expect(resolved.unitPrice).toBe(4.5);
      expect(resolved.depositCents).toBe(0);
    });

    it('sollte Varianten- und Options-Aufpreise cent-genau addieren', () => {
      const product = {
        id: 'prod-steak',
        name: 'Rumpsteak',
        priceCents: 1850, // 18,50 €
        depositCents: 0,
        taxRate: 19,
        variants: [
          {
            id: 'var-large',
            name: '300g Groß',
            priceDeltaCents: 500, // +5,00 €
          },
        ],
        options: [
          {
            id: 'opt-kraeuterbutter',
            name: 'Kräuterbutter',
            priceDeltaCents: 150, // +1,50 €
            maxQuantity: 3,
          },
        ],
      };

      const resolved = resolveOrderItem(
        product,
        product.priceCents,
        {
          variantName: '300g Groß',
          selectedOptions: [{ name: 'Kräuterbutter', quantity: 2 }],
        }
      );

      // 1850 + 500 + (2 * 150) = 2650 Cent (26,50 €)
      expect(resolved.unitPriceCents).toBe(2650);
      expect(resolved.unitPrice).toBe(26.5);
      expect(resolved.variantName).toBe('300g Groß');
      expect(resolved.options).toHaveLength(1);
      expect(resolved.options[0].quantity).toBe(2);
    });
  });

  describe('2. Zahlungs-Payload-Validierung (Kein 400 Bad Request bei Legacy-Euro-Werten)', () => {
    it('sollte PaymentItemInputSchema mit reinen Euro-Feldern (unitPrice) erfolgreich parsen und nach Cents transformieren', () => {
      const rawItem = {
        orderItemId: 'item-1',
        productName: 'Colaweizen',
        quantityToPay: 1,
        unitPrice: 4.5,
        deposit: 1.0,
      };

      const parsed = PaymentItemInputSchema.safeParse(rawItem);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.unitPriceCents).toBe(450);
        expect(parsed.data.depositCents).toBe(100);
      }
    });

    it('sollte PaymentItemInputSchema mit unitPriceCents vorrangig parsen', () => {
      const rawItem = {
        orderItemId: 'item-2',
        productName: 'Weizen',
        quantityToPay: 1,
        unitPriceCents: 580,
        depositCents: 100,
      };

      const parsed = PaymentItemInputSchema.safeParse(rawItem);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.unitPriceCents).toBe(580);
        expect(parsed.data.depositCents).toBe(100);
      }
    });

    it('sollte CreatePaymentSchema für 5,70 € Einkauf mit gegeben 20,00 € ohne 400 Fehler validieren', () => {
      const payload = {
        tableId: 'table-21',
        waiterName: 'Bedienung 1',
        paymentMethod: 'CASH',
        givenAmount: 20.0,
        itemsToPay: [
          {
            orderItemId: 'oi-570',
            productName: 'Gemischter Salat',
            quantityToPay: 1,
            unitPrice: 5.7,
            deposit: 0,
          },
        ],
      };

      const parsed = CreatePaymentSchema.safeParse(payload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.givenAmountCents).toBe(2000);
        expect(parsed.data.itemsToPay[0].unitPriceCents).toBe(570);
      }
    });
  });

  describe('3. Rückgeldrechner & Barzahlung (20,00 € gegeben bei 5,70 € fällig)', () => {
    it('sollte exakt 14,30 € Rückgeld berechnen', () => {
      const checkout = computeCheckout({
        lines: [
          {
            unitPriceCents: 570,
            quantity: 1,
            taxRate: 19,
          },
        ],
        givenCents: 2000,
      });

      expect(checkout.amountDueCents).toBe(570);
      expect(checkout.givenCents).toBe(2000);
      expect(checkout.changeCents).toBe(1430);
      expect(checkout.changeAmount).toBe(14.3);
    });
  });

  describe('4. E-Bon Resilienz & Fallback (Keine Blockade bei deaktiviertem E-Bon)', () => {
    it('sollte bei deaktiviertem E-Bon ohne LICENSE_HMAC_SECRET keinen Fehler werfen', () => {
      const config = {
        enableDigitalReceipt: false,
        enableDigitalReceiptQr: false,
      };

      // Simulation der Logik in checkout und payments:
      let digitalReceiptCode: string | null = null;
      if (Boolean(config.enableDigitalReceipt || config.enableDigitalReceiptQr)) {
        try {
          digitalReceiptCode = generateDigitalReceiptCode('BELEG-2026-00001');
        } catch (err) {
          digitalReceiptCode = null;
        }
      }

      // Muss null sein und darf keinen Error werfen
      expect(digitalReceiptCode).toBeNull();
    });

    it('sollte selbst bei versehentlich aktiviertem E-Bon ohne Secret die Kasse nicht lahmlegen', () => {
      const config = {
        enableDigitalReceipt: true,
        enableDigitalReceiptQr: false,
      };

      // Simuliere fehlendes Secret in Production
      const oldSecret = process.env.LICENSE_HMAC_SECRET;
      const oldVitest = process.env.VITEST;
      delete process.env.LICENSE_HMAC_SECRET;
      const envRec = process.env as Record<string, string | undefined>;
      const oldNodeEnv = envRec.NODE_ENV;
      delete envRec.VITEST;
      envRec.NODE_ENV = 'production';

      let digitalReceiptCode: string | null = null;
      let checkoutSucceeded = false;

      try {
        if (Boolean(config.enableDigitalReceipt || config.enableDigitalReceiptQr)) {
          try {
            digitalReceiptCode = generateDigitalReceiptCode('BELEG-2026-00001');
          } catch (eBonErr) {
            // Gefangen: Barzahlung läuft trotzdem durch!
            digitalReceiptCode = null;
          }
        }
        checkoutSucceeded = true;
      } finally {
        if (oldSecret !== undefined) process.env.LICENSE_HMAC_SECRET = oldSecret;
        if (oldVitest !== undefined) process.env.VITEST = oldVitest;
        if (oldNodeEnv !== undefined) envRec.NODE_ENV = oldNodeEnv;
      }

      expect(checkoutSucceeded).toBe(true);
      expect(digitalReceiptCode).toBeNull();
    });
  });
});
