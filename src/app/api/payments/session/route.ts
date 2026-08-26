import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import PaymentAdapterRegistry from '@/lib/payment/adapters/registry';
import type { PaymentProviderType, ProviderConfiguration, PaymentRequest } from '@/lib/payment/types';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      provider,
      amountCents,
      orderId,
      tableId,
      waiterName,
      deviceId,
      title,
      context,
      idempotencyKey,
    } = body;

    if (!provider || !amountCents || amountCents <= 0) {
      return NextResponse.json(
        { error: 'Provider und ein positiver Betrag in Cent sind erforderlich.' },
        { status: 400 }
      );
    }

    const config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
    if (!config) {
      return NextResponse.json({ error: 'Systemkonfiguration nicht gefunden' }, { status: 500 });
    }

    const providerType = (String(provider).toUpperCase().replace(/^CARD_/, '')) as PaymentProviderType;
    const adapter = PaymentAdapterRegistry.getAdapter(providerType);
    if (!adapter) {
      return NextResponse.json({ error: `Unbekannter Zahlungsanbieter: ${provider}` }, { status: 400 });
    }

    const providerConfig: ProviderConfiguration = {
      type: providerType,
      sumupAppId: config.sumupAppId,
      sumupMerchantCode: config.sumupMerchantCode,
      vrPayApiKey: config.vrPayApiKey,
      vrPayTerminalId: config.vrPayTerminalId,
      sparkasseMerchantId: config.sparkasseMerchantId,
      stripeSecretKey: config.stripeSecretKey,
      stripePublishableKey: config.stripePublishableKey,
      stripeLocationId: config.stripeLocationId,
      zvtHost: config.zvtHost,
      zvtPort: config.zvtPort,
      zvtPassword: config.zvtPassword,
    };

    const idemKey = idempotencyKey || `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 Minuten TTL

    // PaymentSession in DB anlegen
    const session = await prisma.paymentSession.create({
      data: {
        provider: providerType,
        status: 'PENDING',
        amountCents: Math.round(amountCents),
        currency: config.currency || 'EUR',
        orderId,
        tableId,
        deviceId,
        waiterName: waiterName || 'Bedienung',
        customerReference: idemKey,
        idempotencyKey: idemKey,
        contextJson: context ? JSON.stringify(context) : null,
        expiresAt,
      },
    });

    const paymentReq: PaymentRequest = {
      orderId,
      tableId,
      deviceId,
      waiterName,
      amountInCents: Math.round(amountCents),
      currency: config.currency || 'EUR',
      customerReference: session.id,
      title: title || `OpenBon #${orderId || tableId || 'Direkt'}`,
      baseUrl: config.baseUrl || 'http://openbon.local',
      context,
    };

    const initResult = await adapter.initiatePayment(paymentReq, providerConfig);

    // Bei synchronen Zahlungen (z. B. ZVT) Session direkt aktualisieren
    if (initResult.kind === 'sync') {
      const syncStatus = initResult.result.status;
      await prisma.paymentSession.update({
        where: { id: session.id },
        data: {
          status: syncStatus,
          authCode: initResult.result.authCode,
          externalTxId: initResult.result.externalTransactionId,
          errorMessage: initResult.result.errorMessage,
          resolvedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      sessionId: session.id,
      status: session.status,
      idempotencyKey: idemKey,
      initiate: initResult,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
