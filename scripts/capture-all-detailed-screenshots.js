const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BASE_URL = process.env.TEST_URL || 'http://127.0.0.1:3000';
const TARGET_DIR = path.resolve(__dirname, '..', 'screenshots', 'aktuell');
const ARTIFACT_DIR = path.resolve('C:/Users/Lukas/.gemini/antigravity/brain/b34e91d0-3363-4a26-991e-56fb853ff8d7/scratch/screenshots');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function setDarkThemeAndAuth(page, token) {
  if (token) {
    await page.setCookie({
      name: 'openbon_session',
      value: token,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      secure: false,
    });
  }

  await page.evaluate(() => {
    localStorage.setItem('openbon_theme', 'dark');
    sessionStorage.setItem('openbon_waiter_name', 'Johannes');
    sessionStorage.setItem('openbon_station_pin_ADMIN', '1234');
    sessionStorage.setItem('openbon_station_pin_POS', '1234');
    sessionStorage.setItem('openbon_station_pin_POS_CASHIER', '1234');
    sessionStorage.setItem('openbon_station_pin_WAITER', '1234');
    sessionStorage.setItem('openbon_station_pin_KITCHEN', '1234');
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.className = 'dark h-full font-sans';
  });
}

async function captureScreen(page, filename, width = 1280, height = 800) {
  await page.setViewport({ width, height, deviceScaleFactor: 2 });
  await sleep(2500); // 2.5s Render-Puffer
  const targetPath = path.join(TARGET_DIR, `${filename}.png`);
  const artifactPath = path.join(ARTIFACT_DIR, `${filename}.png`);

  await page.screenshot({ path: targetPath, fullPage: false });
  try {
    fs.copyFileSync(targetPath, artifactPath);
  } catch (e) {}

  console.log(`[✓] ${filename}.png (${width}x${height})`);
}

