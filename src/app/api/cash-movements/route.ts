import { NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import prisma from '@/lib/db';
import networkSpooler from '@/lib/printer/network-spooler';
import { EscPosBuilder } from '@/lib/printer/escpos-builder';
import haService from '@/lib/ha/ha-service';
import { getOrCreateOpenPeriod } from '@/lib/register-period';
import { requireApiAuth } from '@/lib/api-guard';
import { toCents } from '@/lib/pricing';
import { verifyPinHash } from '@/lib/auth-pin';

/**
 * Spec 6.8: Kassenbuch & Geldbewegungen.
 * CASH_IN  = Wechselgeld-Vorschuss bei Schichtbeginn
 * CASH_OUT = Zwischenabgabe in den Tresor
 * Jede Bewegung wird quittiert (Belegdruck).
 */
export async function GET(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const periodId = searchParams.get('periodId');

    const period = periodId
      ? await prisma.registerPeriod.findUnique({ where: { id: periodId } })
      : await prisma.registerPeriod.findFirst({ where: { status: 'OPEN' } });

    const movements = await prisma.cashMovement.findMany({
      where: period ? { periodId: period.id } : {},
      orderBy: { createdAt: 'desc' },
    });

    const cashInCents = movements.filter((m) => m.type === 'CASH_IN' && !m.isTraining).reduce((s, m) => s + m.amountCents, 0);
    const cashOutCents = movements.filter((m) => m.type === 'CASH_OUT' && !m.isTraining).reduce((s, m) => s + m.amountCents, 0);

    return NextResponse.json({
      periodId: period?.id ?? null,
      periodNumber: period?.periodNumber ?? null,
      movements,
      cashInCents,
      cashOutCents,
      balanceCents: cashInCents - cashOutCents,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req);
  if (!auth.ok) return auth.response;
  const { denyStandbyWrite } = await import('@/lib/ha/ha-guard');
  const denied = denyStandbyWrite();
  if (denied) return denied;

  try {
    const body = (await req.json()) as {
      type?: 'CASH_IN' | 'CASH_OUT';
      amount?: number;
      reason?: string;
      waiterName?: string;
      deviceId?: string;
      pin?: string;
      printReceipt?: boolean;
    };

    const config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
    if (!config) {
      return NextResponse.json({ error: 'Keine Konfiguration gefunden' }, { status: 500 });
    }

    const pin = (body.pin || '').trim();
    // M3.2: verifyPinHash unterstuetzt PBKDF2-Hashes UND historische Klartexte.
    if (!verifyPinHash(pin, config.adminPin) && !verifyPinHash(pin, config.posPin)) {
      return NextResponse.json(
        { error: 'Geldbewegungen nur mit Admin- oder Kassen-PIN möglich.' },
        { status: 403 }
      );
    }

    const type = body.type === 'CASH_OUT' ? 'CASH_OUT' : 'CASH_IN';
    const amountCents = toCents(Number((body as any).amount || ((body as any).amountCents || 0) / 100 || 0));
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return NextResponse.json({ error: 'Betrag muss größer als 0 sein.' }, { status: 400 });
    }
    const reason = (body.reason || '').trim();
    if (!reason) {
      return NextResponse.json({ error: 'Ein Grund ist erforderlich.' }, { status: 400 });
    }

    const period = await getOrCreateOpenPeriod();

    const movement = await prisma.cashMovement.create({
      data: {
        periodId: period.id,
        type,
        amountCents,
        reason,
        waiterName: body.waiterName || 'Kasse',
        deviceId: body.deviceId || null,
        isTraining: config.trainingMode,
      },
    });

    // Quittungsdruck
    if (body.printReceipt !== false) {
      const printer = await prisma.printer.findFirst({ where: { isActive: true } });
      if (printer) {
        const { rawBuffer, textRepresentation } = EscPosBuilder.buildCashMovementTicket(
          {
            type,
            amountCents: movement.amountCents,
            reason,
            waiterName: movement.waiterName,
            eventName: config.name,
            isTraining: config.trainingMode,
            createdAt: movement.createdAt,
          },
          printer.paperWidth
        );
        await networkSpooler.sendRawBuffer(printer, rawBuffer, textRepresentation);

        // Kassenlade beim Einlegen/Entnehmen von Bargeld oeffnen
        if (!printer.isVirtual) {
          await networkSpooler.openDrawer(printer);
        }
      }
    }

    await haService.logMutation('CASH_MOVEMENT', movement.id, 'INSERT', movement);

    if (global.io) {
      global.io.emit('cashbook:updated', movement);
    }

    await logSystemActionSafe(() => ({
      action: 'CASH_MOVEMENT',
      category: 'CASHBOOK',
      actor: movement.waiterName || auth.session.waiterName || auth.session.role,
      details: `${movement.type}: ${((movement as any).amountCents / 100).toFixed(2)} € – ${movement.reason}`,
      metadata: {
        movementId: movement.id,
        type: movement.type,
        amountCents: movement.amountCents,
        reason: movement.reason,
      },
    }));

    return NextResponse.json(movement);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
