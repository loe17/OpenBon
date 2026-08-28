const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const LOCAL_SCREENSHOT_DIR = path.resolve(__dirname, '..', 'screenshots');
const ARTIFACT_DIR = path.resolve('C:/Users/Lukas/.gemini/antigravity/brain/b34e91d0-3363-4a26-991e-56fb853ff8d7/scratch/screenshots');

const THEMES = ['dark', 'light', 'tradition', 'speed'];

const SCREENS = [
  // 1. Start & Setup
  { name: '01_home_station_select', path: '/', width: 1280, height: 800 },
  { name: '02_setup_wizard', path: '/setup', width: 1280, height: 800 },

  // 2. Kasse & Handhelds
  { name: '03_pos_counter', path: '/pos', width: 1280, height: 800 },
  { name: '04_waiter_tables', path: '/waiter', width: 390, height: 844 },
  { name: '05_waiter_order', path: '/waiter/order', width: 390, height: 844 },
  { name: '06_waiter_payment', path: '/waiter/payment', width: 390, height: 844 },
  { name: '07_waiter_settle', path: '/waiter/settle', width: 390, height: 844 },

  // 3. Monitore & Kundendisplays
  { name: '08_kitchen_kds', path: '/kitchen', width: 1280, height: 800 },
  { name: '09_kiosk_self_order', path: '/kiosk', width: 1080, height: 1920 },
  { name: '10_customer_display', path: '/customer-display', width: 1280, height: 800 },
  { name: '11_guest_table_menu', path: '/guest/table/1', width: 390, height: 844 },
  { name: '12_receipt_ebon', path: '/receipt/SAMPLE-EBON-1234', width: 420, height: 800 },
  { name: '13_team_chat', path: '/chat', width: 1280, height: 800 },
  { name: '14_taps_flow_monitor', path: '/taps', width: 1280, height: 800 },
  { name: '15_virtual_printer', path: '/virtual-printer', width: 1280, height: 800 },

  // 4. Admin Command Center & Fachmodule
  { name: '16_admin_dashboard', path: '/admin/dashboard', width: 1280, height: 800 },
  { name: '17_admin_products', path: '/admin/products', width: 1280, height: 800 },
  { name: '18_admin_tables', path: '/admin/tables', width: 1280, height: 800 },
  { name: '19_admin_tables_print', path: '/admin/tables/print', width: 1280, height: 800 },
  { name: '20_admin_printers', path: '/admin/printers', width: 1280, height: 800 },
  { name: '21_admin_reports', path: '/admin/reports', width: 1280, height: 800 },
  { name: '22_admin_settle', path: '/admin/settle', width: 1280, height: 800 },
  { name: '23_admin_cashbook', path: '/admin/cashbook', width: 1280, height: 800 },
  { name: '24_admin_fiscal', path: '/admin/fiscal', width: 1280, height: 800 },
  { name: '25_admin_fiscal_kassenmeldung', path: '/admin/fiscal/kassenmeldung', width: 1280, height: 800 },
  { name: '26_admin_inventory', path: '/admin/inventory', width: 1280, height: 800 },
  { name: '27_admin_stock_units', path: '/admin/stock-units', width: 1280, height: 800 },
  { name: '28_admin_procurement', path: '/admin/procurement', width: 1280, height: 800 },
  { name: '29_admin_accounting', path: '/admin/accounting', width: 1280, height: 800 },
  { name: '30_admin_tips', path: '/admin/tips', width: 1280, height: 800 },
  { name: '31_admin_tokens', path: '/admin/tokens', width: 1280, height: 800 },
  { name: '32_admin_devices', path: '/admin/devices', width: 1280, height: 800 },
  { name: '33_admin_qr_codes', path: '/admin/qr-codes', width: 1280, height: 800 },
  { name: '34_admin_diagnostics', path: '/admin/diagnostics', width: 1280, height: 800 },
  { name: '35_admin_backup', path: '/admin/backup', width: 1280, height: 800 },
  { name: '36_admin_logs', path: '/admin/logs', width: 1280, height: 800 },
  { name: '37_admin_settings', path: '/admin/settings', width: 1280, height: 800 },
  { name: '38_admin_system_update', path: '/admin/system-update', width: 1280, height: 800 },
  { name: '39_admin_docs', path: '/admin/docs', width: 1280, height: 800 },
];

const APP_VERSION = 'v0.4.14';

