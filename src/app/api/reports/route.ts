import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { computeHourlySales, computeForecast } from '@/lib/forecast';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format'); // 'json' or 'csv'

    // 1. Fetch real (non-training) completed payments, orders, products & categories schlank
    const [payments, orders, products, categories] = await Promise.all([
      prisma.payment.findMany({
        where: { isCancelled: false, isTraining: false },
        include: { table: true },
      }),
      prisma.order.findMany({
        where: { status: { not: 'CANCELLED' }, isTraining: false },
        include: { items: true },
      }),
      prisma.product.findMany({
        include: { stockItem: true },
      }),
      prisma.productCategory.findMany(),
    ]);

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Aggregate totals
    let totalGross = 0;
    let totalNet = 0;
    let totalTax19 = 0;
    let totalTax7 = 0;
    let totalCash = 0;
    let totalCardSumUp = 0;
    let totalCardVrPay = 0;
    let totalCardTerminal = 0;
    let totalCardAll = 0;
    let totalStaff = 0;
    let totalDepositCharged = 0;
    let totalDepositReturned = 0;
    let totalTips = 0;
    let totalDiscounts = 0;
    let totalSurcharges = 0;

    const waiterMap = new Map<
      string,
      {
        waiterName: string;
        totalGross: number;
        cashGross: number;
        cardGross: number;
        tips: number;
        depositReturned: number;
        transactionCount: number;
        ordersLastHour: number;
        salesLastHour: number;
      }
    >();

    for (const p of payments) {
      totalGross += p.totalGross;
      totalNet += p.totalNet;
      totalTax19 += p.totalTax || 0;
      totalDepositCharged += p.totalDeposit;
      totalDepositReturned += p.returnDeposit;
      totalTips += p.tipAmount;
      totalDiscounts += p.discountAmount;
      totalSurcharges += p.surchargeAmount || 0;

      const method = p.paymentMethod || 'CASH';
      if (method === 'CASH') {
        totalCash += p.totalGross;
      } else if (method === 'CARD_SUMUP') {
        totalCardSumUp += p.totalGross;
        totalCardAll += p.totalGross;
      } else if (method === 'CARD_VRPAY') {
        totalCardVrPay += p.totalGross;
        totalCardAll += p.totalGross;
      } else if (method === 'CARD_TERMINAL' || method.startsWith('CARD')) {
        totalCardTerminal += p.totalGross;
        totalCardAll += p.totalGross;
      } else if (method.startsWith('NON_PAID')) {
        totalStaff += p.totalGross;
      }

      // Waiter breakdown
      const wName = p.waiterName || 'Unbekannt';
      if (!waiterMap.has(wName)) {
        waiterMap.set(wName, {
          waiterName: wName,
          totalGross: 0,
          cashGross: 0,
          cardGross: 0,
          tips: 0,
          depositReturned: 0,
          transactionCount: 0,
          ordersLastHour: 0,
          salesLastHour: 0,
        });
      }

      const w = waiterMap.get(wName)!;
      w.transactionCount++;
      w.totalGross += p.totalGross;
      w.tips += p.tipAmount;
      w.depositReturned += p.returnDeposit;

      if (new Date(p.createdAt) >= oneHourAgo) {
        w.ordersLastHour++;
        w.salesLastHour += p.totalGross;
      }

      if (method === 'CASH') {
        w.cashGross += p.totalGross;
      } else if (method.startsWith('CARD')) {
        w.cardGross += p.totalGross;
      }
    }

    // Waiter aus WaiterProfile & Orders erfassen
    try {
      const waiterProfiles = await prisma.waiterProfile.findMany({ where: { isActive: true } });
      for (const wp of waiterProfiles) {
        if (!waiterMap.has(wp.name)) {
          waiterMap.set(wp.name, {
            waiterName: wp.name,
            totalGross: 0,
            cashGross: 0,
            cardGross: 0,
            tips: 0,
            depositReturned: 0,
            transactionCount: 0,
            ordersLastHour: 0,
            salesLastHour: 0,
          });
        }
      }

      for (const ord of orders) {
        if (ord.waiterName && !waiterMap.has(ord.waiterName)) {
          waiterMap.set(ord.waiterName, {
            waiterName: ord.waiterName,
            totalGross: 0,
            cashGross: 0,
            cardGross: 0,
            tips: 0,
            depositReturned: 0,
            transactionCount: 0,
            ordersLastHour: 0,
            salesLastHour: 0,
          });
        }
      }
    } catch {}

    // Rank waiters by total gross
    const rankedWaiters = Array.from(waiterMap.values())
      .sort((a, b) => b.totalGross - a.totalGross)
      .map((w, idx) => ({ ...w, rank: idx + 1 }));

    // Top selling items
    const productStats = new Map<string, { name: string; quantity: number; revenue: number }>();
    for (const ord of orders) {
      for (const item of ord.items) {
        if (item.isCancelled) continue;
        if (!productStats.has(item.productName)) {
          productStats.set(item.productName, { name: item.productName, quantity: 0, revenue: 0 });
        }
        const s = productStats.get(item.productName)!;
        s.quantity += item.quantity;
        s.revenue += (item.unitPrice + (item.deposit || 0)) * item.quantity;
      }
    }

    const topProducts = Array.from(productStats.values()).sort((a, b) => b.quantity - a.quantity);

    // Hourly Sales & Forecast Analysis
    const hourlySales = computeHourlySales(orders);
    const forecast = computeForecast(hourlySales, totalGross, [], products);

    // Category Breakdown (Linear in O(N) aus OrderItems)
    const productCategoryMap = new Map<string, string>();
    for (const p of products) {
      productCategoryMap.set(p.id, p.categoryId);
    }

    const catRevenueMap = new Map<string, { revenue: number; count: number }>();
    for (const ord of orders) {
      for (const item of ord.items) {
        if (item.isCancelled) continue;
        const catId = productCategoryMap.get(item.productId) || 'uncategorized';
        if (!catRevenueMap.has(catId)) {
          catRevenueMap.set(catId, { revenue: 0, count: 0 });
        }
        const st = catRevenueMap.get(catId)!;
        st.revenue += (item.unitPrice + (item.deposit || 0)) * item.quantity;
        st.count += item.quantity;
      }
    }

    const categoryBreakdown = categories.map((c) => {
      const stats = catRevenueMap.get(c.id) || { revenue: 0, count: 0 };
      return {
        id: c.id,
        name: c.name,
        color: c.color || '#3b82f6',
        revenue: Math.round(stats.revenue * 100) / 100,
        count: stats.count,
        percent: totalGross > 0 ? Math.round((stats.revenue / totalGross) * 1000) / 10 : 0,
      };
    });

    const paymentSplit = {
      cash: { amount: totalCash, percent: totalGross > 0 ? Math.round((totalCash / totalGross) * 100) : 0 },
      cardAll: { amount: totalCardAll, percent: totalGross > 0 ? Math.round((totalCardAll / totalGross) * 100) : 0 },
      cardSumUp: totalCardSumUp,
      cardVrPay: totalCardVrPay,
      cardTerminal: totalCardTerminal,
      staff: totalStaff,
      discounts: totalDiscounts,
      surcharges: totalSurcharges,
    };

    const summary = {
      totalGross,
      totalNet,
      totalTax19,
      totalTax7,
      totalCash,
      totalCard: totalCardAll,
      paymentSplit,
      totalStaff,
      totalDepositCharged,
      totalDepositReturned,
      netDepositBalance: totalDepositCharged - totalDepositReturned,
      totalTips,
      totalDiscounts,
      totalSurcharges,
      transactionCount: payments.length,
      ordersCount: orders.length,
      waiters: rankedWaiters,
      topProducts,
      hourlySales,
      categoryBreakdown,
      forecast,
      exportedAt: new Date().toISOString(),
    };

    if (format === 'csv') {
      const csvLines: string[] = [];
      csvLines.push('OpenBon Kassenabschluss & Z-Bon Bericht');
      csvLines.push(`Export-Datum;${new Date().toLocaleString('de-DE')}`);
      csvLines.push('');
      csvLines.push('KENNZAHL;WERT');
      csvLines.push(`Gesamtumsatz Brutto;${totalGross.toFixed(2)} EUR`);
      csvLines.push(`Gesamtumsatz Netto;${totalNet.toFixed(2)} EUR`);
      csvLines.push(`MwSt 19%;${totalTax19.toFixed(2)} EUR`);
      csvLines.push(`Bargeld (Ist);${totalCash.toFixed(2)} EUR`);
      csvLines.push(`Kartenzahlung (Gesamt);${totalCardAll.toFixed(2)} EUR`);
      csvLines.push(`- davon SumUp;${totalCardSumUp.toFixed(2)} EUR`);
      csvLines.push(`- davon VR-Pay Me;${totalCardVrPay.toFixed(2)} EUR`);
      csvLines.push(`- davon EC-Terminal;${totalCardTerminal.toFixed(2)} EUR`);
      csvLines.push(`Aufschlaege (Pauschalen / %);${totalSurcharges.toFixed(2)} EUR`);
      csvLines.push(`Personal / Bewirtung;${totalStaff.toFixed(2)} EUR`);
      csvLines.push(`Ausgezahlter Rueckpfand;${totalDepositReturned.toFixed(2)} EUR`);
      csvLines.push(`Erhaltenes Kellner-Trinkgeld;${totalTips.toFixed(2)} EUR`);
      csvLines.push(`Anzahl Belege;${payments.length}`);
      csvLines.push('');
      csvLines.push('RANG;KELLNER;GESAMT-UMSATZ;LETZTE STUNDE;BAR-UMSATZ;KARTEN-UMSATZ;TRINKGELD;BELEGE');
      for (const w of rankedWaiters) {
        csvLines.push(
          `#${w.rank};${w.waiterName};${w.totalGross.toFixed(2)};${w.salesLastHour.toFixed(2)} (${w.ordersLastHour} Bons);${w.cashGross.toFixed(2)};${w.cardGross.toFixed(2)};${w.tips.toFixed(2)};${w.transactionCount}`
        );
      }
      csvLines.push('');
      csvLines.push('ARTIKEL;MENGE;UMSATZ BRUTTO');
      for (const p of topProducts) {
        csvLines.push(`${p.name};${p.quantity};${p.revenue.toFixed(2)}`);
      }

      return new Response(csvLines.join('\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="OpenBon_Z-Bon_${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
