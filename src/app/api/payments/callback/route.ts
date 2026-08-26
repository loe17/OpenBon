import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import PaymentAdapterRegistry from '@/lib/payment/adapters/registry';
import { logSystemActionSafe } from '@/lib/action-logger';

async function processCallback(params: Record<string, string>) {
  const providerKey = params.provider || params['smp-status'] ? (params['smp-status'] ? 'SUMUP' : params.provider) : 'SUMUP';
  const adapter = PaymentAdapterRegistry.getAdapter(providerKey) || PaymentAdapterRegistry.getAdapter('SUMUP');

  const result: {
    status: 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'PENDING' | 'TIMEOUT';
    customerReference?: string;
    authCode?: string;
    externalTransactionId?: string;
    errorMessage?: string;
  } = adapter
    ? adapter.handleCallback(params)
    : {
        status: params.status === 'success' ? 'SUCCESS' : 'FAILED',
        customerReference: params.referenceId || params.orderId,
        authCode: params.authCode,
        externalTransactionId: params.authCode,
        errorMessage: params.error,
      };

  const ref = result.customerReference || params.referenceId || params.orderId || params.reference || '';

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
    if (session.status !== 'SUCCESS') {
      session = await prisma.paymentSession.update({
        where: { id: session.id },
        data: {
          status: result.status,
          authCode: result.authCode || session.authCode,
          externalTxId: result.externalTransactionId || session.externalTxId,
          errorMessage: result.errorMessage,
          resolvedAt: new Date(),
        },
      });

      if (result.status === 'SUCCESS') {
        await logSystemActionSafe(() => ({
          action: 'PAYMENT_COMPLETED',
          category: 'SALES',
          actor: session.waiterName || 'App-to-App',
          details: `App-to-App Zahlung (${session.provider}) über ${(session.amountCents / 100).toFixed(2)} € erfolgreich abgeschlossen.`,
        }));

        if (global.io) {
          global.io.emit('payment:completed', {
            sessionId: session.id,
            orderId: session.orderId,
            tableId: session.tableId,
            amount: session.amountCents / 100,
          });
        }
      }
    }
  }

  return { result, session };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const params: Record<string, string> = {};
    searchParams.forEach((v, k) => {
      params[k] = v;
    });

    const { result, session } = await processCallback(params);

    return NextResponse.json({
      success: result.status === 'SUCCESS',
      status: result.status,
      result,
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
    const { result, session } = await processCallback(body);

    return NextResponse.json({
      success: result.status === 'SUCCESS',
      status: result.status,
      result,
      session,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
