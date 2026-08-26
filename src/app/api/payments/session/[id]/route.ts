import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import PaymentAdapterRegistry from '@/lib/payment/adapters/registry';
import { logSystemActionSafe } from '@/lib/action-logger';
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

    if (action === 'MANUAL_CONFIRM') {
      const updated = await prisma.paymentSession.update({
        where: { id: session.id },
        data: {
          status: 'SUCCESS',
          authCode: authCode || 'MANUAL_OVERRIDE',
          externalTxId: authCode || 'MANUAL_OVERRIDE',
          resolvedAt: new Date(),
        },
      });

      await logSystemActionSafe(() => ({
        action: 'PAYMENT_COMPLETED',
        category: 'SALES',
        actor: session.waiterName || 'System',
        details: `Kartenzahlung ${session.id} manuell mit Autorisierungscode bestätigt.`,
      }));

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