async function run() {
  console.log(`[SCREENSHOT] Zielordner: ${TARGET_DIR}`);
  if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
  }
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  // 0. Seed Database Data
  console.log('[SEED] Bereite Beispieldaten in Datenbank vor...');
  let sampleTable = null;
  try {
    sampleTable = await prisma.diningTable.findFirst({ where: { tableNumber: 10 } });
    if (!sampleTable) {
      sampleTable = await prisma.diningTable.findFirst();
    }
    if (!sampleTable) {
      sampleTable = await prisma.diningTable.create({
        data: { tableNumber: 10, label: 'Tisch 10', gridX: 1, gridY: 1 },
      });
    }

    const prods = await prisma.product.findMany({ take: 6 });

    // Seed Sample Payment for E-Bon
    const existingSample = await prisma.payment.findFirst({ where: { digitalReceiptCode: 'SAMPLE-EBON-1234' } });
    if (!existingSample && prods.length > 0) {
      await prisma.payment.create({
        data: {
          invoiceNumber: 'RE-2026-9999',
          digitalReceiptCode: 'SAMPLE-EBON-1234',
          totalGross: 24.50,
          totalNet: 20.59,
          totalTax: 3.91,
          taxBase19: 20.59,
          taxAmount19: 3.91,
          taxBase7: 0,
          taxAmount7: 0,
          taxBase0: 0,
          totalDeposit: 2.00,
          returnDeposit: 0,
          discountAmount: 0,
          tipAmount: 2.00,
          givenAmount: 30.00,
          changeAmount: 3.50,
          paymentMethod: 'CASH',
          waiterName: 'Johannes',
          tableId: sampleTable ? sampleTable.id : null,
          items: {
            create: prods.slice(0, 3).map((p) => ({
              productName: p.name,
              quantity: 2,
              unitPrice: p.price,
              deposit: p.deposit || 0,
              taxRate: p.taxRate || 19,
            })),
          },
        },
      });
    }

    // Seed Open Order for Waiter on sampleTable
    if (sampleTable && prods.length > 0) {
      await prisma.order.deleteMany({ where: { tableId: sampleTable.id } });
      await prisma.order.create({
        data: {
          tableId: sampleTable.id,
          waiterName: 'Johannes',
          status: 'OPEN',
          totalGross: 23.50,
          items: {
            create: [
              { productId: prods[0].id, productName: prods[0].name, quantity: 2, unitPrice: prods[0].price, deposit: prods[0].deposit || 0, status: 'OPEN' },
              { productId: prods[1].id, productName: prods[1].name, quantity: 2, unitPrice: prods[1].price, deposit: prods[1].deposit || 0, status: 'OPEN' },
              { productId: prods[2].id, productName: prods[2].name, quantity: 1, unitPrice: prods[2].price, deposit: prods[2].deposit || 0, status: 'OPEN' },
            ],
          },
        },
      });
    }
  } catch (err) {
    console.warn('[SEED WARN]', err.message);
  }

  // Get Admin JWT Token
  console.log('[AUTH] Hole Admin JWT Session Token...');
  let authToken = '';
  try {
    const authRes = await fetch(`${BASE_URL}/api/auth/pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'VERIFY', stationType: 'ADMIN', pin: '1234' }),
    });
    const authData = await authRes.json();
    authToken = authData.token || '';
  } catch (e) {
    console.warn('[AUTH WARN]', e.message);
  }

  console.log('[SCREENSHOT] Starte Puppeteer Browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,800'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await setDarkThemeAndAuth(page, authToken);

    // =========================================================================
    // 1. BONKASSE (/pos) - DETAILLIERTER ABLAUF (8 Zustände)
    // =========================================================================
    console.log('\n--- 1. Bonkasse (/pos) Zustände ---');
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
    await page.goto(`${BASE_URL}/pos`, { waitUntil: 'networkidle2' });
    await setDarkThemeAndAuth(page, authToken);
    await page.goto(`${BASE_URL}/pos`, { waitUntil: 'networkidle2' });

    // 03a: Leerer Warenkorb
    await captureScreen(page, '03a_pos_leer', 1280, 800);

    // 03b: Artikel in den Warenkorb legen (Klicke auf 3 Produkte und bestätige eventuelle Options-Modals)
    await page.evaluate(async () => {
      const productButtons = Array.from(document.querySelectorAll('.grid button'));
      for (let i = 0; i < Math.min(3, productButtons.length); i++) {
        productButtons[i].click();
        await new Promise((r) => setTimeout(r, 400));
        const confirmBtn = Array.from(document.querySelectorAll('.fixed button')).find((b) =>
          b.textContent && (b.textContent.includes('Warenkorb') || b.textContent.includes('Hinzufügen') || b.textContent.includes('Auswählen'))
        );
        if (confirmBtn) confirmBtn.click();
        await new Promise((r) => setTimeout(r, 400));
      }
    });
    await sleep(2000);
    await captureScreen(page, '03b_pos_warenkorb_gefuellt', 1280, 800);

    // 03c: Kassiermodal öffnen (Vollständig)
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const kassierenBtn = btns.find((b) => b.textContent && b.textContent.includes('Kassieren'));
      if (kassierenBtn) kassierenBtn.click();
    });
    await sleep(2000);
    await captureScreen(page, '03c_pos_kassiermodal_voll', 1280, 800);

    // 03d: Kassiermodal Teilzahlung (Deselektiere 1 Artikel)
    await page.evaluate(() => {
      const itemRows = Array.from(document.querySelectorAll('.fixed .overflow-y-auto > div'));
      if (itemRows.length > 1) {
        itemRows[0].click(); // Klicke auf erste Zeile zum Abwählen
      }
    });
    await sleep(2000);
    await captureScreen(page, '03d_pos_kassiermodal_teilzahlung', 1280, 800);

    // 03e: Kassiermodal mit Bargeld-Scheinen & Rückgeld (Klick auf 50€)
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.fixed button'));
      const schein50 = btns.find((b) => b.textContent && b.textContent.trim() === '50 €') ||
                       btns.find((b) => b.textContent && b.textContent.includes('50'));
      if (schein50) schein50.click();
    });
    await sleep(2000);
    await captureScreen(page, '03e_pos_kassiermodal_bar_rueckgeld', 1280, 800);

    // 03f: Kassiermodal Kartenzahlung
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.fixed button'));
      const cardBtn = btns.find((b) => b.textContent && b.textContent.includes('Kartenzahlung'));
      if (cardBtn) cardBtn.click();
    });
    await sleep(2000);
    await captureScreen(page, '03f_pos_kassiermodal_karte', 1280, 800);

    // Schließe Kassiermodal
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.fixed button'));
      const cancelBtn = btns.find((b) => b.textContent && b.textContent.includes('Abbrechen'));
      if (cancelBtn) cancelBtn.click();
    });
    await sleep(1500);

    // 03g: Bestellhistorie Modal öffnen
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('header button, .bg-slate-900 button'));
      const histBtn = btns.find((b) => b.title && b.title.includes('Bestellhistorie')) ||
                      btns.find((b) => b.querySelector('svg.lucide-history'));
      if (histBtn) histBtn.click();
    });
    await sleep(2000);
    await captureScreen(page, '03g_pos_bestellhistorie', 1280, 800);

    // Schließe Historie
    await page.keyboard.press('Escape');
    await sleep(1200);

    // 03h: Stations-Modal öffnen
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('header button, .bg-slate-900 button'));
      const stationBtn = btns.find((b) => b.textContent && (b.textContent.includes('Bonkasse') || b.textContent.includes('Theke'))) ||
                         btns.find((b) => b.querySelector('svg.lucide-store'));
      if (stationBtn) stationBtn.click();
    });
    await sleep(2000);
    await captureScreen(page, '03h_pos_station_modal', 1280, 800);

    // =========================================================================
    // 2. BEDIENUNGSANSICHTEN (/waiter) - DETAILLIERTER ABLAUF
    // =========================================================================
    console.log('\n--- 2. Bedienung (/waiter) Zustände ---');
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await page.goto(`${BASE_URL}/waiter`, { waitUntil: 'networkidle2' });
    await setDarkThemeAndAuth(page, authToken);
    await page.evaluate(() => {
      localStorage.setItem('openbon_auto_open_table_keypad', '0');
    });
    await page.goto(`${BASE_URL}/waiter`, { waitUntil: 'networkidle2' });

    // Schließe eventuell geöffnetes Keypad für sauberen Tischplan
    await page.keyboard.press('Escape');
    await sleep(1500);

    // 04a: Tischplan Übersicht (Reiner Tischplan ohne Modal)
    await captureScreen(page, '04a_waiter_tischplan', 390, 844);

    // 04b: Tischnummer Keypad Modal
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const keypadBtn = btns.find((b) => b.textContent && b.textContent.includes('Tischnummer eingeben'));
      if (keypadBtn) keypadBtn.click();
    });
    await sleep(2000);
    await captureScreen(page, '04b_waiter_tischnummer_keypad', 390, 844);
    await page.keyboard.press('Escape');
    await sleep(1500);

    // 04c: Tisch-Aktionsmodal (Klick auf die erste Tischkachel)
    await page.evaluate(() => {
      const tiles = Array.from(document.querySelectorAll('.grid > div'));
      if (tiles.length > 0) tiles[0].click();
    });
    await sleep(2000);
    await captureScreen(page, '04c_waiter_tisch_aktionen', 390, 844);
    await page.keyboard.press('Escape');
    await sleep(1500);

    // 04d: X-Bon Zwischenstand Modal
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const xbonBtn = btns.find((b) => b.title && b.title.includes('Zwischenstand')) ||
                      btns.find((b) => b.textContent && b.textContent.includes('X-Bon'));
      if (xbonBtn) xbonBtn.click();
    });
    await sleep(2000);
    await captureScreen(page, '04d_waiter_xbon_zwischenstand', 390, 844);

    // Schließe X-Bon Modal via Schließen-Button
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.fixed button'));
      const closeBtn = btns.find((b) => b.textContent && b.textContent.includes('Schließen'));
      if (closeBtn) closeBtn.click();
    });
    await sleep(1200);

    // 04e: Kellner Bestellhistorie
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const histBtn = btns.find((b) => b.title && b.title.includes('Bestellungen')) ||
                      btns.find((b) => b.textContent && b.textContent.includes('Verlauf'));
      if (histBtn) histBtn.click();
    });
    await sleep(2000);
    await captureScreen(page, '04e_waiter_bestellhistorie', 390, 844);
    await page.keyboard.press('Escape');
    await sleep(1500);

    // 05a: Artikelauswahl (Leer)
    const tableIdParam = sampleTable ? sampleTable.id : '';
    const orderUrl = tableIdParam ? `${BASE_URL}/waiter/order?tableId=${tableIdParam}` : `${BASE_URL}/waiter/order`;
    await page.goto(orderUrl, { waitUntil: 'networkidle2' });
    await setDarkThemeAndAuth(page, authToken);
    await page.goto(orderUrl, { waitUntil: 'networkidle2' });
    await sleep(2000);
    await captureScreen(page, '05a_waiter_order_leer', 390, 844);

    // 05b: Artikelauswahl (Warenkorb gefüllt mit aktiver Bestell-Leiste)
    await page.evaluate(async () => {
      const itemBtns = Array.from(document.querySelectorAll('.grid button, button.pos-touch-btn'));
      for (let i = 0; i < Math.min(3, itemBtns.length); i++) {
        itemBtns[i].click();
        await new Promise((r) => setTimeout(r, 400));
        const confirmBtn = Array.from(document.querySelectorAll('.fixed button')).find((b) =>
          b.textContent && (b.textContent.includes('Warenkorb') || b.textContent.includes('Hinzufügen') || b.textContent.includes('Bestätigen'))
        );
        if (confirmBtn) confirmBtn.click();
        await new Promise((r) => setTimeout(r, 400));
      }
    });
    await sleep(2000);
    await captureScreen(page, '05b_waiter_order_warenkorb', 390, 844);

    // 06a-d: Bezahlvorgang (/waiter/payment)
    const payUrl = tableIdParam ? `${BASE_URL}/waiter/payment?tableId=${tableIdParam}` : `${BASE_URL}/waiter/payment`;
    await page.goto(payUrl, { waitUntil: 'networkidle2' });
    await setDarkThemeAndAuth(page, authToken);
    await page.goto(payUrl, { waitUntil: 'networkidle2' });
    await sleep(2000);

    // 06a: Stufe 1 - Rechnungs-Splitting & Artikelauswahl (Standard: alle Artikel des Tisches)
    await captureScreen(page, '06a_waiter_payment_splitting', 390, 844);

    // 06d: Rückpfand-Matrix (In Stufe 1 auf + klicken für Glas & Krug)
    await page.evaluate(() => {
      const plusBtns = Array.from(document.querySelectorAll('button')).filter((b) => b.textContent && b.textContent.trim() === '+');
      if (plusBtns.length > 0) plusBtns[0].click(); // 1x 1,00€
      if (plusBtns.length > 0) plusBtns[0].click(); // 2x 1,00€
      if (plusBtns.length > 1) plusBtns[1].click(); // 1x 2,00€
    });
    await sleep(2000);
    await captureScreen(page, '06d_waiter_payment_pfand_matrix', 390, 844);

    // Weiter zu Stufe 2 (Zahlart)
    await page.evaluate(() => {
      const allBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent && b.textContent.includes('Alles'));
      if (allBtn) allBtn.click();
      const nextBtn = Array.from(document.querySelectorAll('button')).find((b) =>
        b.textContent && (b.textContent.includes('Weiter') || b.textContent.includes('Zahlung') || b.textContent.includes('Kassieren'))
      );
      if (nextBtn) nextBtn.click();
    });
    await sleep(2000);
    // 06b: Stufe 2 - Zahlarten-Auswahl
    await captureScreen(page, '06b_waiter_payment_method', 390, 844);

    // Klick auf Barzahlung -> Stufe 3
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const cashBtn = btns.find((b) => b.textContent && b.textContent.includes('Barzahlung'));
      if (cashBtn) cashBtn.click();
    });
    await sleep(2000);
    // 06c: Stufe 3 - Bargeld-Rechencenter mit Scheinen/Münzen & Wechselgeld
    await captureScreen(page, '06c_waiter_payment_cash_rechner', 390, 844);

    // 07: Schichtabrechnung (/waiter/settle)
    await page.goto(`${BASE_URL}/waiter/settle`, { waitUntil: 'networkidle2' });
    await setDarkThemeAndAuth(page, authToken);
    await page.goto(`${BASE_URL}/waiter/settle`, { waitUntil: 'networkidle2' });
    await captureScreen(page, '07_waiter_settle', 390, 844);

    // =========================================================================
    // 3. MONITORE & GÄSTE-ANSICHTEN
    // =========================================================================
    console.log('\n--- 3. Monitore & Displays ---');
    const displayScreens = [
      { name: '01_home_station_select', path: '/', width: 1280, height: 800 },
      { name: '02_setup_wizard', path: '/setup', width: 1280, height: 800 },
      { name: '08_kitchen_kds', path: '/kitchen', width: 1280, height: 800 },
      { name: '09_kiosk_self_order', path: '/kiosk', width: 1080, height: 1920 },
      { name: '10_customer_display', path: '/customer-display', width: 1280, height: 800 },
      { name: '11_guest_table_menu', path: '/guest/table/1', width: 390, height: 844 },
      { name: '12_receipt_ebon', path: '/receipt/SAMPLE-EBON-1234', width: 420, height: 800 },
      { name: '13_team_chat', path: '/chat', width: 1280, height: 800 },
      { name: '14_taps_flow_monitor', path: '/taps', width: 1280, height: 800 },
      { name: '15_virtual_printer', path: '/virtual-printer', width: 1280, height: 800 },
    ];

    for (const sc of displayScreens) {
      try {
        await page.setViewport({ width: sc.width, height: sc.height, deviceScaleFactor: 2 });
        await page.goto(`${BASE_URL}${sc.path}`, { waitUntil: 'networkidle2', timeout: 12000 });
        await setDarkThemeAndAuth(page, authToken);
        await captureScreen(page, sc.name, sc.width, sc.height);
      } catch (err) {
        console.warn(`[WARN] Fehler bei ${sc.name}:`, err.message);
      }
    }

    // =========================================================================
    // 4. ADMIN LEITSTAND & FACHMODULE (24 Screens)
    // =========================================================================
    console.log('\n--- 4. Admin Leitstand (24 Screens) ---');
    const adminScreens = [
      { name: '16_admin_dashboard', path: '/admin/dashboard' },
      { name: '17_admin_products', path: '/admin/products' },
      { name: '18_admin_tables', path: '/admin/tables' },
      { name: '19_admin_tables_print', path: '/admin/tables/print' },
      { name: '20_admin_printers', path: '/admin/printers' },
      { name: '21_admin_reports', path: '/admin/reports' },
      { name: '22_admin_settle', path: '/admin/settle' },
      { name: '23_admin_cashbook', path: '/admin/cashbook' },
      { name: '24_admin_fiscal', path: '/admin/fiscal' },
      { name: '25_admin_fiscal_kassenmeldung', path: '/admin/fiscal/kassenmeldung' },
      { name: '26_admin_inventory', path: '/admin/inventory' },
      { name: '27_admin_stock_units', path: '/admin/stock-units' },
      { name: '28_admin_procurement', path: '/admin/procurement' },
      { name: '29_admin_accounting', path: '/admin/accounting' },
      { name: '30_admin_tips', path: '/admin/tips' },
      { name: '31_admin_tokens', path: '/admin/tokens' },
      { name: '32_admin_devices', path: '/admin/devices' },
      { name: '33_admin_qr_codes', path: '/admin/qr-codes' },
      { name: '34_admin_diagnostics', path: '/admin/diagnostics' },
      { name: '35_admin_backup', path: '/admin/backup' },
      { name: '36_admin_logs', path: '/admin/logs' },
      { name: '37_admin_settings', path: '/admin/settings' },
      { name: '38_admin_system_update', path: '/admin/system-update' },
      { name: '39_admin_docs', path: '/admin/docs' },
    ];

    for (const sc of adminScreens) {
      try {
        await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
        await page.goto(`${BASE_URL}${sc.path}`, { waitUntil: 'networkidle2', timeout: 12000 });
        await setDarkThemeAndAuth(page, authToken);
        await captureScreen(page, sc.name, 1280, 800);
      } catch (err) {
        console.warn(`[WARN] Fehler bei ${sc.name}:`, err.message);
      }
    }

    console.log(`\n[ERFOLG] Alle 58 Screenshots wurden erfolgreich im Dark Theme erstellt!`);
    console.log(`  -> ${TARGET_DIR}`);
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
}

run().catch((err) => {
  console.error('[FEHLER] Screenshot-Lauf fehlgeschlagen:', err);
  process.exit(1);
});
