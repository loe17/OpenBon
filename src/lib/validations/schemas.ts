import { z } from 'zod';
import { NextResponse } from 'next/server';

export const OrderItemInputSchema = z.object({
  productId: z.string().min(1, 'Produkt-ID ist erforderlich'),
  quantity: z.number().int().positive('Menge muss positiv sein'),
  variantName: z.string().nullable().optional(),
  selectedOptions: z.union([z.array(z.string()), z.string()]).nullable().optional(),
  customizationText: z.string().nullable().optional(),
  courseNumber: z.number().int().min(1).default(1),
  isHold: z.boolean().default(false),
});

export const CreateOrderSchema = z.object({
  tableId: z.string().nullable().optional(),
  waiterId: z.string().nullable().optional(),
  waiterName: z.string().default('Bedienung'),
  deviceId: z.string().nullable().optional(),
  source: z.enum(['WAITER', 'GUEST_QR', 'KIOSK', 'POS_CASHIER']).default('WAITER'),
  orderType: z.enum(['TABLE', 'COUNTER_DIRECT', 'COUNTER_VOUCHER', 'DIRECT_SALE', 'VOUCHER', 'KIOSK']).default('TABLE'),
  idempotencyKey: z.string().optional(),
  items: z.array(OrderItemInputSchema).min(1, 'Bestellung muss mindestens einen Artikel enthalten'),
});

export const PaymentItemInputSchema = z.object({
  orderItemId: z.string().nullable().optional(),
  productName: z.string().min(1),
  quantityToPay: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  deposit: z.number().default(0),
  taxRate: z.number().default(19),
});

export const CreatePaymentSchema = z.object({
  tableId: z.string().nullable().optional(),
  orderId: z.string().nullable().optional(),
  waiterName: z.string().default('Bedienung'),
  deviceId: z.string().nullable().optional(),
  paymentMethod: z.enum([
    'CASH',
    'CARD_SUMUP',
    'CARD_VRPAY',
    'CARD_SPARKASSE',
    'CARD_TERMINAL',
    'TOKEN',
    'NON_PAID_STAFF',
    'NON_PAID_COMPLAINT',
    'VOID_UNPAID',
    'DISCOUNT',
  ]).default('CASH'),
  givenAmount: z.number().nonnegative().optional(),
  tipAmount: z.number().nonnegative().default(0),
  discountAmount: z.number().nonnegative().default(0),
  surchargeAmount: z.number().nonnegative().default(0),
  surchargePercent: z.number().nonnegative().default(0),
  surchargeReason: z.string().nullable().optional(),
  cardAuthCode: z.string().nullable().optional(),
  cardTerminalId: z.string().nullable().optional(),
  printReceipt: z.boolean().default(true),
  idempotencyKey: z.string().optional(),
  itemsToPay: z.array(PaymentItemInputSchema).min(1, 'Mindestens ein Artikel muss bezahlt werden'),
});

export const GuestOrderItemSchema = z.object({
  productId: z.string().min(1, 'Produkt-ID ist erforderlich'),
  quantity: z.number().int().positive().max(10, 'Maximal 10 Stück pro Position'),
  variantName: z.string().nullable().optional(),
  selectedOptions: z.union([z.array(z.string()), z.string()]).nullable().optional(),
  customizationText: z.string().nullable().optional(),
  courseNumber: z.number().int().default(1),
});

export const GuestOrderSchema = z.object({
  tableNumber: z.union([z.number().int().positive(), z.string().min(1)]),
  qrToken: z.string().optional(),
  items: z.array(GuestOrderItemSchema).min(1, 'Bestellung muss mindestens einen Artikel enthalten').max(20, 'Maximal 20 Artikel'),
  guestNote: z.string().nullable().optional(),
});

export const CreateProductCategorySchema = z.object({
  name: z.string().min(1, 'Kategoriename ist erforderlich'),
  sortIndex: z.number().int().default(0),
  color: z.string().optional().default('#3b82f6'),
  icon: z.string().optional().default('Utensils'),
});

export const CreatePrinterSchema = z.object({
  name: z.string().min(1, 'Druckername ist erforderlich'),
  ipAddress: z.string().min(1, 'IP-Adresse ist erforderlich'),
  port: z.number().int().positive().default(9100),
  paperWidth: z.number().int().default(80),
  characterSet: z.string().default('CP858'),
  isVirtual: z.boolean().default(false),
});

/**
 * Validierungs-Wrapper für API-Routen. Fängt Zod-Fehler ab und gibt lesbare 400-Fehlermeldungen zurück.
 */
export async function validateBody<T>(
  req: Request,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; response: NextResponse }> {
  try {
    const json = await req.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      const errorDetails = parsed.error.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ');
      return {
        success: false,
        response: NextResponse.json(
          {
            error: 'Ungültige Eingabedaten',
            details: errorDetails,
            validationErrors: parsed.error.flatten(),
          },
          { status: 400 }
        ),
      };
    }
    return { success: true, data: parsed.data };
  } catch (err) {
    return {
      success: false,
      response: NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 }),
    };
  }
}
