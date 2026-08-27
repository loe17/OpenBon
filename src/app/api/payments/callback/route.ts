import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import PaymentAdapterRegistry from '@/lib/payment/adapters/registry';
import { logSystemActionSafe } from '@/lib/action-logger';
import type { PaymentResult } from '@/lib/payment/types';

/**
 * M1.2 Callback-Zustandsmaschine:
 *
 * App-to-App-Callbacks (Deep-Link-Provider) sind kryptografisch NICHT verifizierbar.
 * Damit kein handwerklich gebauter Callback (status=succeeded) eine Zahlung durchdrueckt,
 * gilt:
 *  - STRIPE: Intent wird serverseitig gegen die Stripe-API verifiziert; nur ein von
 *    Stripe bestaetigter Zahlungslauf ergibt direkt SUCCESS.
 *  - Alle anderen Provider: Callback erzeugt hoechstens REPORTED_SUCCESS und muss
 *    vom Kassierer an der Station bestätigt werden (POST /api/payments/session/[id]
 *    mit action=CONFIRM_REPORTED, erfordert angemeldetes Personal).
 */

async function loadProviderConfig(provider: string) {
  const config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
  if (!config) return null;
  return {
    stripeSecretKey: config.stripeSecretKey,
  };
}

async function processCallback(params: Record<string, string>) {
  const providerKey = params.provider || params['smp-status'] ? (params['smp-status'] ? 'SUMUP' : params.provider) : 'SUMUP';
  const adapter = PaymentAdapterRegistry.getAdapter(providerKey) || PaymentAdapterRegistry.getAdapter('SUMUP');

  const adapterResult: PaymentResult = adapter
    ? adapter.handleCallback(params)
    : {
        status: params.status === 'success' ? 'SUCCESS' : 'FAILED',
        customerReference: params.referenceId || params.orderId,
        authCode: params.authCode,
        externalTransactionId: params.authCode,
        errorMessage: params.error,
      };

  // M1.2: Erfolgsmeldung nicht ungeprueft akzeptieren.
  let effectiveStatus = adapterResult.status;
  let verified = false;
  if (adapterResult.status === 'SUCCESS') {
    const providerType = String(providerKey).toUpperCase().replace(/^CARD_/, '');
    if (providerType === 'STRIPE') {
      const providerConfig = await loadProviderConfig(providerKey);
      const stripeAdapter = PaymentAdapterRegistry.getAdapter('STRIPE');
      const intentId =
        params.payment_intent || params.intentId || params.id || adapterResult.externalTransactionId || '';
      if (providerConfig && stripeAdapter && typeof (stripeAdapter as any).verifyPaymentIntent === 'function') {
        verified = await (stripeAdapter as any).verifyPaymentIntent(intentId, providerConfig);
      }
      effectiveStatus = verified ? 'SUCCESS' : 'REPORTED_SUCCESS';
    } else {
      effectiveStatus = 'REPORTED_SUCCESS';
    }
  }

  const ref = adapterResult.customerReference || params.referenceId || params.orderId || params.reference || '';

  // Suche nach der zugehörigen PaymentSession
  let session: any = null;
  if (ref) {
    session = await prisma.paymentSession.findFirst({
      where: {
        OR: [
          { id: ref },
          { customerReference: ref },
          { idempotencyKey: ref },
          { orderId: ref },
        ],
      },
    });
  }

  if (session) {
    // Bereits abschliessend bestatigte Sessions bleiben unveraenderlich.
    if (session.status !== 'SUCCESS') {
      session = await prisma.paymentSession.update({
        where: { id: session.id },
        data: {
          status: effectiveStatus,
          authCode: adapterResult.authCode || session.authCode,
          externalTxId: adapterResult.externalTransactionId || session.externalTxId,
          errorMessage: effectiveStatus === 'REPORTED_SUCCESS' ? null : adapterResult.errorMessage,
          resolvedAt: new Date(),
        },
      });

      if (effectiveStatus === 'SUCCESS') {
        await logSystemActionSafe(() => ({
          action: 'PAYMENT_COMPLETED',
          category: 'SALES',
          actor: session.waiterName || 'App-to-App',
          details: `App-to-App Zahlung (${session.provider}) über ${(session.amountCents / 100).toFixed(2)} € erfolgreich abgeschlossen${verified ? ' (Stripe-API-verifiziert)' : ''}.`,
        }));

        if (global.io) {
          global.io.emit('payment:completed', {
            sessionId: session.id,
            orderId: session.orderId,
            tableId: session.tableId,
            amount: session.amountCents / 100,
          });
        }
      } else if (effectiveStatus === 'REPORTED_SUCCESS') {
        await logSystemActionSafe(() => ({
          action: 'PAYMENT_REPORTED',
          category: 'SALES',
          actor: session.waiterName || 'App-to-App',
          details: `App-to-App Erfolgsmeldung (${session.provider}) für ${(session.amountCents / 100).toFixed(2)} € empfangen - wartet auf Kassierer-Bestätigung.`,
          metadata: {
            sessionId: session.id,
            provider: session.provider,
            amountCents: session.amountCents,
          },
        }));
      }
    }
  }

  return { result: { ...adapterResult, status: effectiveStatus }, verified, session };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const params: Record<string, string> = {};
    searchParams.forEach((v, k) => {
      params[k] = v;
    });

    const { result, verified, session } = await processCallback(params);

    return NextResponse.json({
      success: result.status === 'SUCCESS',
      status: result.status,
      requiresCashierConfirmation: result.status === 'REPORTED_SUCCESS',
      result,
      verified,
      session,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { result, verified, session } = await processCallback(body);

    return NextResponse.json({
      success: result.status === 'SUCCESS',
      status: result.status,
      requiresCashierConfirmation: result.status === 'REPORTED_SUCCESS',
      result,
      verified,
      session,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
