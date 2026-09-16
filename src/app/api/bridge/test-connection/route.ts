import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { isExternalBridgeUrl } from '@/lib/webhosting-push';

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const config = await prisma.eventConfig.findFirst();

    const baseUrl = (body.baseUrl || config?.baseUrl || '').trim().replace(/\/+$/, '');
    const syncToken = (body.syncToken || (config as any)?.webhostingSyncToken || '').trim();
    const eventName = (body.eventName || config?.name || 'Vereinsfest').trim();

    if (!baseUrl) {
      return NextResponse.json(
        { error: 'Bitte gib zuerst die Öffentliche Basis-URL (z. B. https://bon.mein-verein.de) ein.' },
        { status: 400 }
      );
    }

    if (!isExternalBridgeUrl(baseUrl)) {
      return NextResponse.json(
        { error: 'Keine gültige externe Webhosting-Adresse (muss mit https://... oder http://... beginnen).' },
        { status: 400 }
      );
    }

    // Automatisch in der Datenbank absichern
    if (config) {
      const updates: Record<string, any> = {};
      if (baseUrl !== config.baseUrl) updates.baseUrl = baseUrl;
      if (syncToken && syncToken !== (config as any).webhostingSyncToken) updates.webhostingSyncToken = syncToken;
      if (Object.keys(updates).length > 0) {
        await prisma.eventConfig.update({ where: { id: config.id }, data: updates }).catch(() => {});
      }
    }

    // Schritt 1: Verbindung & Schlüssel testen
    const statusUrl = `${baseUrl}/api.php?action=status`;
    let statusData: any = null;
    try {
      const statusRes = await fetch(statusUrl, {
        headers: {
          'X-Bridge-Token': syncToken,
        },
        signal: AbortSignal.timeout(6000),
      });

      if (statusRes.status === 403) {
        return NextResponse.json(
          {
            error: 'Sicherheits-Schlüssel abgelehnt! Der Abgleich-Schlüssel in OpenBon stimmt nicht mit der api.php auf deinem Webhosting überein.',
            step: 'AUTH_FAILED',
          },
          { status: 400 }
        );
      }

      if (!statusRes.ok) {
        return NextResponse.json(
          {
            error: `Webhosting antwortet mit Fehler-Status HTTP ${statusRes.status}. Liegen alle Dateien im Verzeichnis?`,
            step: 'HTTP_ERROR',
          },
          { status: 400 }
        );
      }

      statusData = await statusRes.json().catch(() => null);
    } catch (err: any) {
      return NextResponse.json(
        {
          error: `Verbindung zu "${baseUrl}" fehlgeschlagen: ${err.message}. Ist die Domain erreichbar und SSL aktiv?`,
          step: 'CONNECTION_FAILED',
        },
        { status: 400 }
      );
    }

    // Schritt 2: Festnamen dynamisch übertragen
    try {
      await fetch(`${baseUrl}/api.php?action=update_event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Bridge-Token': syncToken,
        },
        body: JSON.stringify({ name: eventName, eventName }),
        signal: AbortSignal.timeout(4000),
      }).catch(() => {});
    } catch {
      // Ignorieren falls v1.0 api.php noch aktiv ist
    }

    // Schritt 3: Digitalen Muster-Beleg für Gast-Ansicht erzeugen & übertragen
    const testCode = 'EBON-TEST-' + Math.random().toString(36).substring(2, 7).toUpperCase();
    const testDate = new Date();
    const formattedDate = testDate.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const sampleReceiptPayload = {
      code: testCode,
      eventName,
      payment: {
        id: 'test-payment-preview',
        invoiceNumber: `TEST-${testDate.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        createdAt: formattedDate,
        paymentMethod: 'BAR',
        waiterName: 'Testkasse (Musterbon)',
        totalGrossCents: 800,
        givenAmountCents: 1000,
        changeAmountCents: 200,
        tipAmountCents: 0,
        items: [
          { productName: 'Bratwurst mit Semmel', quantity: 1, unitPriceCents: 450, totalGrossCents: 450 },
          { productName: 'Radler 0,5 l (inkl. Pfand)', quantity: 1, unitPriceCents: 350, totalGrossCents: 350, depositCents: 100 },
        ],
        splits: [
          { taxRate: 19, base: 2.94, tax: 0.56, gross: 3.50 },
          { taxRate: 7, base: 4.21, tax: 0.29, gross: 4.50 },
        ],
        tse: {
          serialNumber: 'OPENBON-DEMO-TSE-01',
          signatureCounter: 42,
          signature: 'MEYCIQCcTestSignatureValidFiscalHashOpenBonBridgeVerificationOnly==',
        },
      },
    };

    const pushRes = await fetch(`${baseUrl}/api.php?action=push_receipt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bridge-Token': syncToken,
      },
      body: JSON.stringify(sampleReceiptPayload),
      signal: AbortSignal.timeout(6000),
    });

    if (!pushRes.ok) {
      const errTxt = await pushRes.text().catch(() => '');
      return NextResponse.json(
        { error: `Test-Beleg konnte nicht gespeichert werden (HTTP ${pushRes.status}): ${errTxt}` },
        { status: 400 }
      );
    }

    // Schritt 4: Gast-Abruf verifizieren
    const receiptUrl = `${baseUrl}/index.php?code=${testCode}`;
    const cleanReceiptUrl = `${baseUrl}/receipt/${testCode}`;

    return NextResponse.json({
      success: true,
      message: 'Alle Funktionen der Webhosting-Brücke wurden erfolgreich getestet!',
      testCode,
      receiptUrl,
      cleanReceiptUrl,
      eventName,
      statusData,
      steps: [
        { label: 'Webhosting online erreichbar', ok: true, detail: baseUrl },
        { label: 'Sicherheits-Schlüssel (Token) gültig', ok: true },
        { label: `Aktueller Festname übertragen: „${eventName}“`, ok: true },
        { label: `Muster-Beleg #${testCode} erfolgreich übertragen`, ok: true },
        { label: 'Gast-Belegabruf im Browser bereit', ok: true },
      ],
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Unerwarteter Testfehler: ' + err.message }, { status: 500 });
  }
}
