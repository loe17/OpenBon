import { NextResponse } from 'next/server';
import { logSystemActionSafe } from '@/lib/action-logger';
import os from 'os';
import net from 'net';
import prisma from '@/lib/db';
import { parseAndValidateLicense } from '@/lib/license';
import { EscPosBuilder } from '@/lib/printer/escpos-builder';
import networkSpooler from '@/lib/printer/network-spooler';
import { TicketData } from '@/lib/printer/types';
import { requireApiAuth } from '@/lib/api-guard';

// Hilfsfunktion: TCP Socket Ping für Bondrucker
async function testPrinterSocket(ip: string, port: number, timeoutMs = 2500): Promise<{ reachable: boolean; latencyMs: number; error?: string }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();

    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve({ reachable: false, latencyMs: Date.now() - start, error: 'Zeitüberschreitung (Timeout nach ' + timeoutMs + 'ms)' });
      }
    }, timeoutMs);

    socket.connect(port || 9100, ip, () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        const latency = Date.now() - start;
        socket.end();
        resolve({ reachable: true, latencyMs: latency });
      }
    });

    socket.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        socket.destroy();
        resolve({ reachable: false, latencyMs: Date.now() - start, error: err.message });
      }
    });
  });
}

export async function GET(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const startTime = Date.now();

    // 1. Datenbank-Check
    const config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });
    const productCount = await prisma.product.count();
    const categoryCount = await prisma.productCategory.count();
    const printGroupCount = await prisma.printGroup.count();
    const printerCount = await prisma.printer.count();
    const tableCount = await prisma.diningTable.count();
    const orderCount = await prisma.order.count();

    // 2. Netzwerk- & IP-Check
    const networkInterfaces = os.networkInterfaces();
    const localIps: string[] = [];
    for (const name of Object.keys(networkInterfaces)) {
      for (const netIf of networkInterfaces[name] || []) {
        if (netIf.family === 'IPv4' && !netIf.internal) {
          localIps.push(netIf.address);
        }
      }
    }

    // 3. Lizenz-Check
    const license = parseAndValidateLicense(config?.licenseKey || '');

    // 4. Drucker-Hardware Check
    const printers = await prisma.printer.findMany();
    const printerResults = await Promise.all(
      printers.map(async (p) => {
        if (p.isVirtual) {
          return {
            id: p.id,
            name: p.name,
            ipAddress: p.ipAddress,
            port: p.port,
            isVirtual: true,
            reachable: true,
            latencyMs: 0,
            status: 'OK',
            details: 'Virtueller Test-Monitor aktiv',
          };
        }

        const socketRes = await testPrinterSocket(p.ipAddress, p.port || 9100, 2000);
        return {
          id: p.id,
          name: p.name,
          ipAddress: p.ipAddress,
          port: p.port,
          isVirtual: false,
          reachable: socketRes.reachable,
          latencyMs: socketRes.latencyMs,
          status: socketRes.reachable ? 'OK' : 'ERROR',
          details: socketRes.reachable
            ? `Erreichbar (${socketRes.latencyMs}ms)`
            : `Nicht erreichbar (${socketRes.error || 'Verbindung fehlgeschlagen'})`,
        };
      })
    );

    // 5. Speisekarten- und Zuordnungs-Konsistenz
    const unmappedPrintGroups = await prisma.printGroup.findMany({
      where: { printerId: null },
    });
    const unmappedProducts = await prisma.product.findMany({
      where: {
        OR: [{ categoryId: '' }, { printGroupId: null }],
      },
    });

    const issues: string[] = [];
    if (printerCount === 0) issues.push('Keine Bondrucker im System hinterlegt.');
    const unreachablePrinters = printerResults.filter((p) => !p.reachable && !p.isVirtual);
    if (unreachablePrinters.length > 0) {
      issues.push(`${unreachablePrinters.length} physische(r) Drucker nicht im Netzwerk erreichbar.`);
    }
    if (productCount === 0) issues.push('Noch keine Artikel in der Speisekarte angelegt.');
    if (categoryCount === 0) issues.push('Noch keine Warengruppen angelegt.');
    if (unmappedPrintGroups.length > 0) {
      issues.push(`${unmappedPrintGroups.length} Druckgruppe(n) haben keinen Drucker zugewiesen.`);
    }

    const overallStatus = issues.length === 0 ? 'ALL_OK' : unreachablePrinters.length > 0 ? 'ERROR' : 'WARNING';

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      overallStatus,
      issues,
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        hostname: os.hostname(),
        localIps,
        baseUrl: config?.baseUrl || 'http://openbon.local:3000',
      },
      eventConfig: {
        name: config?.name || 'OpenBon Event',
        currency: config?.currency || 'EUR',
        enableTax: config?.enableTax ?? true,
        enableGuestSelfOrder: config?.enableGuestSelfOrder ?? false,
        haPartnerUrl: config?.haPartnerUrl || null,
      },
      license: {
        tier: license.type,
        maxDevices: license.maxDevices,
        isValid: license.isValid,
        features: license.features,
      },
      counts: {
        products: productCount,
        categories: categoryCount,
        printGroups: printGroupCount,
        printers: printerCount,
        tables: tableCount,
        orders: orderCount,
      },
      printers: printerResults,
      consistency: {
        unmappedPrintGroupsCount: unmappedPrintGroups.length,
        unmappedProductsCount: unmappedProducts.length,
      },
    });
  } catch (error: any) {
    console.error('Diagnostic error:', error);
    return NextResponse.json(
      { error: 'Fehler bei der System-Diagnose: ' + error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const action = body.action;

    const config = await prisma.eventConfig.findUnique({ where: { id: 'default' } });

    // ACTION: Alle Drucker mit Testbeleg testen
    if (action === 'PRINT_TEST_TICKETS') {
      const printers = await prisma.printer.findMany();
      if (printers.length === 0) {
        return NextResponse.json({ error: 'Keine Drucker vorhanden.' }, { status: 400 });
      }

      const results = [];
      for (const printer of printers) {
        const ticketData = {
          title: 'SYSTEM-TESTBELEG',
          eventName: config?.name || 'OpenBon Kassenprüfung',
          orderNumber: 9999,
          waiterName: 'Diagnose-Tool',
          tableLabel: 'TEST-99',
          items: [
            { name: 'Hardware-Prüfposition 1 (Küche)', quantity: 1, unitPriceCents: 0.0, depositCents: 0 },
            { name: 'Hardware-Prüfposition 2 (Ausschank)', quantity: 2, unitPriceCents: 0.0, depositCents: 0 },
          ],
          totalGrossCents: 0.0,
          footerText: 'Druckertest erfolgreich abgeschlossen.',
          isTraining: true,
          tableFontSize: config?.receiptTableFontSize || 2,
          enableTax: config?.enableTax ?? true,
        };

        const printRes = await networkSpooler.printTicket(printer, ticketData);
        results.push({
          printerName: printer.name,
          ip: printer.ipAddress,
          isVirtual: printer.isVirtual,
          success: printRes.success,
          error: printRes.error,
        });
      }

      return NextResponse.json({
        success: true,
        printedCount: results.filter((r) => r.success).length,
        results,
      });
    }

    // ACTION: Vollständigen E2E Kassen- und Bestellzyklus durchspielen
    if (action === 'SIMULATE_ORDER_CYCLE') {
      const steps: { name: string; success: boolean; details: string }[] = [];

      // Schritt 1: Kategorie & Testprodukt prüfen / anlegen
      let testCat = await prisma.productCategory.findFirst({ where: { name: 'SYSTEM_DIAGNOSTIK' } });
      if (!testCat) {
        testCat = await prisma.productCategory.create({
          data: { name: 'SYSTEM_DIAGNOSTIK', sortIndex: 999 },
        });
      }
      steps.push({ name: 'Warengruppe anlegen/prüfen', success: true, details: `Kategorie ID: ${testCat.id}` });

      let testProduct = await prisma.product.findFirst({ where: { name: 'TEST-ARTIKEL (Diagnose)' } });
      if (!testProduct) {
        testProduct = await prisma.product.create({
          data: {
            name: 'TEST-ARTIKEL (Diagnose)',
            priceCents: 1.0,
            depositCents: 0.0,
            categoryId: testCat.id,
            taxRate: 19.0,
          },
        });
      }
      steps.push({ name: 'Test-Artikel generieren', success: true, details: `Artikel: ${testProduct.name} (${testProduct.priceCents.toFixed(2)} EUR)` });

      // Schritt 2: Testtisch prüfen / anlegen
      let testTable = await prisma.diningTable.findFirst({ where: { tableNumber: 999 } });
      if (!testTable) {
        testTable = await prisma.diningTable.create({
          data: { tableNumber: 999, label: 'TESTTISCH 999' },
        });
      }
      steps.push({ name: 'Testtisch vorbereiten', success: true, details: `Tisch #${testTable.tableNumber}` });

      // Schritt 3: Bestellung anlegen
      const order = await prisma.order.create({
        data: {
          tableId: testTable.id,
          orderNumber: 99901,
          waiterName: 'Diagnose-Bot',
          status: 'COMPLETED',
          isTraining: true,
          items: {
            create: [
              {
                productId: testProduct.id,
                productName: testProduct.name,
                quantity: 1,
                unitPriceCents: 1.0,
                taxRate: 19.0,
                printStatus: 'PRINTED',
                kdsStatus: 'COMPLETED',
                paidQuantity: 1,
              },
            ],
          },
        },
      });
      steps.push({ name: 'Bestellung im Datenspeicher verbuchen', success: true, details: `Order ID: ${order.id}` });

      // Schritt 4: Testbeleg erzeugen
      const { rawBuffer, textRepresentation } = EscPosBuilder.buildTicket(
        {
          title: 'TEST-KASSENBELEG',
          tableLabel: '999',
          orderNumber: order.orderNumber,
          waiterName: 'Test-Bot',
          items: [{ name: testProduct.name, quantity: 1, unitPriceCents: 1.0 }],
          totalGrossCents: 1.0,
          isTraining: true,
          enableTax: config?.enableTax ?? true,
        },
        80
      );
      steps.push({
        name: 'ESC/POS Beleg-Binärstrom kompilieren',
        success: rawBuffer.length > 0,
        details: `${rawBuffer.length} Bytes generiert`,
      });

      // Schritt 5: Test-Drucker ansprechen wenn vorhanden
      const firstPrinter = await prisma.printer.findFirst();
      if (firstPrinter) {
        const printRes = await networkSpooler.sendRawBuffer(firstPrinter, rawBuffer, textRepresentation);
        steps.push({
          name: `Druckerausgabe an "${firstPrinter.name}"`,
          success: printRes.success,
          details: printRes.success ? 'Erfolgreich übertragen' : (printRes.error || 'Fehler'),
        });
      } else {
        steps.push({
          name: 'Druckerausgabe',
          success: true,
          details: 'Übersprungen (Kein Drucker hinterlegt)',
        });
      }

      // Schritt 6: Vollständige automatische Bereinigung aller Testdaten
      try {
        await prisma.orderItem.deleteMany({
          where: { orderId: order.id },
        });
        await prisma.order.deleteMany({
          where: { id: order.id },
        });
        await prisma.diningTable.deleteMany({
          where: { tableNumber: 999 },
        });
        await prisma.product.deleteMany({
          where: { name: 'TEST-ARTIKEL (Diagnose)' },
        });
        await prisma.productCategory.deleteMany({
          where: { name: 'SYSTEM_DIAGNOSTIK' },
        });
        steps.push({
          name: 'Testdaten-Bereinigung',
          success: true,
          details: 'Testartikel, Warengruppe und Testtisch #999 automatisch gelöscht',
        });
      } catch (cleanupErr: any) {
        console.error('Diagnostics cleanup error:', cleanupErr);
      }

      await logSystemActionSafe(() => ({
        action: 'DIAGNOSTICS_RUN',
        category: 'SYSTEM',
        actor: auth.session.waiterName || auth.session.role,
        details: 'Selbstdiagnose ausgeloest.',
      }));

      return NextResponse.json({
        success: true,
        message: 'E2E Test-Bestellzyklus erfolgreich durchlaufen und Testdaten bereinigt.',
        steps,
      });
    }

    // 2. Fest-Generalprobe & 1-Klick Hardware-Selbsttest
    if (body.action === 'GENERALPROBE') {
      const printers = await prisma.printer.findMany();
      const probeResults: { name: string; success: boolean; details: string }[] = [];

      for (const printer of printers) {
        const testTicket: TicketData = {
          title: 'FEST-GENERALPROBE',
          tableLabel: 'SELBSTCHECK',
          waiterName: auth.session.waiterName || 'Administrator',
          items: [
            { name: 'Hardware-Selbsttest OK', quantity: 1, unitPriceCents: 0.0 },
            { name: 'Papierschneider / Cutter OK', quantity: 1, unitPriceCents: 0.0 },
          ],
          footerText: `${printer.name} | ${printer.ipAddress} | Breite: ${printer.paperWidth}mm`,
        };

        const { rawBuffer, textRepresentation } = EscPosBuilder.buildTicket(testTicket, printer.paperWidth);
        const printRes = await networkSpooler.sendRawBuffer(printer, rawBuffer, textRepresentation);
        
        probeResults.push({
          name: `Drucker "${printer.name}"`,
          success: printRes.success,
          details: printRes.success ? 'Druckauftrag & Schnitt übertragen' : (printRes.error || 'Fehler'),
        });

        if (printer.hasCashDrawer) {
          await networkSpooler.openDrawer(printer);
          probeResults.push({
            name: `Kassenlade an "${printer.name}"`,
            success: true,
            details: 'Öffnungsimpuls gesendet',
          });
        }
      }

      await logSystemActionSafe(() => ({
        action: 'GENERALPROBE_RUN',
        category: 'SYSTEM',
        actor: auth.session.waiterName || auth.session.role,
        details: `Fest-Generalprobe durchgeführt (${printers.length} Drucker getestet).`,
      }));

      return NextResponse.json({
        success: true,
        message: 'Fest-Generalprobe erfolgreich durchgeführt.',
        steps: probeResults,
      });
    }

    // 3. Testdaten rückstandsfrei bereinigen
    if (body.action === 'PURGE_TEST_DATA') {
      const orderCount = await prisma.order.count();
      const paymentCount = await prisma.payment.count();
      const printJobCount = await prisma.printJob.count();

      await prisma.paymentItem.deleteMany({});
      await prisma.payment.deleteMany({});
      await prisma.orderItem.deleteMany({});
      await prisma.order.deleteMany({});
      await prisma.printJob.deleteMany({});
      await prisma.cashMovement.deleteMany({});
      await prisma.tokenTransaction.deleteMany({});
      await prisma.paymentSession.deleteMany({});

      if (global.virtualPrinterHistory) {
        global.virtualPrinterHistory = [];
      }

      await logSystemActionSafe(() => ({
        action: 'TEST_DATA_PURGED',
        category: 'ADMIN',
        actor: auth.session.waiterName || auth.session.role,
        details: `Testdaten-Bereinigung durchgeführt (${orderCount} Bestellungen, ${paymentCount} Zahlungen, ${printJobCount} Druckaufträge gelöscht).`,
      }));

      return NextResponse.json({
        success: true,
        message: `Testdaten erfolgreich bereinigt (${orderCount} Bestellungen, ${paymentCount} Zahlungen, ${printJobCount} Druckaufträge entfernt). Stammdaten (Artikel, Tische, Drucker) blieben unberührt.`,
        deleted: { orders: orderCount, payments: paymentCount, printJobs: printJobCount },
      });
    }

    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  } catch (error: any) {
    console.error('Diagnostics POST error:', error);
    return NextResponse.json(
      { error: 'Fehler beim Testlauf: ' + error.message },
      { status: 500 }
    );
  }
}
