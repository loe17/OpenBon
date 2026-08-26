import { NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import prisma from '@/lib/db';
import {
  buildDeepLinkFor,
  PAYMENT_METHOD_TO_PROVIDER,
  type CardProvider,
} from '@/lib/payment/deep-links';
import { runZvtPayment, probeZvtTerminal } from '@/lib/payment/zvt-client';
import { toCents } from '@/lib/pricing';
import { requireApiAuth } from '@/lib/api-guard';

/**
 * Spec 4: Einheitlicher Einstieg in alle Kartenzahlverfahren.
 *
 * GET  ?method=CARD_SUMUP&amount=12.50&reference=...&title=...
 *      -> liefert den App-to-App Deep Link (SumUp / VR-Pay Me / Sparkasse S-POS)
 *
 * POST { method: 'CARD_TERMINAL', amount, reference }
 *      -> führt eine ZVT-over-IP Transaktion am stationären/mobilen Terminal aus
 */
export async function GET(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const method = searchParams.get('method') ?? 'CARD_SUMUP';
    const amount = Number(searchParams.get('amount') ?? 0);
    const reference = searchParams.get('reference') ?? '';
    const title = searchParams.get('title') ?? 'OrderBon Zahlung';

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Ungültiger Betrag' }, { status: 400 });
    }

    const provider = PAYMENT_METHOD_TO_PROVIDER[method];
    if (!provider || provider === 'zvt') {
      return NextResponse.json(
        { error: `Für ${method} gibt es keinen App-to-App Deep Link. Bitte POST für ZVT nutzen.` },
        { status: 400 }
      );
    }

    const config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
    if (!config) {
      return NextResponse.json({ error: 'Keine Konfiguration gefunden' }, { status: 500 });
    }

    const missing: Record<CardProvider, string | null> = {
      sumup: config.sumupAppId ? null : 'SumUp Affiliate-Key (sumupAppId) ist nicht konfiguriert.',
      vrpay: config.vrPayTerminalId ? null : 'VR-Pay Me Händler-ID ist nicht konfiguriert.',
      sparkasse: config.sparkasseMerchantId ? null : 'Sparkassen Händler-ID (S-POS) ist nicht konfiguriert.',
    };
    if (missing[provider]) {
      return NextResponse.json({ error: missing[provider] }, { status: 400 });
    }

    const deepLink = buildDeepLinkFor(
      provider,
      {
        amount,
        title,
        referenceId: reference,
        baseUrl: config.baseUrl || 'http://openbon.local',
        currency: config.currency,
      },
      {
        sumupAppId: config.sumupAppId,
        sumupMerchantCode: config.sumupMerchantCode,
        vrPayTerminalId: config.vrPayTerminalId,
        sparkasseMerchantId: config.sparkasseMerchantId,
      }
    );

    return NextResponse.json({ provider, deepLink, amount, reference });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const body = (await req.json()) as {
      method?: string;
      amount?: number;
      reference?: string;
      receiptNumber?: number;
      probeOnly?: boolean;
    };

    const config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
    if (!config) {
      return NextResponse.json({ error: 'Keine Konfiguration gefunden' }, { status: 500 });
    }

    if (!config.zvtHost) {
      return NextResponse.json(
        { error: 'Es ist kein ZVT-Terminal konfiguriert (Grundeinstellungen → Kartenzahlung).' },
        { status: 400 }
      );
    }

    const terminal = {
      host: config.zvtHost,
      port: config.zvtPort || 20007,
      password: config.zvtPassword || '000000',
    };

    if (body.probeOnly) {
      const reachable = await probeZvtTerminal({ ...terminal, timeoutMs: 2500 });
      return NextResponse.json({ reachable, host: terminal.host, port: terminal.port });
    }

    const amount = Number(body.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Ungültiger Betrag' }, { status: 400 });
    }

    const result = await runZvtPayment(terminal, toCents(amount), body.receiptNumber);

    await logSystemActionSafe(() => ({
      action: 'CARD_PAYMENT',
      category: 'SALES',
      actor: auth.session.waiterName || auth.session.role,
      details: 'Kartenzahlung am Terminal ausgeloest.',
    }));

    return NextResponse.json({
      success: result.success,
      authCode: result.authCode ?? null,
      error: result.error ?? null,
      trace: result.trace,
      terminalId: `${terminal.host}:${terminal.port}`,
      amount,
      reference: body.reference ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
