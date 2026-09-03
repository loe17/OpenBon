import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { computeHourlySales, computeForecast } from '@/lib/forecast';
import { requireApiAuth } from '@/lib/api-guard';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format'); // 'json' or 'csv'
  const waiterFilter = searchParams.get('waiterName');
  // Performance: optional ?days=N begrenzt die Auswertung (Default 30 Tage)
  const daysParam = parseInt(searchParams.get('days') || '30', 10);
  const days = Number.isFinite(daysParam) ? Math.min(365, Math.max(1, daysParam)) : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Der Gesamtbericht ist Chefsache (ADMIN-only). Eigene Schichtzahlen gibt es
  // schlank über /api/reports/mine (nur eigene waiterName == Session).
  const auth = await requireApiAuth(req, ['ADMIN']);
  if (!auth.ok) return auth.response;
  if (waiterFilter) {
    return NextResponse.json(
      { error: 'Bitte /api/reports/mine für die eigene Schichtabrechnung nutzen.' },
      { status: 403 }
    );
  }

  try {

    // 1. Fetch real (non-training) completed payments, orders, products & categories schlank (zeitbegrenzt)
    const [payments, orders, products, categories] = await Promise.all([
      prisma.payment.findMany({
        where: { isCancelled: false, isTraining: false, createdAt: { gte: since } },
        include: { table: true },
      }),
      prisma.order.findMany({
        where: { status: { not: 'CANCELLED' }, isTraining: false, createdAt: { gte: since } },
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
      totalGross += p.totalGrossCents;
      totalNet += p.totalNetCents;
      totalTax19 += p.totalTaxCents || 0;
      totalDepositCharged += p.totalDepositCents;
      totalDepositReturned += p.returnDepositCents;
      totalTips += p.tipAmountCents;
      totalDiscounts += p.discountAmountCents;
      totalSurcharges += p.surchargeAmountCents || 0;

      const method = p.paymentMethod || 'CASH';
      if (method === 'CASH') {
        totalCash += p.totalGrossCents;
      } else if (method === 'CARD_SUMUP') {
        totalCardSumUp += p.totalGrossCents;
        totalCardAll += p.totalGrossCents;
      } else if (method === 'CARD_VRPAY') {
        totalCardVrPay += p.totalGrossCents;
        totalCardAll += p.totalGrossCents;
      } else if (method === 'CARD_TERMINAL' || method.startsWith('CARD')) {
        totalCardTerminal += p.totalGrossCents;
        totalCardAll += p.totalGrossCents;
      } else if (method.startsWith('NON_PAID')) {
        totalStaff += p.totalGrossCents;
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
      w.totalGross += p.totalGrossCents;
      w.tips += p.tipAmountCents;
      w.depositReturned += p.returnDepositCents;

      if (new Date(p.createdAt) >= oneHourAgo) {
        w.ordersLastHour++;
        w.salesLastHour += p.totalGrossCents;
      }

      if (method === 'CASH') {
        w.cashGross += p.totalGrossCents;
      } else if (method.startsWith('CARD')) {
        w.cardGross += p.totalGrossCents;
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

    // Rank waiters by total gross (Cents intern, Display /100)
    const rankedWaitersCents = Array.from(waiterMap.values())
      .sort((a, b) => b.totalGross - a.totalGross)
      .map((w, idx) => ({ ...w, rank: idx + 1 }));
    const rankedWaiters = rankedWaitersCents.map((w) => ({
      ...w,
      totalGross: w.totalGross / 100,
      cashGross: w.cashGross / 100,
      cardGross: w.cardGross / 100,
      tips: w.tips / 100,
      depositReturned: w.depositReturned / 100,
      salesLastHour: w.salesLastHour / 100,
    }));

    // Top selling items (Cents intern -> Euro für Display)
    const productStats = new Map<string, { name: string; quantity: number; revenue: number }>();
    for (const ord of orders) {
      for (const item of ord.items) {
        if (item.isCancelled) continue;
        if (!productStats.has(item.productName)) {
          productStats.set(item.productName, { name: item.productName, quantity: 0, revenue: 0 });
        }
        const s = productStats.get(item.productName)!;
        s.quantity += item.quantity;
        s.revenue += ((item.unitPriceCents + (item.depositCents || 0)) * item.quantity) / 100;
      }
    }

    const topProducts = Array.from(productStats.values()).sort((a, b) => b.quantity - a.quantity);

    // Hourly Sales & Forecast Analysis (Lib in Euro -> /100 Brücke)
    const forecastOrders = orders.map((o: any) => ({
      ...o,
      items: (o.items || []).map((i: any) => ({ ...i, unitPriceCents: i.unitPriceCents, deposit: (i.depositCents ?? 0) / 100 })),
    }));
    const hourlySales = computeHourlySales(forecastOrders as any);
    const forecast = computeForecast(hourlySales, totalGross / 100, [], products);

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
        st.revenue += ((item.unitPriceCents + (item.depositCents || 0)) * item.quantity) / 100;
        st.count += item.quantity;
      }
    }

    const totalGrossEuro = totalGross / 100;
    const categoryBreakdown = categories.map((c) => {
      const stats = catRevenueMap.get(c.id) || { revenue: 0, count: 0 };
      return {
        id: c.id,
        name: c.name,
        color: c.color || '#3b82f6',
        revenue: Math.round(stats.revenue * 100) / 100,
        count: stats.count,
        percent: totalGrossEuro > 0 ? Math.round((stats.revenue / totalGrossEuro) * 1000) / 10 : 0,
      };
    });

    const paymentSplit = {
      cash: { amount: totalCash / 100, percent: totalGross > 0 ? Math.round((totalCash / totalGross) * 100) : 0 },
      cardAll: { amount: totalCardAll / 100, percent: totalGross > 0 ? Math.round((totalCardAll / totalGross) * 100) : 0 },
      cardSumUp: totalCardSumUp / 100,
      cardVrPay: totalCardVrPay / 100,
      cardTerminal: totalCardTerminal / 100,
      staff: totalStaff / 100,
      discounts: totalDiscounts / 100,
      surcharges: totalSurcharges / 100,
    };

    const summary = {
      totalGross: totalGross / 100,
      totalNet: totalNet / 100,
      totalTax19: totalTax19 / 100,
      totalTax7: totalTax7 / 100,
      totalCash: totalCash / 100,
      totalCard: totalCardAll / 100,
      paymentSplit,
      totalStaff: totalStaff / 100,
      totalDepositCharged: totalDepositCharged / 100,
      totalDepositReturned: totalDepositReturned / 100,
      netDepositBalance: (totalDepositCharged - totalDepositReturned) / 100,
      totalTips: totalTips / 100,
      totalDiscounts: totalDiscounts / 100,
      totalSurcharges: totalSurcharges / 100,
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
      csvLines.push(`Gesamtumsatz Brutto;${(totalGross / 100).toFixed(2)} EUR`);
      csvLines.push(`Gesamtumsatz Netto;${(totalNet / 100).toFixed(2)} EUR`);
      csvLines.push(`MwSt 19%;${(totalTax19 / 100).toFixed(2)} EUR`);
      csvLines.push(`Bargeld (Ist);${(totalCash / 100).toFixed(2)} EUR`);
      csvLines.push(`Kartenzahlung (Gesamt);${(totalCardAll / 100).toFixed(2)} EUR`);
      csvLines.push(`- davon SumUp;${(totalCardSumUp / 100).toFixed(2)} EUR`);
      csvLines.push(`- davon VR-Pay Me;${(totalCardVrPay / 100).toFixed(2)} EUR`);
      csvLines.push(`- davon EC-Terminal;${(totalCardTerminal / 100).toFixed(2)} EUR`);
      csvLines.push(`Aufschlaege (Pauschalen / %);${(totalSurcharges / 100).toFixed(2)} EUR`);
      csvLines.push(`Personal / Bewirtung;${(totalStaff / 100).toFixed(2)} EUR`);
      csvLines.push(`Ausgezahlter Rueckpfand;${(totalDepositReturned / 100).toFixed(2)} EUR`);
      csvLines.push(`Erhaltenes Kellner-Trinkgeld;${(totalTips / 100).toFixed(2)} EUR`);
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
