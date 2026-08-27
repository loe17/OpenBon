import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import PaymentAdapterRegistry from '@/lib/payment/adapters/registry';
import { logSystemActionSafe } from '@/lib/action-logger';
import { requireApiAuth } from '@/lib/api-guard';
import type { ProviderConfiguration } from '@/lib/payment/types';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await prisma.paymentSession.findUnique({
      where: { id: params.id },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session nicht gefunden' }, { status: 404 });
    }

    // Lazy Timeout Prüfung
    if (session.status === 'PENDING' && new Date() > session.expiresAt) {
      const updated = await prisma.paymentSession.update({
        where: { id: session.id },
        data: { status: 'TIMEOUT', resolvedAt: new Date() },
      });
      return NextResponse.json(updated);
    }

    // Falls Provider einen aktiven Status-Check anbietet (z. B. Stripe)
    if (session.status === 'PENDING') {
      const adapter = PaymentAdapterRegistry.getAdapter(session.provider);
      if (adapter && typeof adapter.checkStatus === 'function') {
        const config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
        if (config) {
          const providerConfig: ProviderConfiguration = {
            type: session.provider as any,
            stripeSecretKey: config.stripeSecretKey,
          };
          const liveStatus = await adapter.checkStatus(session.id, providerConfig);
          if (liveStatus !== 'PENDING') {
            const updated = await prisma.paymentSession.update({
              where: { id: session.id },
              data: { status: liveStatus, resolvedAt: new Date() },
            });
            return NextResponse.json(updated);
          }
        }
      }
    }

    return NextResponse.json(session);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await prisma.paymentSession.findUnique({
      where: { id: params.id },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session nicht gefunden' }, { status: 404 });
    }

    const body = await req.json();
    const { action, authCode, reason } = body;

    if (action === 'CANCEL') {
      const updated = await prisma.paymentSession.update({
        where: { id: session.id },
        data: {
          status: 'CANCELLED',
          errorMessage: reason || 'Manuell abgebrochen',
          resolvedAt: new Date(),
        },
      });

      await logSystemActionSafe(() => ({
        action: 'CONFIG_CHANGED',
        category: 'SALES',
        actor: session.waiterName || 'System',
        details: `Kartenzahlungs-Sitzung ${session.id} manuell abgebrochen.`,
      }));

      return NextResponse.json(updated);
    }

    // M1.2 Kassierer-Bestaetigung einer App-to-App-Erfolgsmeldung (REPORTED_SUCCESS).
    // Erfordert eine angemeldete Staff-Session - jede Station darf den Vorgang,
    // den sie selbst bedient hat, abschliessend bestaetigen.
    if (action === 'CONFIRM_REPORTED') {
      const auth = await requireApiAuth(req);
      if (!auth.ok) return auth.response;

      if (session.status !== 'REPORTED_SUCCESS') {
        return NextResponse.json(
          {
            error: `Bestätigung nicht möglich: Session ist im Status ${session.status}, nicht REPORTED_SUCCESS.`,
          },
          { status: 409 }
        );
      }

      const updated = await prisma.paymentSession.update({
        where: { id: session.id },
        data: {
          status: 'SUCCESS',
          authCode: authCode || 'CASHIER_CONFIRMED',
          resolvedAt: new Date(),
        },
      });

      const confirmedBy = auth.session.waiterName || auth.session.role;
      await logSystemActionSafe(() => ({
        action: 'PAYMENT_COMPLETED',
        category: 'SALES',
        actor: confirmedBy,
        details: `App-gemeldete Kartenzahlung (${session.provider}) über ${(session.amountCents / 100).toFixed(2)} € durch Kassierer bestätigt.`,
        metadata: {
          sessionId: session.id,
          provider: session.provider,
          amountCents: session.amountCents,
          orderId: session.orderId,
          tableId: session.tableId,
        },
      }));

      if (global.io) {
        global.io.emit('payment:completed', {
          sessionId: updated.id,
          orderId: updated.orderId,
          tableId: updated.tableId,
          amount: updated.amountCents / 100,
        });
      }

      return NextResponse.json(updated);
    }

    // M1.2 NOTFALL-OVERRIDE jetzt ADMIN-only (bisher ohne Rollenpruefung).
    if (action === 'MANUAL_CONFIRM') {
      const adminAuth = await requireApiAuth(req, ['ADMIN']);
      if (!adminAuth.ok) return adminAuth.response;

      const updated = await prisma.paymentSession.update({
        where: { id: session.id },
        data: {
          status: 'SUCCESS',
          authCode: authCode || 'ADMIN_OVERRIDE',
          externalTxId: authCode || 'ADMIN_OVERRIDE',
          resolvedAt: new Date(),
        },
      });

      const confirmedBy = adminAuth.session.waiterName || 'Admin';
      await logSystemActionSafe(() => ({
        action: 'PAYMENT_COMPLETED',
        category: 'SALES',
        actor: confirmedBy,
        details: `Kartenzahlung ${session.id} vom Admin manuell mit Autorisierungscode bestätigt.`,
        metadata: {
          sessionId: session.id,
          provider: session.provider,
          amountCents: session.amountCents,
        },
      }));

      if (global.io) {
        global.io.emit('payment:completed', {
          sessionId: updated.id,
          orderId: updated.orderId,
          tableId: updated.tableId,
          amount: updated.amountCents / 100,
        });
      }

      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
