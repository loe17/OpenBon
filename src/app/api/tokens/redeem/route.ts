import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { requireApiAuth } from '@/lib/api-guard';
import { z } from 'zod';
import { validateBody } from '@/lib/validations/schemas';
import { checkSimpleRateLimit, registerSimpleAttempt, getClientKey } from '@/lib/rate-limiter';
import { logSystemActionSafe } from '@/lib/action-logger';
import { toCents } from '@/lib/pricing';

const RedeemSchema = z.object({
  code: z.string().min(4).max(64),
  quantity: z.number().int().positive().max(50).default(1),
});

/**
 * Wertmarken-Einlösen per Code (QR/Barcode-Text). Schreibt REDEEM-Transaktion + Audit.
 * Guthaben-Konto folgt in Ausbaustufe; dieser Schritt verhindert unprotokolliertes Einlösen.
 */
export async function POST(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;
  const rlKey = getClientKey(req, 'token-redeem');
  const rl = checkSimpleRateLimit(rlKey, 30, 60 * 1000, 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: 'Zu viele Einlöseversuche.' }, { status: 429 });
  registerSimpleAttempt(rlKey);
  const v = await validateBody(req, RedeemSchema);
  if (!v.success) return v.response;
  try {
    // Code-Format: TYPE:VALUE, z. B. DRINK:2.50 oder GENERAL:5
    const raw = v.data.code.trim().toUpperCase().replace(/[<>"']/g, '');
    const m = raw.match(/^(DRINK|FOOD|DEPOSIT|GENERAL)[:\-](\d+([.,]\d{1,2})?)$/);
    if (!m) {
      return NextResponse.json({ error: 'Ungültiger Wertmarken-Code. Format z. B. DRINK:2.50' }, { status: 400 });
    }
    const tokenType = m[1];
    const unitValueCents = toCents(parseFloat(m[2].replace(',', '.')));
    const totalValueCents = unitValueCents * v.data.quantity;
    const tx = await prisma.tokenTransaction.create({
      data: {
        tokenType,
        action: 'REDEEM',
        quantity: v.data.quantity,
        unitValueCents,
        totalValueCents,
        waiterName: auth.session.waiterName || auth.session.role,
        deviceId: auth.session.deviceId || null,
      },
    });
    await logSystemActionSafe(() => ({
      action: 'TOKEN_REDEEMED',
      category: 'SALES',
      actor: auth.session.waiterName || auth.session.role,
      details: `Wertmarke eingelöst: ${tokenType} x${v.data.quantity} à ${((unitValueCents as number) / 100).toFixed(2)} € (Code ${raw})`,
      metadata: { tokenTransactionId: tx.id, code: raw },
    }));
    return NextResponse.json({ success: true, transaction: tx });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
