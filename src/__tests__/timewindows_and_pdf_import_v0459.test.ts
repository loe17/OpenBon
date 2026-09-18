import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import prisma from '../lib/db';
import {
  isProductActiveNow,
  parseTimeWindows,
  getTimeWindowSummary,
  type TimeWindow,
} from '../lib/time-window';
import {
  parseMenuFromText,
  parsePdfMenu,
} from '../lib/pdf-menu-extractor';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { POST as batchImportPost } from '../app/api/products/batch-import/route';
import { POST as pdfPreviewPost } from '../app/api/products/pdf-preview/route';
import { GET as systemUpdateGet } from '../app/api/system/update/route';
import { GET as publicConfigGet } from '../app/api/config/public/route';
import { NextRequest } from 'next/server';

describe('OpenBon v0.4.59: Artikel-Zeitfenster, PDF-Speisekarten-Import & Echtzeit-Metriken', () => {
  beforeEach(async () => {
    // Cleanup test products & categories
    await prisma.product.deleteMany({
      where: { name: { in: ['Test-Bratwurst-TW', 'Test-Mittags-Menü', 'PDF Import Schnitzel', 'PDF Import Cola 0.5l'] } },
    });
    await prisma.productCategory.deleteMany({
      where: { name: { in: ['Test-Kategorie-TW', 'PDF Speisen Test', 'PDF Getränke Test'] } },
    });
  });

  afterEach(async () => {
    await prisma.product.deleteMany({
      where: { name: { in: ['Test-Bratwurst-TW', 'Test-Mittags-Menü', 'PDF Import Schnitzel', 'PDF Import Cola 0.5l'] } },
    });
    await prisma.productCategory.deleteMany({
      where: { name: { in: ['Test-Kategorie-TW', 'PDF Speisen Test', 'PDF Getränke Test'] } },
    });
  });

  describe('1. Artikel-Zeitfenster & Zeitgesteuerte Sichtbarkeit', () => {
    it('Artikel ohne Zeitfenster oder mit leerer Konfiguration ist immer aktiv', () => {
      expect(isProductActiveNow({ hasTimeWindows: false })).toBe(true);
      expect(isProductActiveNow({ hasTimeWindows: null })).toBe(true);
      expect(isProductActiveNow({ hasTimeWindows: true, timeWindows: '[]' })).toBe(true);
      expect(isProductActiveNow({ hasTimeWindows: true, timeWindows: [] })).toBe(true);
    });

    it('Artikel innerhalb des Zeitfensters ist aktiv, außerhalb inaktiv', () => {
      const windows: TimeWindow[] = [
        {
          id: 'w1',
          name: 'Mittagstisch',
          startTime: '11:30',
          endTime: '14:00',
          days: [1, 2, 3, 4, 5], // Mo - Fr
        },
      ];

      const product = {
        hasTimeWindows: true,
        timeWindows: JSON.stringify(windows),
      };

      // Montag um 12:30 -> Aktiv
      const mondayMidday = new Date('2026-09-21T12:30:00'); // 2026-09-21 ist Montag
      expect(isProductActiveNow(product, mondayMidday)).toBe(true);

      // Montag um 14:05 -> Inaktiv (außerhalb Uhrzeit)
      const mondayAfternoon = new Date('2026-09-21T14:05:00');
      expect(isProductActiveNow(product, mondayAfternoon)).toBe(false);

      // Sonntag um 12:30 -> Inaktiv (falscher Wochentag)
      const sundayMidday = new Date('2026-09-20T12:30:00'); // 2026-09-20 ist Sonntag
      expect(isProductActiveNow(product, sundayMidday)).toBe(false);
    });

    it('Unterstützt Mitternachtsübergreifende Zeitfenster (z. B. Nachtbar 21:00 bis 02:00)', () => {
      const barWindow: TimeWindow[] = [
        {
          id: 'bar1',
          name: 'Nachtbar',
          startTime: '21:00',
          endTime: '02:00',
          days: [5, 6], // Fr & Sa
        },
      ];

      const product = {
        hasTimeWindows: true,
        timeWindows: barWindow,
      };

      // Freitag 22:30 -> Aktiv
      const fridayNight = new Date('2026-09-25T22:30:00'); // Freitag
      expect(isProductActiveNow(product, fridayNight)).toBe(true);

      // Samstag 01:15 -> Aktiv (vor Mitternachtsende 02:00)
      const saturdayEarlyMorning = new Date('2026-09-26T01:15:00'); // Samstag früh
      expect(isProductActiveNow(product, saturdayEarlyMorning)).toBe(true);

      // Samstag 02:30 -> Inaktiv
      const saturdayLateNight = new Date('2026-09-26T02:30:00');
      expect(isProductActiveNow(product, saturdayLateNight)).toBe(false);
    });

    it('getTimeWindowSummary erzeugt lesbare Zusammenfassung', () => {
      const summary = getTimeWindowSummary({
        hasTimeWindows: true,
        timeWindows: [
          { id: '1', name: 'Mittag', startTime: '11:00', endTime: '14:00', days: [1, 2, 3, 4, 5] },
        ],
      });
      expect(summary).toContain('11:00 - 14:00');
      expect(summary).toContain('Mo');
      expect(summary).toContain('Fr');
    });
  });

  describe('2. PDF-Speisekarten Extraktion & Parsing', () => {
    it('Erkennt Speisen, Getränke, Preise und MwSt. aus formatiertem Text', () => {
      const sampleText = `
Speisen vom Grill
Bratwurst mit Senf und Semmel 4,50 EUR
Currywurst mit Pommes 7,80 €
Portion Pommes Frites 3,50

Getränke
Helles Bier 0,5 l 4,20 €
Apfelschorle 0,5l 3,20 EUR
Mineralwasser 0,5l 2,50 €
      `;

      const items = parseMenuFromText(sampleText);
      expect(items.length).toBeGreaterThanOrEqual(6);

      const bratwurst = items.find((i) => i.name.includes('Bratwurst'));
      expect(bratwurst).toBeDefined();
      expect(bratwurst?.price).toBe(4.5);
      expect(bratwurst?.taxRate).toBe(7);

      const bier = items.find((i) => i.name.includes('Bier'));
      expect(bier).toBeDefined();
      expect(bier?.price).toBe(4.2);
      expect(bier?.taxRate).toBe(19);

      const colaOderWasser = items.find((i) => i.name.includes('Mineralwasser'));
      expect(colaOderWasser).toBeDefined();
      expect(colaOderWasser?.price).toBe(2.5);
      expect(colaOderWasser?.taxRate).toBe(19);
    });

    it('Extrahiert Text und Menü direkt aus einem PDF-Dokumenten-Buffer', async () => {
      // Generiere eine kleine Test-PDF im Speicher
      const doc = await PDFDocument.create();
      const page = doc.addPage([500, 500]);
      const font = await doc.embedFont(StandardFonts.Helvetica);

      page.drawText('Kaffee & Kuchen\nKaesekuchen Stueck 3,20 EUR\nTasse Kaffee 2,40 EUR', {
        x: 50,
        y: 400,
        size: 14,
        font,
      });

      const pdfBytes = await doc.save();
      const items = await parsePdfMenu(Buffer.from(pdfBytes));

      expect(items.length).toBe(2);
      expect(items.some((i) => i.name.includes('Kaesekuchen'))).toBe(true);
      expect(items.some((i) => i.name.includes('Kaffee'))).toBe(true);
    });
  });

  describe('3. API Routen: PDF Preview & Batch-Import', () => {
    it('/api/products/pdf-preview liefert Vorschläge per JSON-Text', async () => {
      const req = new NextRequest('http://localhost:3000/api/products/pdf-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Vom Grill\nSchnitzel Wiener Art 9,50 €\nCola 0,33l 2,90 €',
        }),
      });

      const res = await pdfPreviewPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.items.length).toBe(2);
      expect(data.items[0].name).toContain('Schnitzel');
    });

    it('/api/products/batch-import legt Artikel und Kategorien an', async () => {
      const req = new NextRequest('http://localhost:3000/api/products/batch-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              name: 'PDF Import Schnitzel',
              price: 11.5,
              category: 'PDF Speisen Test',
              taxRate: 7,
            },
            {
              name: 'PDF Import Cola 0.5l',
              price: 3.8,
              category: 'PDF Getränke Test',
              taxRate: 19,
            },
          ],
        }),
      });

      const res = await batchImportPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.createdCount).toBe(2);

      // In der Datenbank verifizieren
      const dbItem = await prisma.product.findFirst({
        where: { name: 'PDF Import Schnitzel' },
        include: { category: true },
      });
      expect(dbItem).toBeDefined();
      expect(dbItem?.priceCents).toBe(1150);
      expect(dbItem?.taxRate).toBe(7);
      expect(dbItem?.category.name).toBe('PDF Speisen Test');
    });
  });

  describe('4. Echtzeit-Systemmetriken (< 1s Abfrage)', () => {
    it('/api/system/update liefert CPU- und RAM-Werte schnell ohne künstliche Verzögerung', async () => {
      process.env.SESSION_SECRET = 'test-secret-1234567890-update-secret';
      const { signSessionToken } = await import('../lib/auth-session');
      const adminToken = await signSessionToken({ role: 'ADMIN', deviceId: 'test-admin-metrics' });

      const makeReq = () =>
        new NextRequest('http://localhost:3000/api/system/update?metricsOnly=1', {
          headers: {
            cookie: `openbon_session=${adminToken}`,
          },
        });

      const start = Date.now();
      const res = await systemUpdateGet(makeReq());
      const duration = Date.now() - start;

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.cpu).toBeDefined();
      expect(typeof data.cpu.usedPercentage).toBe('number');
      expect(data.memory).toBeDefined();
      expect(data.memory.totalBytes).toBeGreaterThan(0);
      expect(data.serverTimestamp).toBeDefined();
      expect(typeof data.serverTimestamp).toBe('number');
      expect(data.serverTime).toBeDefined();

      // Zweiter Aufruf profitiert vom Snapshot-Delta und muss extrem schnell sein
      const start2 = Date.now();
      const res2 = await systemUpdateGet(makeReq());
      const duration2 = Date.now() - start2;
      expect(res2.status).toBe(200);
      expect(duration2).toBeLessThan(500); // Schneller als 500ms
    });

    it('/api/config/public liefert serverTimestamp für die Kassen-Uhr Synchronisation', async () => {
      const res = await publicConfigGet();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.serverTimestamp).toBeDefined();
      expect(typeof data.serverTimestamp).toBe('number');
      expect(Math.abs(data.serverTimestamp - Date.now())).toBeLessThan(5000);
      expect(data.serverTime).toBeDefined();
    });
  });
});
