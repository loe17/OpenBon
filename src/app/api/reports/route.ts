import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format'); // 'json' or 'csv'

    // 1. Fetch all real (non-training) completed payments
    const payments = await prisma.payment.findMany({
      where: { isCancelled: false, isTraining: false },
      include: {
        table: true,
        items: true,
      },
    });

    // 2. Fetch all orders to compute item sales counts
    const orderItems = await prisma.orderItem.findMany({
      where: { isCancelled: false, order: { isTraining: false } },
    });

    // Aggregate totals
    let totalGross = 0;
    let totalNet = 0;
    let totalTax19 = 0;
    let totalTax7 = 0;
    let totalCash = 0;
    let totalCard = 0;
    let totalDepositCharged = 0;
    let totalDepositReturned = 0;
    let totalTips = 0;
    let totalDiscounts = 0;

    const waiterMap = new Map<
      string,
      {
        waiterName: string;
        cashGross: number;
        cardGross: number;
        tips: number;
        depositReturned: number;
        transactionCount: number;
      }
    >();

    for (const p of payments) {
      totalGross += p.totalGross;
      totalNet += p.totalNet;
      totalTax19 += (p.totalTax || 0);
      totalDepositCharged += p.totalDeposit;
      totalDepositReturned += p.returnDeposit;
      totalTips += p.tipAmount;
      totalDiscounts += p.discountAmount;

      if (p.paymentMethod === 'CASH') {
        totalCash += p.totalGross;
      } else if (p.paymentMethod.startsWith('CARD')) {
        totalCard += p.totalGross;
      }

      // Waiter breakdown
      const wName = p.waiterName || 'Unbekannt';
      if (!waiterMap.has(wName)) {
        waiterMap.set(wName, {
          waiterName: wName,
          cashGross: 0,
          cardGross: 0,
          tips: 0,
          depositReturned: 0,
          transactionCount: 0,
        });
      }

      const w = waiterMap.get(wName)!;
      w.transactionCount++;
      w.tips += p.tipAmount;
      w.depositReturned += p.returnDeposit;
      if (p.paymentMethod === 'CASH') {
        w.cashGross += p.totalGross;
      } else if (p.paymentMethod.startsWith('CARD')) {
        w.cardGross += p.totalGross;
      }
    }

    // Top selling items
    const productStats = new Map<string, { name: string; quantity: number; revenue: number }>();
    for (const item of orderItems) {
      if (!productStats.has(item.productName)) {
        productStats.set(item.productName, { name: item.productName, quantity: 0, revenue: 0 });
      }
      const s = productStats.get(item.productName)!;
      s.quantity += item.quantity;
      s.revenue += (item.unitPrice + (item.deposit || 0)) * item.quantity;
    }

    const topProducts = Array.from(productStats.values()).sort((a, b) => b.quantity - a.quantity);

    const summary = {
      totalGross,
      totalNet,
      totalTax19,
      totalTax7,
      totalCash,
      totalCard,
      totalDepositCharged,
      totalDepositReturned,
      totalTips,
      totalDiscounts,
      totalTransactions: payments.length,
      waiters: Array.from(waiterMap.values()),
      topProducts,
    };

    if (format === 'csv') {
      // Generate CSV
      let csv = 'Beleg-Nr;Datum;Uhrzeit;Bedienung;Tisch;Zahlart;Brutto;Netto;MwSt;Pfand_Ein;Rueckpfand;Trinkgeld\n';
      for (const p of payments) {
        const d = new Date(p.createdAt);
        csv += `${p.invoiceNumber};${d.toLocaleDateString('de-DE')};${d.toLocaleTimeString('de-DE')};"${p.waiterName}";"${p.table?.label || 'Direkt'}";${p.paymentMethod};${p.totalGross.toFixed(2)};${p.totalNet.toFixed(2)};${p.totalTax.toFixed(2)};${p.totalDeposit.toFixed(2)};${p.returnDeposit.toFixed(2)};${p.tipAmount.toFixed(2)}\n`;
      }
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="Kassenbericht_${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json(summary);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