function archiveExistingScreenshots() {
  const altDir = path.join(LOCAL_SCREENSHOT_DIR, 'alt');
  if (!fs.existsSync(altDir)) {
    fs.mkdirSync(altDir, { recursive: true });
  }

  const pad = (n) => String(n).padStart(2, '0');

  for (const theme of THEMES) {
    const themeDir = path.join(LOCAL_SCREENSHOT_DIR, theme);
    if (fs.existsSync(themeDir)) {
      const files = fs.readdirSync(themeDir).filter((f) => f.endsWith('.png'));
      for (const file of files) {
        const oldFilePath = path.join(themeDir, file);
        try {
          const stat = fs.statSync(oldFilePath);
          const fileDate = new Date(stat.mtime);
          const fileTimestamp = `${fileDate.getFullYear()}-${pad(fileDate.getMonth() + 1)}-${pad(fileDate.getDate())}_${pad(fileDate.getHours())}-${pad(fileDate.getMinutes())}`;
          const archivedName = `${APP_VERSION}_${fileTimestamp}_${theme}_${file}`;
          const targetPath = path.join(altDir, archivedName);
          fs.renameSync(oldFilePath, targetPath);
        } catch (err) {
          console.error(`Archivierungsfehler bei ${file}:`, err.message);
        }
      }
    }
  }
}

async function run() {
  console.log('[SCREENSHOT] Archiviere vorherige Versionen nach screenshots/alt/...');
  archiveExistingScreenshots();

  console.log('[SCREENSHOT] Initialisiere Verzeichnisse...');
  for (const theme of THEMES) {
    const themeDir = path.join(LOCAL_SCREENSHOT_DIR, theme);
    if (!fs.existsSync(themeDir)) {
      fs.mkdirSync(themeDir, { recursive: true });
    }
  }
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  console.log('[SCREENSHOT] Starte Headless Browser (Puppeteer)...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const authPage = await browser.newPage();
    await authPage.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });

    // Authentifiziere als ADMIN fuer alle Stationen
    const loginRes = await authPage.evaluate(async (url) => {
      const res = await fetch(`${url}/api/auth/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'VERIFY', stationType: 'ADMIN', pin: '1234' }),
      });
      return res.ok;
    }, BASE_URL);

    console.log(`[AUTH] Admin-Authentifizierung: ${loginRes ? 'Erfolgreich' : 'Fehlgeschlagen'}`);
    await authPage.close();

    for (const theme of THEMES) {
      console.log(`\n========================================`);
      console.log(`[THEME] Erstelle Screenshots fuer Theme: ${theme.toUpperCase()} (39 Screens)`);
      console.log(`========================================`);

      for (const screen of SCREENS) {
        const page = await browser.newPage();
        await page.setViewport({
          width: screen.width,
          height: screen.height,
          deviceScaleFactor: 2,
        });

        // Setze Theme vorab im LocalStorage & SessionStorage für Stationen
        await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
        await page.evaluate((t) => {
          localStorage.setItem('openbon_theme', t);
          sessionStorage.setItem('openbon_waiter_name', 'Anna');
          sessionStorage.setItem('openbon_station_pin_ADMIN', '1234');
          sessionStorage.setItem('openbon_station_pin_POS', '1234');
          sessionStorage.setItem('openbon_station_pin_POS_CASHIER', '1234');
          sessionStorage.setItem('openbon_station_pin_WAITER', '1234');
          sessionStorage.setItem('openbon_station_pin_KITCHEN', '1234');
          document.documentElement.setAttribute('data-theme', t);
          document.documentElement.className = `${t} h-full font-sans`;
        }, theme);

        const url = `${BASE_URL}${screen.path}`;
        try {
          await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
        } catch {
          await page.goto(url, { waitUntil: 'domcontentloaded' });
        }

        await page.evaluate((t) => {
          document.documentElement.setAttribute('data-theme', t);
          document.documentElement.classList.remove('dark', 'light', 'contrast', 'tradition', 'speed');
          document.documentElement.classList.add(t);
        }, theme);

        // Render-Puffer fuer dynamische Komponenten
        await new Promise((resolve) => setTimeout(resolve, 600));

        const filename = `${screen.name}.png`;
        const localPath = path.join(LOCAL_SCREENSHOT_DIR, theme, filename);
        const artifactPath = path.join(ARTIFACT_DIR, `${theme}_${screen.name}.png`);

        await page.screenshot({ path: localPath, fullPage: false });
        fs.copyFileSync(localPath, artifactPath);

        console.log(`[✓] ${theme.toUpperCase()} -> screenshots/${theme}/${filename} (${screen.width}x${screen.height})`);

        await page.close();
      }
    }

    console.log(`\n[FERTIG] Alle Screenshots wurden in folgendem Ordner gespeichert:`);
    console.log(`  -> ${LOCAL_SCREENSHOT_DIR}`);
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('[FEHLER] Screenshot-Lauf fehlgeschlagen:', err);
  process.exit(1);
});
